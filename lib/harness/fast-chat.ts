import { streamText } from 'ai';
import { getModel } from '@/lib/ai/provider';
import { readKB } from '@/lib/harness/knowledge-base';
import { formatConversationHistory } from '@/lib/chat/history';
import type { ChatHistoryEntry } from '@/types/chat';
import type { SenderFn } from './types';

const DISPATCHER_ROLE = 'dispatcher';
const AGENT_ID = 'fast-dispatch';

/** Routes that need tools, external APIs, or queue — must use full harness dispatch. */
const FULL_PATH_PATTERNS: RegExp[] = [
  /\b(inbox|email|gmail|calendar|schedule|meeting|draft|reply|send|remind|todo|task)\b/i,
  /\b(update|change|set)\s+(my\s+)?(profile|brief|role|goal|goals|preferences)\b/i,
  /\b(research|search|look up|find out|web search)\b/i,
  /\b(headlines?|breaking news|current events?)\b/i,
  /\bnews\b/i,
  /\bwhat('s| is)\s+(in|on)\s+the\s+news\b/i,
  /\bwhat('s| is) happening\b/i,
  /\b(job|application|interview|offer|recruiting)\b/i,
  /\bwhat('s| is)\s+(on|in)\s+my\s+(inbox|calendar|email|schedule)\b/i,
  /\b(needs? my attention|attention right now|still open|this week)\b/i,
  /\b(queue|approve|reject|action queue)\b/i,
  /\b(connect|oauth|google mail)\b/i,
  /\b(before my (next )?meeting|meeting prep)\b/i,
];

const FOLLOW_UP_PATTERNS: RegExp[] = [
  /\b(the )?(first|second|third|fourth|#\d+)\b/i,
  /\b(that (one|email|message|reply|draft))\b/i,
  /\b(reply to|respond to) (#\d+|\d)\b/i,
];

export function shouldUseFastChat(command: string, history: ChatHistoryEntry[] = []): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  if (trimmed.length > 320) return false;

  if (FULL_PATH_PATTERNS.some(p => p.test(trimmed))) return false;

  if (history.length > 0 && FOLLOW_UP_PATTERNS.some(p => p.test(trimmed))) {
    return false;
  }

  return true;
}

export async function runFastChat(
  command: string,
  history: ChatHistoryEntry[],
  send: SenderFn,
  sessionId: string,
): Promise<void> {
  const entityId = sessionId;
  const startedAt = new Date().toISOString();

  send({
    type: 'entity_started',
    sessionId,
    entityId,
    data: { entityType: 'daily', entityName: 'Dispatch', fastPath: true },
    timestamp: startedAt,
  });

  send({
    type: 'agent_started',
    sessionId,
    entityId,
    agentId: AGENT_ID,
    agentRole: DISPATCHER_ROLE,
    data: { tier: 0, fastPath: true },
    timestamp: startedAt,
  });

  const kb = await readKB(['identity', 'work', 'preferences']);
  const identity = kb.identity as { name?: string; preferredName?: string; role?: string } | null;
  const work = kb.work as { role?: string } | null;
  const prefs = kb.preferences as { defaultAutonomyLevel?: string } | null;

  const name = identity?.preferredName?.trim() || identity?.name?.trim() || 'the user';
  const role = work?.role?.trim() || identity?.role?.trim() || '';
  const autonomy = prefs?.defaultAutonomyLevel ?? 'semi-autonomous';

  const system = [
    `You are aidea — ${name}'s personal chief of staff${role ? ` (${role})` : ''}.`,
    'Answer in clear, concise prose (usually 1–4 sentences). Use markdown sparingly.',
    `Default autonomy: ${autonomy}.`,
    'You are in fast mode: no tools, no inbox/calendar access. If they ask for email, calendar, drafts, profile updates, research, or queued actions, briefly say you can handle that — ask them to repeat the request and you will run the full workflow.',
    'For greetings, capability questions, planning advice, and general chat, respond directly.',
  ].join('\n');

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (history.length > 0) {
    messages.push({
      role: 'user',
      content: `Recent conversation:\n${formatConversationHistory(history)}`,
    });
    messages.push({ role: 'assistant', content: 'Understood — I have that context.' });
  }
  messages.push({ role: 'user', content: command });

  const streamResult = streamText({
    model: getModel('claude-haiku-4-5-20251001'),
    system,
    messages,
    maxTokens: 600,
  });

  for await (const delta of streamResult.textStream) {
    if (!delta) continue;
    send({
      type: 'agent_text_delta',
      sessionId,
      entityId,
      agentId: AGENT_ID,
      agentRole: DISPATCHER_ROLE,
      data: { delta },
      timestamp: new Date().toISOString(),
    });
  }

  const text = (await streamResult.text).trim() || 'Done.';

  send({
    type: 'agent_complete',
    sessionId,
    entityId,
    agentId: AGENT_ID,
    agentRole: DISPATCHER_ROLE,
    data: { summary: text },
    timestamp: new Date().toISOString(),
  });

  send({
    type: 'entity_complete',
    sessionId,
    entityId,
    data: { fastPath: true },
    timestamp: new Date().toISOString(),
  });
}
