import type { ChatHistoryEntry, ChatMessage } from '@/types/chat';

const MAX_HISTORY_MESSAGES = 16;
const MAX_CONTENT_CHARS = 1500;

interface InboxStructured {
  inbox_summary?: Array<{ priority?: string; from?: string; subject?: string; snippet?: string }>;
}

function isInboxStructured(data: unknown): data is InboxStructured {
  return Boolean(data && typeof data === 'object' && Array.isArray((data as InboxStructured).inbox_summary));
}

function inboxContext(structured: InboxStructured): string {
  const items = structured.inbox_summary ?? [];
  if (items.length === 0) return '';
  const lines = items.map((item, i) => {
    const from = item.from?.trim() || 'Unknown';
    const subject = item.subject?.trim() || item.snippet?.trim()?.slice(0, 80) || '(no subject)';
    return `${i + 1}. [${item.priority ?? 'NORMAL'}] ${from} — ${subject}`;
  });
  return `\nNumbered inbox items from that turn:\n${lines.join('\n')}`;
}

export function messageToHistoryEntry(message: ChatMessage): ChatHistoryEntry {
  let content = message.content.trim();
  if (message.role === 'assistant' && isInboxStructured(message.structured)) {
    content = `${content}${inboxContext(message.structured)}`.trim();
  }
  return {
    role: message.role,
    content: content.slice(0, MAX_CONTENT_CHARS),
    timestamp: message.timestamp,
  };
}

export function buildHistoryFromMessages(messages: ChatMessage[]): ChatHistoryEntry[] {
  return messages
    .filter(m => (m.status === 'done' || m.status === 'error') && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(messageToHistoryEntry);
}

export function formatConversationHistory(history: ChatHistoryEntry[]): string {
  return history
    .map((entry, i) => {
      const label = entry.role === 'user' ? 'User' : 'Assistant';
      return `[${i + 1}] ${label}: ${entry.content}`;
    })
    .join('\n\n');
}
