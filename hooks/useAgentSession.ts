'use client';
import { useReducer, useRef, useCallback } from 'react';
import type { AppState, SSEEvent, AgentId, RunMode, AgentState, LeadOutputs } from '@/types';

const ALL_AGENTS: AgentId[] = [
  'ceo', 'cpo', 'cmo', 'cto', 'cfo',
  'conflict_detector',
  'copywriter', 'outreach', 'pricing', 'research',
];

function makeInitialState(): AppState {
  const agents = Object.fromEntries(
    ALL_AGENTS.map(id => [id, { id, status: 'idle' as const, streamBuffer: '' }])
  ) as Record<AgentId, AgentState>;

  return {
    sessionId: null,
    idea: '',
    mode: 'full_auto',
    isRunning: false,
    isPaused: false,
    companyIdentity: null,
    directive: null,
    leadOutputs: {},
    conflictReport: null,
    artifacts: {},
    cycle2Directive: null,
    agents,
    streamLog: [],
    error: null,
  };
}

type Action =
  | { type: 'SSE_EVENT'; event: SSEEvent }
  | { type: 'RESET' }
  | { type: 'SET_IDEA'; idea: string }
  | { type: 'SET_MODE'; mode: RunMode };

function reducer(state: AppState, action: Action): AppState {
  if (action.type === 'RESET') return makeInitialState();
  if (action.type === 'SET_IDEA') return { ...state, idea: action.idea };
  if (action.type === 'SET_MODE') return { ...state, mode: action.mode };

  const { event } = action;
  const log = [...state.streamLog, event];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = event.data as any;

  const updateAgent = (id: AgentId, patch: Partial<AgentState>): AppState => ({
    ...state,
    streamLog: log,
    agents: { ...state.agents, [id]: { ...state.agents[id], ...patch } },
  });

  switch (event.type) {
    case 'session_start':
      return { ...state, isRunning: true, isPaused: false, sessionId: d.sessionId, streamLog: log };

    case 'ceo_identity_start':
      return updateAgent('ceo', { status: 'running', streamBuffer: '' });

    case 'ceo_identity_complete':
      return { ...state, streamLog: log, companyIdentity: d.companyIdentity };

    case 'ceo_directive_start':
      return updateAgent('ceo', { streamBuffer: '' });

    case 'ceo_directive_complete':
      return { ...state, streamLog: log, directive: d.directive };

    case 'lead_start': {
      const id = event.agent;
      if (id && id !== 'ceo') return updateAgent(id, { status: 'running', streamBuffer: '' });
      return { ...state, streamLog: log };
    }

    case 'lead_stream_chunk': {
      const id = event.agent!;
      return updateAgent(id, { streamBuffer: state.agents[id].streamBuffer + d.chunk });
    }

    case 'lead_complete': {
      const id = event.agent! as keyof LeadOutputs;
      return {
        ...updateAgent(event.agent!, { status: 'complete', streamBuffer: '', completedAt: event.timestamp }),
        leadOutputs: { ...state.leadOutputs, [id]: d.output },
      };
    }

    case 'all_leads_complete':
      return { ...state, streamLog: log };

    case 'conflict_checking':
      return updateAgent('conflict_detector', { status: 'running', streamBuffer: '' });

    case 'conflict_result':
      return {
        ...updateAgent('conflict_detector', { status: 'complete', completedAt: event.timestamp }),
        conflictReport: d.conflictReport,
      };

    case 'ceo_arbitration_start':
      return updateAgent('ceo', { status: 'running', streamBuffer: '' });

    case 'ceo_arbitration_complete':
      return { ...state, streamLog: log, conflictReport: d.conflictReport };

    case 'working_group_start':
      return updateAgent(event.agent!, { status: 'running', streamBuffer: '' });

    case 'working_group_stream_chunk': {
      const id = event.agent!;
      return updateAgent(id, { streamBuffer: state.agents[id].streamBuffer + d.chunk });
    }

    case 'working_group_complete': {
      const id = event.agent! as 'copywriter' | 'outreach' | 'pricing' | 'research';
      return {
        ...updateAgent(event.agent!, { status: 'complete', streamBuffer: '', completedAt: event.timestamp }),
        artifacts: { ...state.artifacts, [id]: d.artifact },
      };
    }

    case 'all_working_groups_complete':
      return { ...state, streamLog: log };

    case 'ceo_review_start':
      return updateAgent('ceo', { status: 'running', streamBuffer: '' });

    case 'ceo_cycle2_complete':
      return {
        ...updateAgent('ceo', { status: 'complete', completedAt: event.timestamp }),
        cycle2Directive: d.directive,
        streamLog: log,
      };

    case 'session_complete':
      return { ...state, isRunning: false, streamLog: log };

    case 'session_paused':
      return {
        ...state,
        isRunning: false,
        isPaused: true,
        sessionId: d.sessionId ?? state.sessionId,
        streamLog: log,
      };

    case 'error':
      return {
        ...state,
        isRunning: false,
        error: d.message,
        streamLog: log,
        agents: event.agent
          ? { ...state.agents, [event.agent]: { ...state.agents[event.agent], status: 'error' as const } }
          : state.agents,
      };

    default:
      return { ...state, streamLog: log };
  }
}

async function consumeSSEStream(response: Response, dispatch: (a: Action) => void): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const line = block.trim();
      if (line.startsWith('data: ')) {
        try {
          const event: SSEEvent = JSON.parse(line.slice(6));
          dispatch({ type: 'SSE_EVENT', event });
        } catch {
          // malformed chunk — skip
        }
      }
    }
  }
}

export function useAgentSession() {
  const [state, dispatch] = useReducer(reducer, makeInitialState());
  const abortRef = useRef<AbortController | null>(null);

  const startSession = useCallback(async (idea: string, mode: RunMode) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_IDEA', idea });
    dispatch({ type: 'SET_MODE', mode });

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, mode }),
        signal: controller.signal,
      });
      await consumeSSEStream(response, dispatch);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        dispatch({
          type: 'SSE_EVENT',
          event: {
            type: 'error',
            sessionId: 'unknown',
            cycleNumber: 0,
            data: { message: String(err) },
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  }, []);

  const resumeSession = useCallback(async (sessionId: string, idea: string) => {
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, mode: 'full_auto', sessionId }),
      });
      await consumeSSEStream(response, dispatch);
    } catch (err) {
      dispatch({
        type: 'SSE_EVENT',
        event: {
          type: 'error',
          sessionId,
          cycleNumber: 0,
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

  const setIdea = useCallback((idea: string) => dispatch({ type: 'SET_IDEA', idea }), []);
  const setMode = useCallback((mode: RunMode) => dispatch({ type: 'SET_MODE', mode }), []);

  return { state, startSession, resumeSession, reset, setIdea, setMode };
}
