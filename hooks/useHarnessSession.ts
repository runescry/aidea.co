'use client';
import { useReducer, useRef, useCallback } from 'react';
import type { HarnessEvent, HarnessEventType, CostSnapshot, EntityType } from '@/lib/harness/types';
import { consumeHarnessSSE } from '@/lib/client/sse';

export interface AgentNode {
  id: string;
  role: string;
  tier: number;
  domain: string;
  parentId: string | null;
  status: 'idle' | 'running' | 'waiting' | 'complete' | 'error';
  tokensUsed?: number;
  spawnedAt: string;
  completedAt?: string;
}

export interface ToolCallRecord {
  agentId: string;
  agentRole: string;
  tool: string;
  input: Record<string, unknown>;
  result?: unknown;
  calledAt: string;
}

export interface ConsensusRecord {
  decisionId?: string;
  topic: string;
  stakeholderRoles?: string[];
  votes: Array<{ role: string; position: string; confidence: number; round: number }>;
  outcome?: string;
  decidedBy?: 'consensus' | 'parent';
  status: 'in-progress' | 'resolved';
  openedAt: string;
}

export interface PendingHumanInput {
  requestId: string;
  question: string;
  agentRole: string;
}

export interface HarnessState {
  sessionId?: string;
  entityType?: string;
  entityId?: string;
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  agents: Record<string, AgentNode>;       // agentId → node
  agentsByRole: Record<string, string>;    // role → agentId
  entityState: Record<string, unknown>;   // shared state data
  toolCalls: ToolCallRecord[];
  consensus: Record<string, ConsensusRecord>; // decisionId → record
  cost?: CostSnapshot;
  eventLog: HarnessEvent[];
  error?: string;
  rootAgentId?: string;
  pendingInput: PendingHumanInput | null;
}

type Action =
  | { type: 'HARNESS_EVENT'; event: HarnessEvent }
  | { type: 'RESET' }
  | { type: 'CLEAR_PENDING_INPUT' };

const INITIAL_STATE: HarnessState = {
  status: 'idle',
  agents: {},
  agentsByRole: {},
  entityState: {},
  toolCalls: [],
  consensus: {},
  eventLog: [],
  pendingInput: null,
};

