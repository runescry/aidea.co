import type Anthropic from '@anthropic-ai/sdk';
import type { HarnessTool, HarnessAgent, HarnessContext, ToolInput } from './types';
import { getAgentByRole, allAgentsInStatus, patchAgent } from './registry';
import { setStateKey, getStateKeys } from './state';
import { runConsensus } from './consensus';

// ── Tool Catalog ──────────────────────────────────────────────────────────────

export const HARNESS_TOOLS: Record<string, HarnessTool> = {
  spawn_agent: {
    key: 'spawn_agent',
    name: 'spawn_agent',
    description: 'Spawn a new child agent with a specific role and mission. The agent starts immediately in the background.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Agent role ID from the library (e.g. "cpo", "health-director")' },
        domain: { type: 'string', description: 'Domain this agent operates in (e.g. "product", "health")' },
        mission: { type: 'string', description: 'The specific task or mission for this agent' },
        authority: { type: 'string', enum: ['directive', 'advisory', 'executor'], description: 'Authority level' },
      },
      required: ['role', 'domain', 'mission'],
    },
  },

  wait_for_agents: {
    key: 'wait_for_agents',
    name: 'wait_for_agents',
    description: 'Wait until all agents with the given roles have completed. Returns their outputs from entity state.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        roles: { type: 'array', items: { type: 'string' }, description: 'List of agent roles to wait for' },
        timeoutMs: { type: 'number', description: 'Max ms to wait (default: 120000)' },
      },
      required: ['roles'],
    },
  },

  write_state: {
    key: 'write_state',
    name: 'write_state',
    description: 'Write a value to entity state. Use this to persist your output.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'State key to write to' },
        value: { description: 'The value to store (any JSON-serialisable object)' },
      },
      required: ['key', 'value'],
    },
  },

  read_state: {
    key: 'read_state',
    name: 'read_state',
    description: 'Read values from entity state by key.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        keys: { type: 'array', items: { type: 'string' }, description: 'State keys to read' },
      },
      required: ['keys'],
    },
  },

  request_consensus: {
    key: 'request_consensus',
    name: 'request_consensus',
    description: 'Run a consensus protocol between agents on a topic. Waits for resolution and returns the outcome.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'What is being decided' },
        stakeholderRoles: { type: 'array', items: { type: 'string' }, description: 'Roles of agents who vote' },
        contextKeys: { type: 'array', items: { type: 'string' }, description: 'State keys to include as context' },
      },
      required: ['topic', 'stakeholderRoles', 'contextKeys'],
    },
  },

  send_message: {
    key: 'send_message',
    name: 'send_message',
    description: 'Send a message to another agent by role.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        toRole: { type: 'string', description: 'Role of the recipient agent' },
        type: { type: 'string', enum: ['inform', 'request', 'flag', 'delegate', 'escalate', 'vote'] },
        topic: { type: 'string', description: 'Message topic/subject' },
        content: { type: 'string', description: 'Message content' },
      },
      required: ['toRole', 'type', 'topic', 'content'],
    },
  },

  // Real-world tools (gated — default dry-run)
  gmail_send: {
    key: 'gmail_send',
    name: 'gmail_send',
    description: 'Send an email. GATED: requires real-world tool approval.',
    requiresApproval: true,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  github_commit: {
    key: 'github_commit',
    name: 'github_commit',
    description: 'Commit a file to a GitHub repository. GATED: requires real-world tool approval.',
    requiresApproval: true,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string' },
        path: { type: 'string' },
        content: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['repo', 'path', 'content', 'message'],
    },
  },

  calendar_create: {
    key: 'calendar_create',
    name: 'calendar_create',
    description: 'Create a calendar event. GATED: requires real-world tool approval.',
    requiresApproval: true,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'ISO datetime' },
        durationMinutes: { type: 'number' },
        description: { type: 'string' },
      },
      required: ['title', 'start', 'durationMinutes'],
    },
  },
};

// ── Convert tool keys to Anthropic Tool format ────────────────────────────────

export function buildAnthropicTools(toolKeys: string[]): Anthropic.Tool[] {
  return toolKeys
    .map(k => HARNESS_TOOLS[k])
    .filter(Boolean)
    .map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    }));
}

// ── Tool Executor ─────────────────────────────────────────────────────────────

