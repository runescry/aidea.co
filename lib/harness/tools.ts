import type { HarnessTool, HarnessAgent, HarnessContext, ToolInput } from './types';
import { getAgentByRole } from './registry';
import { setStateKey, getStateKeys } from './state';
import { readKB, writeKB } from './knowledge-base';
import { enqueueAction } from './queue';
import { runConsensus } from './consensus';
import { awaitHumanInput, markPendingInput } from './pending-inputs';
import { getSetting } from '@/lib/settings';
import { readGmailMessages, sendGmailMessage } from '@/lib/nango/gmail';
import { readCalendarEvents, createCalendarEvent } from '@/lib/nango/calendar';
import { getNango, gmailIntegrationId } from '@/lib/nango/client';
import { listGmailConnections } from '@/lib/nango/connections';
import {
  buildKbPatch,
  applyKbPatch,
  getKbAutonomy,
  shouldAutoApplyKb,
  formatKbPatchSummary,
  normalizeKbPatchInput,
  type KbPatchInput,
} from './kb-updates';
import { emitChatAgentResponse } from './chat-events';

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
        role: { type: 'string', description: 'Agent role ID from the library (alias: agentId), e.g. "inbox-triage"' },
        domain: { type: 'string', description: 'Domain this agent operates in (optional — defaults from role)' },
        mission: { type: 'string', description: 'The specific task or mission for this agent' },
        authority: { type: 'string', enum: ['directive', 'advisory', 'executor'], description: 'Authority level' },
      },
      required: ['role', 'mission'],
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
        roles: { type: 'array', items: { type: 'string' }, description: 'Agent role ids to wait for (alias: ids)' },
        ids: { type: 'array', items: { type: 'string' }, description: 'Alias for roles' },
        timeoutMs: { type: 'number', description: 'Max ms to wait (default: 120000)' },
      },
      required: ['roles'],
    },
  },

  write_state: {
    key: 'write_state',
    name: 'write_state',
    description: 'Write a value to entity state. Use this to persist your output so other agents can read it.',
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
    description: 'Send a message to another agent by role. The recipient will see it in their next loop turn.',
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

  kb_read: {
    key: 'kb_read',
    name: 'kb_read',
    description: 'Read values from the personal knowledge base. Supports dot-notation keys like "family.children" or "health.workoutSchedule".',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        keys: { type: 'array', items: { type: 'string' }, description: 'KB keys to read (dot-notation supported)' },
      },
      required: ['keys'],
    },
  },

  kb_write: {
    key: 'kb_write',
    name: 'kb_write',
    description: 'Write a value to the personal knowledge base directly (no approval queue). Prefer update_kb for profile changes unless you need a raw dot-key write.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'KB key to write (dot-notation supported)' },
        value: { description: 'Value to store' },
      },
      required: ['key', 'value'],
    },
  },

  update_kb: {
    key: 'update_kb',
    name: 'update_kb',
    description: 'Update the user profile/knowledge base. Job applications, goals, contacts, work context, etc. In semi-autonomous/supervised mode queues for user approval; in autonomous mode applies immediately. Always kb_read relevant keys first.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One-line summary for the user, e.g. "Anthropic → Offer received"' },
        reason: { type: 'string', description: 'Why this update (e.g. email from Natalie Mead, user said in chat)' },
        updates: { type: 'object', description: 'Top-level KB sections to merge, e.g. { "work": { "careerFocus": "..." } }' },
        jobApplication: {
          type: 'object',
          description: 'Update a job application by company name',
          properties: {
            company: { type: 'string' },
            role: { type: 'string' },
            status: { type: 'string' },
            nextAction: { type: 'string' },
            priority: { type: 'number' },
          },
          required: ['company'],
        },
        key: { type: 'string', description: 'Dot-notation key for a single-field update' },
        value: { description: 'Value when using key' },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] },
        requireApproval: { type: 'boolean', description: 'Force approval queue even in autonomous mode' },
      },
      required: ['summary'],
    },
  },

  queue_action: {
    key: 'queue_action',
    name: 'queue_action',
    description: 'Queue a proposed action for user approval. Use this instead of executing real-world actions directly. The user will approve, edit, or reject from the Action Queue.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['email_reply', 'email_send', 'calendar_event', 'task', 'reminder', 'message', 'alert', 'kb_update', 'generic'] },
        summary: { type: 'string', description: 'One-line summary shown to user: "Reply to Sarah: declining budget meeting"' },
        detail: { type: 'string', description: 'Full draft content or detailed description' },
        tool: { type: 'string', description: 'Harness tool to execute on approval (e.g. "gmail_send")' },
        payload: { type: 'object', description: 'Tool input to execute on approval' },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] },
      },
      required: ['type', 'summary', 'tool', 'payload'],
    },
  },

  request_human_input: {
    key: 'request_human_input',
    name: 'request_human_input',
    description: 'Pause and ask the user a question. The agent waits until the user responds. Use in supervised mode when you need information only the user has.',
    requiresApproval: false,
    realWorld: false,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The question to ask the user' },
        context: { type: 'string', description: 'Why you need this information' },
        timeoutMs: { type: 'number', description: 'Max ms to wait (default: 300000 = 5 minutes)' },
      },
      required: ['prompt'],
    },
  },

  // ── Real-world connectors (gated — check dry-run before executing) ────────────

  web_search: {
    key: 'web_search',
    name: 'web_search',
    description: 'Search the web using Brave Search. Returns titles, URLs, and snippets.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results to return (default: 5)' },
      },
      required: ['query'],
    },
  },

  web_fetch: {
    key: 'web_fetch',
    name: 'web_fetch',
    description: 'Fetch a URL and return its text content. HTML is stripped. Useful for reading articles, docs, or pages found via web_search.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },

  news_search: {
    key: 'news_search',
    name: 'news_search',
    description: 'Search for recent news (past 24 hours) on given topics. Returns headlines with source and snippet.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        topics: { type: 'array', items: { type: 'string' }, description: 'Topics to search news for' },
        maxPerTopic: { type: 'number', description: 'Max results per topic (default: 3)' },
      },
      required: ['topics'],
    },
  },

  gmail_read: {
    key: 'gmail_read',
    name: 'gmail_read',
    description: 'Read emails from Gmail. Returns sender, subject, snippet, and date.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query (e.g. "is:unread", "from:boss@company.com")' },
        maxResults: { type: 'number', description: 'Max emails to return per account (default: 5)' },
        connectionId: { type: 'string', description: 'Optional — one connected Gmail account; omit for all' },
      },
      required: [],
    },
  },

  gmail_draft: {
    key: 'gmail_draft',
    name: 'gmail_draft',
    description: 'Create an email draft and queue it for user approval. Does not send automatically.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (plain text or HTML)' },
        replyToMessageId: { type: 'string', description: 'Gmail message ID if this is a reply' },
        connectionId: { type: 'string', description: 'Nango connection to send from' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  gmail_send: {
    key: 'gmail_send',
    name: 'gmail_send',
    description: 'Send an email immediately. Prefer gmail_draft unless explicitly asked to send.',
    requiresApproval: true,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        connectionId: { type: 'string', description: 'Nango connection to send from' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  calendar_read: {
    key: 'calendar_read',
    name: 'calendar_read',
    description: 'Read upcoming calendar events. Returns title, time, attendees, and location.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date to start from (default: today)' },
        daysAhead: { type: 'number', description: 'Number of days to look ahead (default: 1)' },
        maxResults: { type: 'number', description: 'Max events to return per calendar (default: 20)' },
        connectionId: { type: 'string', description: 'Optional — one connected calendar account' },
      },
      required: [],
    },
  },

  calendar_draft: {
    key: 'calendar_draft',
    name: 'calendar_draft',
    description: 'Propose a calendar event and queue it for user approval. Does not create it automatically.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'ISO datetime' },
        durationMinutes: { type: 'number' },
        description: { type: 'string' },
        attendees: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'start', 'durationMinutes'],
    },
  },

  calendar_create: {
    key: 'calendar_create',
    name: 'calendar_create',
    description: 'Create a calendar event immediately. Prefer calendar_draft unless explicitly asked.',
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

  contacts_read: {
    key: 'contacts_read',
    name: 'contacts_read',
    description: 'Read contacts from Google Contacts / People API. Returns name, email, last interaction date, and notes.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to filter contacts (optional)' },
        maxResults: { type: 'number', description: 'Max contacts to return (default: 20)' },
      },
      required: [],
    },
  },

  document_parse: {
    key: 'document_parse',
    name: 'document_parse',
    description: 'Fetch and extract text from a document URL (PDF, HTML, or plain text). Returns extracted text up to 8000 chars.',
    requiresApproval: false,
    realWorld: true,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the document to parse' },
        focus: { type: 'string', description: 'What to look for: "key-dates", "obligations", "risks", "summary" or custom' },
      },
      required: ['url'],
    },
  },
};

