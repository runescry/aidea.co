import type { ChatConversation, ChatStore } from '@/types/chat';
import { emptyChatStore, normalizeChatStore, trimChatStore } from '@/lib/chat/store-utils';

export function rowToConversation(row: {
  id: string;
  title: string;
  messages: ChatConversation['messages'];
  created_at: string | Date;
  updated_at: string | Date;
}): ChatConversation {
  return {
    id: row.id,
    title: row.title,
    messages: row.messages ?? [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function ensureActiveId(store: ChatStore): ChatStore {
  const trimmed = trimChatStore(store);
  if (trimmed.conversations.some(c => c.id === trimmed.activeId)) return trimmed;
  return { ...trimmed, activeId: trimmed.conversations[0].id };
}

export function parseLegacyChatStore(raw: unknown): ChatStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const legacy = raw as ChatStore & { deletedConversationIds?: string[] };
  const deleted = new Set(legacy.deletedConversationIds ?? []);
  const filtered = {
    ...legacy,
    conversations: legacy.conversations?.filter(c => !deleted.has(c.id)) ?? [],
  };
  return normalizeChatStore(filtered);
}