export async function executeHarnessTool(
  client: Anthropic,
  toolName: string,
  input: ToolInput,
  callerAgent: HarnessAgent,
  ctx: HarnessContext,
  spawnAgent: (role: string, domain: string, mission: string, authority: string, parentAgent: HarnessAgent) => Promise<{ agentId: string }>
): Promise<unknown> {
  ctx.cost.recordToolCall();

  const tool = Object.values(HARNESS_TOOLS).find(t => t.name === toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);

  // Gate real-world tools
  if (tool.realWorld && ctx.config.costConfig?.realWorldToolMode === 'dry-run') {
    return {
      dryRun: true,
      message: `[DRY RUN] Would execute ${toolName} with: ${JSON.stringify(input)}`,
      input,
    };
  }

  switch (toolName) {
    case 'spawn_agent': {
      const { role, domain, mission, authority = 'executor' } = input as {
        role: string; domain: string; mission: string; authority?: string;
      };

      if (!ctx.cost.canSpawnAgent()) {
        return { error: 'Agent limit reached. Cannot spawn more agents.' };
      }
      if (!ctx.cost.canSpawnAtTier(callerAgent.tier + 1)) {
        return { error: `Depth limit reached. Cannot spawn agents below tier ${ctx.config.costConfig?.maxTierDepth ?? 4}.` };
      }

      ctx.send({
        type: 'agent_spawned',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: callerAgent.id,
        agentRole: callerAgent.role,
        data: { spawnedRole: role, domain, mission },
        timestamp: new Date().toISOString(),
      });

      const result = await spawnAgent(role, domain, mission, authority, callerAgent);
      return result;
    }

    case 'wait_for_agents': {
      const { roles, timeoutMs = 120_000 } = input as { roles: string[]; timeoutMs?: number };
      const deadline = Date.now() + timeoutMs;

      // Poll until all target roles have complete agents
      while (Date.now() < deadline) {
        const allDone = roles.every(role => {
          const agent = getAgentByRole(ctx.registry, role);
          return agent?.status === 'complete';
        });

        if (allDone) {
          // Collect their outputs from state
          const outputs: Record<string, unknown> = {};
          for (const role of roles) {
            const agent = getAgentByRole(ctx.registry, role);
            if (agent?.stateWriteKey) {
              outputs[role] = ctx.state.data[agent.stateWriteKey] ?? null;
            }
          }
          return { status: 'complete', outputs };
        }

        await new Promise(r => setTimeout(r, 500));
      }

      return { status: 'timeout', roles, message: `Timed out waiting for roles: ${roles.join(', ')}` };
    }

    case 'write_state': {
      const { key, value } = input as { key: string; value: unknown };
      await setStateKey(ctx.state, key, value);
      ctx.send({
        type: 'state_updated',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: callerAgent.id,
        agentRole: callerAgent.role,
        data: { key, valueType: typeof value },
        timestamp: new Date().toISOString(),
      });
      return { success: true, key };
    }

    case 'read_state': {
      const { keys } = input as { keys: string[] };
      return getStateKeys(ctx.state, keys);
    }

    case 'request_consensus': {
      const { topic, stakeholderRoles, contextKeys } = input as {
        topic: string; stakeholderRoles: string[]; contextKeys: string[];
      };
      const result = await runConsensus(
        client, ctx, stakeholderRoles, topic, contextKeys, callerAgent.role
      );
      return { outcome: result.outcome, decidedBy: result.decidedBy, rounds: result.rounds };
    }

    case 'send_message': {
      const { toRole, type, topic, content } = input as {
        toRole: string; type: string; topic: string; content: string;
      };
      const msg = {
        id: crypto.randomUUID(),
        type: type as import('./types').MessageType,
        fromAgentId: callerAgent.id,
        fromRole: callerAgent.role,
        toRole,
        topic,
        content,
        requiresResponse: false,
        sentAt: new Date().toISOString(),
      };
      ctx.send({
        type: 'message_sent',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: callerAgent.id,
        agentRole: callerAgent.role,
        data: { toRole, messageType: type, topic },
        timestamp: new Date().toISOString(),
      });
      return { messageId: msg.id, delivered: true };
    }

    default:
      return { error: `Tool ${toolName} not yet implemented` };
  }
}