// ── Tool Executor ─────────────────────────────────────────────────────────────

export async function executeHarnessTool(
  toolName: string,
  input: ToolInput,
  callerAgent: HarnessAgent,
  ctx: HarnessContext,
  spawnAgent: (role: string, domain: string, mission: string, authority: string, parentAgent: HarnessAgent) => Promise<{ agentId: string }>
): Promise<unknown> {
  ctx.cost.recordToolCall();

  const tool = Object.values(HARNESS_TOOLS).find(t => t.name === toolName);
  if (!tool) return { error: `Unknown tool: ${toolName}` };

  // Gate real-world tools in dry-run mode — return plausible mock data so agents can still reason
  if (tool.realWorld && ctx.config.costConfig?.realWorldToolMode === 'dry-run') {
    return getDryRunResponse(toolName, input);
  }

  switch (toolName) {
    // ── Core coordination ──────────────────────────────────────────────────────

    case 'spawn_agent': {
      const raw = input as {
        role?: string;
        agentId?: string;
        domain?: string;
        mission?: string;
        authority?: string;
      };
      const role = raw.role ?? raw.agentId;
      if (!role) return { error: 'spawn_agent requires role (agent library id, e.g. "inbox-triage")' };
      const mission = raw.mission;
      if (!mission) return { error: 'spawn_agent requires mission' };
      const domain = raw.domain ?? role.split('-')[0] ?? 'general';
      const authority = raw.authority ?? 'executor';
      if (!ctx.cost.canSpawnAgent()) return { error: 'Agent limit reached.' };
      if (!ctx.cost.canSpawnAtTier(callerAgent.tier + 1)) return { error: 'Depth limit reached.' };

      const result = await spawnAgent(role, domain, mission, authority, callerAgent);
      ctx.send({
        type: 'agent_spawned',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: result.agentId,
        agentRole: role,
        data: { tier: callerAgent.tier + 1, domain, parentId: callerAgent.id },
        timestamp: new Date().toISOString(),
      });
      return result;
    }

    case 'wait_for_agents': {
      const raw = input as { roles?: string[]; ids?: string[]; timeoutMs?: number };
      const roles = raw.roles ?? raw.ids ?? [];
      if (roles.length === 0) return { error: 'wait_for_agents requires roles (agent ids to wait for)' };
      const { timeoutMs = 120_000 } = raw;
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const allDone = roles.every(role => getAgentByRole(ctx.registry, role)?.status === 'complete');
        if (allDone) {
          const outputs: Record<string, unknown> = {};
          for (const role of roles) {
            const agent = getAgentByRole(ctx.registry, role);
            if (agent?.stateWriteKey) outputs[role] = ctx.state.data[agent.stateWriteKey] ?? null;
          }
          return { status: 'complete', outputs };
        }
        await new Promise(r => setTimeout(r, 500));
      }
      return { status: 'timeout', roles };
    }

    case 'write_state': {
      const { key, value } = input as { key: string; value: unknown };
      await setStateKey(ctx.state, key, value, {
        persist: !ctx.config.deferStatePersist,
      });
      emitChatAgentResponse(ctx, callerAgent, key, value);
      ctx.send({
        type: 'state_updated',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: callerAgent.id,
        agentRole: callerAgent.role,
        data: { key, value, valueType: typeof value },
        timestamp: new Date().toISOString(),
      });
      return { ok: true, key };
    }

    case 'read_state':
      return getStateKeys(ctx.state, (input as { keys: string[] }).keys);

    case 'request_consensus': {
      const { topic, stakeholderRoles, contextKeys } = input as {
        topic: string; stakeholderRoles: string[]; contextKeys: string[];
      };
      const result = await runConsensus(ctx, stakeholderRoles, topic, contextKeys, callerAgent.role);
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
      ctx.bus.publish(msg);
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

    // ── Knowledge Base ─────────────────────────────────────────────────────────

    case 'kb_read':
      return await readKB((input as { keys: string[] }).keys);

    case 'kb_write': {
      const { key, value } = input as { key: string; value: unknown };
      await writeKB(key, value);
      return { ok: true, key };
    }

    case 'update_kb': {
      const patchInput = input as unknown as KbPatchInput & {
        summary: string;
        reason?: string;
        priority?: import('./queue').QueuedAction['priority'];
        requireApproval?: boolean;
      };

      const normalized = normalizeKbPatchInput(patchInput);
      const patch = await buildKbPatch(normalized);
      if (Object.keys(patch).length === 0 && normalized.key === undefined) {
        return {
          error: 'No profile fields to update — pass jobApplication, updates, or key/value',
        };
      }
      const autonomy = await getKbAutonomy();
      const autoApply = shouldAutoApplyKb(autonomy, patchInput.requireApproval);

      if (autoApply) {
        await applyKbPatch(normalized);
        ctx.send({
          type: 'state_updated',
          sessionId: ctx.sessionId,
          entityId: ctx.entityId,
          agentId: callerAgent.id,
          agentRole: callerAgent.role,
          data: { kbUpdated: true, summary: patchInput.summary, applied: true },
          timestamp: new Date().toISOString(),
        });
        return { ok: true, applied: true, summary: patchInput.summary };
      }

      const action = await enqueueAction({
        type: 'kb_update',
        summary: patchInput.summary || formatKbPatchSummary(normalized),
        detail: patchInput.reason,
        tool: 'update_kb',
        payload: {
          patch,
          input: {
            jobApplication: normalized.jobApplication,
            updates: normalized.updates,
            key: normalized.key,
            value: normalized.value,
          },
          reason: patchInput.reason,
          source: callerAgent.role,
        },
        priority: patchInput.priority ?? 'normal',
        agentRole: callerAgent.role,
        entityId: ctx.entityId,
      });
      ctx.send({
        type: 'state_updated',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: callerAgent.id,
        agentRole: callerAgent.role,
        data: { queuedActionId: action.id, summary: action.summary, kbQueued: true },
        timestamp: new Date().toISOString(),
      });
      return { ok: true, queued: true, actionId: action.id, summary: action.summary };
    }

    // ── Action Queue ───────────────────────────────────────────────────────────

    case 'queue_action': {
      const { type, summary, detail, tool: execTool, payload, priority = 'normal' } = input as {
        type: import('./queue').ActionType;
        summary: string;
        detail?: string;
        tool: string;
        payload: Record<string, unknown>;
        priority?: import('./queue').QueuedAction['priority'];
      };
      const action = await enqueueAction({
        type, summary, detail, tool: execTool, payload, priority,
        agentRole: callerAgent.role,
        entityId: ctx.entityId,
      });
      ctx.send({
        type: 'state_updated',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: callerAgent.id,
        agentRole: callerAgent.role,
        data: { queuedActionId: action.id, summary },
        timestamp: new Date().toISOString(),
      });
      return { ok: true, actionId: action.id, summary };
    }

    // ── Human input ───────────────────────────────────────────────────────────

    case 'request_human_input': {
      const { prompt, context, timeoutMs = 300_000 } = input as {
        prompt: string; context?: string; timeoutMs?: number;
      };
      const requestId = crypto.randomUUID();
      ctx.send({
        type: 'human_input_requested',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: callerAgent.id,
        agentRole: callerAgent.role,
        data: { requestId, prompt, context: context ?? '' },
        timestamp: new Date().toISOString(),
      });
      await markPendingInput(requestId);
      try {
        const userInput = await awaitHumanInput(requestId, timeoutMs);
        return { userInput, requestId };
      } catch {
        return { timedOut: true, requestId };
      }
    }

    // ── Web / search ──────────────────────────────────────────────────────────

    case 'web_search': {
      const { query, maxResults = 5 } = input as { query: string; maxResults?: number };
      const apiKey = getSetting('braveSearchApiKey');
      if (!apiKey) return { error: 'Brave Search API key not configured — add it in Settings', query };
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey } });
      if (!res.ok) return { error: `Brave API error: ${res.status}`, query };
      const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
      const results = (data.web?.results ?? []).map(r => ({ title: r.title, url: r.url, snippet: r.description }));
      return { query, results };
    }

    case 'web_fetch': {
      const { url } = input as { url: string };
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AideaBot/1.0)' } });
      if (!res.ok) return { error: `HTTP ${res.status}`, url };
      const html = await res.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 6000);
      return { url, text, truncated: html.length > 6000 };
    }

    case 'news_search': {
      const { topics, maxPerTopic = 3 } = input as { topics: string[]; maxPerTopic?: number };
      const apiKey = getSetting('braveSearchApiKey');
      if (!apiKey) return { error: 'Brave Search API key not configured — add it in Settings' };
      const allResults: Array<{ topic: string; title: string; url: string; snippet: string }> = [];
      for (const topic of topics) {
        const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(topic)}&count=${maxPerTopic}&freshness=pd`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey } });
        if (!res.ok) continue;
        const data = await res.json() as { results?: Array<{ title: string; url: string; description: string }> };
        for (const r of data.results ?? []) {
          allResults.push({ topic, title: r.title, url: r.url, snippet: r.description });
        }
      }
      return { results: allResults };
    }

    // ── Gmail ─────────────────────────────────────────────────────────────────

    case 'gmail_read': {
      const { query = 'is:unread', maxResults = 5, connectionId } = input as {
        query?: string; maxResults?: number; connectionId?: string;
      };
      try {
        const result = await readGmailMessages({ query, maxResults, connectionId });
        return {
          ...result,
          emails: result.emails.map(e => ({
            id: e.id,
            from: e.from,
            subject: e.subject,
            date: e.date,
            snippet: e.snippet.slice(0, 180),
            isUnread: e.isUnread,
            account: e.account,
          })),
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    case 'gmail_draft': {
      const { to, subject, body, replyToMessageId, connectionId } = input as {
        to: string; subject: string; body: string; replyToMessageId?: string; connectionId?: string;
      };
      const action = await enqueueAction({
        type: 'email_reply',
        summary: `Email to ${to}: ${subject}`,
        detail: body,
        tool: 'gmail_send',
        payload: { to, subject, body, replyToMessageId, connectionId },
        priority: 'normal',
        agentRole: callerAgent.role,
        entityId: ctx.entityId,
      });
      ctx.send({
        type: 'state_updated',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        agentId: callerAgent.id,
        agentRole: callerAgent.role,
        data: { queuedActionId: action.id, summary: action.summary },
        timestamp: new Date().toISOString(),
      });
      return { ok: true, queued: true, actionId: action.id, summary: action.summary };
    }

    case 'gmail_send': {
      const { to, subject, body, connectionId } = input as {
        to: string; subject: string; body: string; connectionId?: string;
      };
      try {
        return await sendGmailMessage({ to, subject, body, connectionId });
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // ── Calendar ──────────────────────────────────────────────────────────────

    case 'calendar_read': {
      const { date, daysAhead = 1, maxResults = 20, connectionId } = input as {
        date?: string; daysAhead?: number; maxResults?: number; connectionId?: string;
      };
      try {
        return await readCalendarEvents({ date, daysAhead, maxResults, connectionId });
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    case 'calendar_draft': {
      const { title, start, durationMinutes, description, attendees } = input as {
        title: string; start: string; durationMinutes: number; description?: string; attendees?: string[];
      };
      const action = await enqueueAction({
        type: 'calendar_event',
        summary: `Calendar: ${title} at ${start}`,
        detail: description,
        tool: 'calendar_create',
        payload: { title, start, durationMinutes, description, attendees },
        priority: 'normal',
        agentRole: callerAgent.role,
        entityId: ctx.entityId,
      });
      return { ok: true, queued: true, actionId: action.id, summary: action.summary };
    }

    case 'calendar_create': {
      const { title, start, durationMinutes, description, attendees } = input as {
        title: string; start: string; durationMinutes: number; description?: string; attendees?: string[];
      };
      try {
        return await createCalendarEvent({ title, start, durationMinutes, description, attendees });
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    case 'github_commit':
      return { dryRun: true, message: 'github_commit not yet wired — add GitHub token and implement' };

    case 'contacts_read': {
      const { query, maxResults = 20 } = input as { query?: string; maxResults?: number };
      try {
        const connections = await listGmailConnections();
        if (connections.length === 0) {
          return { error: 'Gmail not connected — connect in Settings' };
        }
        const conn = connections[0];
        const nango = getNango();
        const res = await nango.get<{
          connections?: Array<{ names?: Array<{ displayName: string }>; emailAddresses?: Array<{ value: string }>; metadata?: { sources?: Array<{ updateTime: string }> } }>;
          results?: Array<{ person: { names?: Array<{ displayName: string }>; emailAddresses?: Array<{ value: string }> } }>;
        }>({
          providerConfigKey: gmailIntegrationId(),
          connectionId: conn.connectionId,
          endpoint: query ? '/people/v1/people:searchContacts' : '/people/v1/people/me/connections',
          params: {
            pageSize: maxResults,
            personFields: 'names,emailAddresses,metadata',
            ...(query ? { query } : {}),
          },
        });
        const data = res.data;
        type PersonData = {
          names?: Array<{ displayName: string }>;
          emailAddresses?: Array<{ value: string }>;
          metadata?: { sources?: Array<{ updateTime: string }> };
        };
        const people: PersonData[] = data.connections ?? (data.results ?? []).map(r => r.person as PersonData);
        const contacts = people.map(p => ({
          name: p.names?.[0]?.displayName ?? 'Unknown',
          email: p.emailAddresses?.[0]?.value ?? '',
          lastUpdated: p.metadata?.sources?.[0]?.updateTime ?? '',
        }));
        return { contacts, count: contacts.length };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    case 'document_parse': {
      const { url, focus } = input as { url: string; focus?: string };
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AideaBot/1.0)' } });
      if (!res.ok) return { error: `HTTP ${res.status}`, url };
      const contentType = res.headers.get('content-type') ?? '';
      let text: string;
      if (contentType.includes('pdf')) {
        // PDF: return raw bytes as base64 won't help — return a note
        return { error: 'PDF parsing requires a dedicated library. Fetch the URL in a browser and paste the text.', url };
      }
      const html = await res.text();
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 8000);
      return { url, text, focus: focus ?? 'general', truncated: html.length > 8000 };
    }

    default:
      return { error: `Tool ${toolName} not implemented` };
  }
}

// ── Dry-run mock responses ────────────────────────────────────────────────────

function getDryRunResponse(toolName: string, input: ToolInput): unknown {
  switch (toolName) {
    case 'web_search':
      return {
        query: (input as { query: string }).query,
        results: [
          { title: '[DRY RUN] Example Result 1', url: 'https://example.com/1', snippet: 'Mock search result snippet for testing.' },
          { title: '[DRY RUN] Example Result 2', url: 'https://example.com/2', snippet: 'Another mock search result.' },
        ],
      };
    case 'web_fetch':
      return { url: (input as { url: string }).url, text: '[DRY RUN] Mock page content. Set realWorldToolMode to "auto" to fetch real content.', truncated: false };
    case 'news_search':
      return {
        results: (input as { topics: string[] }).topics.flatMap(topic => ([
          { topic, title: `[DRY RUN] ${topic} headline 1`, url: 'https://example.com/news/1', snippet: 'Mock news snippet.' },
          { topic, title: `[DRY RUN] ${topic} headline 2`, url: 'https://example.com/news/2', snippet: 'Another mock news snippet.' },
        ])),
      };
    case 'gmail_read':
      return {
        emails: [
          { id: 'mock1', from: 'Sarah Johnson <sarah@company.com>', subject: '[DRY RUN] Budget review needed', date: new Date().toISOString(), snippet: 'Hi, can we sync on the Q3 budget before Friday?', isUnread: true },
          { id: 'mock2', from: 'Team Newsletter <newsletter@co.com>', subject: '[DRY RUN] Weekly digest', date: new Date().toISOString(), snippet: 'Here is your weekly update...', isUnread: true },
        ],
        query: (input as { query?: string }).query ?? 'is:unread',
      };
    case 'gmail_draft':
    case 'gmail_send':
      return { dryRun: true, message: `[DRY RUN] Would send email to ${(input as { to: string }).to}`, input };
    case 'calendar_read':
      return {
        events: [
          { title: '[DRY RUN] Team standup', start: new Date().toISOString(), end: new Date(Date.now() + 1800000).toISOString(), attendees: ['team@company.com'], location: 'Zoom', description: '' },
          { title: '[DRY RUN] 1:1 with Sarah', start: new Date(Date.now() + 7200000).toISOString(), end: new Date(Date.now() + 9000000).toISOString(), attendees: ['sarah@company.com'], location: '', description: '' },
        ],
        daysAhead: (input as { daysAhead?: number }).daysAhead ?? 1,
      };
    case 'calendar_draft':
    case 'calendar_create':
      return { dryRun: true, message: `[DRY RUN] Would create event: ${(input as { title: string }).title}`, input };
    case 'contacts_read':
      return {
        contacts: [
          { name: 'Sarah Johnson', email: 'sarah@company.com', lastUpdated: new Date(Date.now() - 14 * 86400_000).toISOString() },
          { name: 'David Chen', email: 'david@partner.com', lastUpdated: new Date(Date.now() - 45 * 86400_000).toISOString() },
          { name: 'Emma Williams', email: 'emma@client.com', lastUpdated: new Date(Date.now() - 7 * 86400_000).toISOString() },
        ],
        count: 3,
      };
    case 'document_parse':
      return {
        url: (input as { url: string }).url,
        text: '[DRY RUN] Mock document content. Set realWorldToolMode to "auto" to fetch real content.',
        focus: (input as { focus?: string }).focus ?? 'general',
        truncated: false,
      };
    default:
      return { dryRun: true, message: `[DRY RUN] ${toolName}`, input };
  }
}