function reducer(state: HarnessState, action: Action): HarnessState {
  if (action.type === 'RESET') return { ...INITIAL_STATE };
  if (action.type === 'CLEAR_PENDING_INPUT') return { ...state, pendingInput: null };

  const { event } = action;
  const log = [...state.eventLog.slice(-200), event];

  switch (event.type as HarnessEventType) {
    case 'entity_started':
      return {
        ...state,
        entityId: event.entityId,
        entityType: event.data.entityType as string,
        status: 'running',
        eventLog: log,
      };

    case 'entity_complete':
      return {
        ...state,
        status: 'complete',
        cost: event.data.cost as CostSnapshot,
        eventLog: log,
      };

    case 'entity_error':
      return {
        ...state,
        status: 'error',
        error: event.data.error as string,
        cost: event.data.cost as CostSnapshot | undefined,
        eventLog: log,
      };

    case 'agent_spawned': {
      const agentId = event.agentId!;
      const role = event.agentRole!;
      const node: AgentNode = {
        id: agentId,
        role,
        tier: event.data.tier as number ?? 0,
        domain: event.data.domain as string ?? '',
        parentId: event.data.parentId as string | null ?? null,
        status: 'idle',
        spawnedAt: event.timestamp,
      };
      return {
        ...state,
        agents: { ...state.agents, [agentId]: node },
        agentsByRole: { ...state.agentsByRole, [role]: agentId },
        rootAgentId: state.rootAgentId ?? agentId,
        eventLog: log,
      };
    }

    case 'agent_started': {
      const agentId = event.agentId!;
      return {
        ...state,
        agents: {
          ...state.agents,
          [agentId]: { ...state.agents[agentId], status: 'running' },
        },
        eventLog: log,
      };
    }

    case 'agent_complete': {
      const agentId = event.agentId!;
      return {
        ...state,
        agents: {
          ...state.agents,
          [agentId]: {
            ...state.agents[agentId],
            status: 'complete',
            tokensUsed: event.data.tokensUsed as number,
            completedAt: event.timestamp,
          },
        },
        eventLog: log,
      };
    }

    case 'agent_error': {
      const agentId = event.agentId!;
      return {
        ...state,
        agents: {
          ...state.agents,
          [agentId]: { ...state.agents[agentId], status: 'error', completedAt: event.timestamp },
        },
        error: event.data.error as string,
        eventLog: log,
      };
    }

    case 'tool_called': {
      const record: ToolCallRecord = {
        agentId: event.agentId!,
        agentRole: event.agentRole!,
        tool: event.data.tool as string,
        input: event.data.input as Record<string, unknown>,
        calledAt: event.timestamp,
      };
      // Eagerly capture write_state values so StateExplorer/ArtifactBrowser have data
      const toolInput = event.data.input as Record<string, unknown>;
      const newEntityState =
        event.data.tool === 'write_state' && toolInput.key
          ? { ...state.entityState, [toolInput.key as string]: toolInput.value }
          : state.entityState;
      return {
        ...state,
        toolCalls: [...state.toolCalls.slice(-100), record],
        entityState: newEntityState,
        eventLog: log,
      };
    }

    case 'tool_result': {
      const last = [...state.toolCalls];
      const idx = last.findLastIndex(tc => tc.agentId === event.agentId && tc.tool === event.data.tool);
      if (idx !== -1) {
        last[idx] = { ...last[idx], result: event.data.result };
      }
      return { ...state, toolCalls: last, eventLog: log };
    }

    case 'state_updated': {
      // Rebuild entityState from toolCalls that are write_state
      return { ...state, eventLog: log };
    }

    case 'consensus_started': {
      const id = (event.data.decisionId as string) ?? crypto.randomUUID();
      return {
        ...state,
        consensus: {
          ...state.consensus,
          [id]: {
            decisionId: id,
            topic: event.data.topic as string,
            stakeholderRoles: event.data.stakeholderRoles as string[],
            votes: [],
            status: 'in-progress',
            openedAt: event.timestamp,
          },
        },
        eventLog: log,
      };
    }

    case 'consensus_vote': {
      const decisionId = event.data.decisionId as string;
      const existing = state.consensus[decisionId];
      if (!existing) return { ...state, eventLog: log };
      return {
        ...state,
        consensus: {
          ...state.consensus,
          [decisionId]: {
            ...existing,
            votes: [
              ...existing.votes,
              {
                role: event.agentRole!,
                position: event.data.position as string,
                confidence: event.data.confidence as number,
                round: event.data.round as number,
              },
            ],
          },
        },
        eventLog: log,
      };
    }

    case 'consensus_resolved': {
      const decisionId = event.data.decisionId as string;
      return {
        ...state,
        consensus: {
          ...state.consensus,
          [decisionId]: {
            ...(state.consensus[decisionId] ?? { topic: '', votes: [], openedAt: event.timestamp }),
            outcome: event.data.outcome as string,
            decidedBy: event.data.decidedBy as 'consensus' | 'parent',
            status: 'resolved',
          },
        },
        eventLog: log,
      };
    }

    case 'human_input_requested': {
      return {
        ...state,
        pendingInput: {
          requestId: event.data.requestId as string,
          question: event.data.question as string,
          agentRole: event.agentRole ?? 'agent',
        },
        eventLog: log,
      };
    }

    case 'cost_update':
    case 'cost_warning':
    case 'budget_exceeded':
      return {
        ...state,
        cost: event.data.cost as CostSnapshot,
        eventLog: log,
      };

    default:
      return { ...state, eventLog: log };
  }
}

export function useHarnessSession() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const clearPendingInput = useCallback(() => {
    dispatch({ type: 'CLEAR_PENDING_INPUT' });
  }, []);

  const startSession = useCallback(async (
    entityType: EntityType,
    input: Record<string, unknown>
  ) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    dispatch({ type: 'RESET' });

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, input }),
        signal: abort.signal,
      });

      if (!response.body) return;

      await consumeHarnessSSE<HarnessEvent>(response, (event) => {
        dispatch({ type: 'HARNESS_EVENT', event });
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      dispatch({
        type: 'HARNESS_EVENT',
        event: {
          type: 'error',
          sessionId: 'unknown',
          data: { message: String(err) },
          timestamp: new Date().toISOString(),
        },
      });
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: 'RESET' });
  }, []);

  return { state, startSession, reset, clearPendingInput };
}
