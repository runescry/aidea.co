import type { ChatConversation, ChatStore } from '@/types/chat';

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 200;

export function emptyChatStore(): ChatStore {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    conversations: [{
      id,
      title: 'New conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
    }],
    activeId: id,
  };
}

export function normalizeChatStore(raw: unknown): ChatStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as ChatStore;
  if (!Array.isArray(data.conversations) || !data.activeId) return null;

  const conversations = data.conversations
    .slice(0, MAX_CONVERSATIONS)
    .map(c => ({
      ...c,
      messages: (c.messages ?? []).slice(-MAX_MESSAGES_PER_CONVERSATION),
    }))
    .filter(c => c.id && c.title);

  if (conversations.length === 0) return null;

  const activeId = conversations.some(c => c.id === data.activeId)
    ? data.activeId
    : conversations[0].id;

  return { conversations, activeId };
}

export function mergeChatStores(local: ChatStore, remote: ChatStore | null): ChatStore {
  if (!remote) return local;

  const byId = new Map<string, ChatConversation>();
  for (const c of remote.conversations) byId.set(c.id, c);
  for (const c of local.conversations) {
    const existing = byId.get(c.id);
    if (!existing || new Date(c.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(c.id, c);
    }
  }

  const conversations = [...byId.values()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_CONVERSATIONS);

  const activeId =
    conversations.some(c => c.id === local.activeId) ? local.activeId
    : conversations.some(c => c.id === remote.activeId) ? remote.activeId
    : conversations[0].id;

  return { conversations, activeId };
}
