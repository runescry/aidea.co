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

/** Empty shell created on each dashboard mount — must not be synced to server. */
export function isEphemeralConversation(c: ChatConversation): boolean {
  return c.title === 'New conversation' && (c.messages?.length ?? 0) === 0;
}

export function dedupeEphemeralConversations(conversations: ChatConversation[]): ChatConversation[] {
  const ephemeral = conversations.filter(isEphemeralConversation);
  if (ephemeral.length <= 1) return conversations;
  const keep = ephemeral.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return conversations.filter(c => !isEphemeralConversation(c) || c.id === keep.id);
}

export function normalizeConversation(raw: unknown): ChatConversation | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as ChatConversation;
  if (!c.id || !c.title) return null;
  return {
    ...c,
    messages: (c.messages ?? []).slice(-MAX_MESSAGES_PER_CONVERSATION),
  };
}

export function normalizeChatStore(raw: unknown): ChatStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as ChatStore;
  if (!Array.isArray(data.conversations) || !data.activeId) return null;

  const conversations = dedupeEphemeralConversations(
    data.conversations
      .map(normalizeConversation)
      .filter((c): c is ChatConversation => c !== null)
      .slice(0, MAX_CONVERSATIONS),
  );

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

  const conversations = dedupeEphemeralConversations(
    [...byId.values()]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_CONVERSATIONS),
  );

  if (conversations.length === 0) return emptyChatStore();

  const activeId =
    conversations.some(c => c.id === local.activeId) ? local.activeId
    : conversations.some(c => c.id === remote.activeId) ? remote.activeId
    : conversations[0].id;

  return { conversations, activeId };
}

/** Merge client PUT with server state; orphan removal happens in storage write. */
export function applyChatStoreUpdate(client: ChatStore, server: ChatStore | null): ChatStore {
  const merged = mergeChatStores(client, server);
  const clientIds = new Set(client.conversations.map(c => c.id));
  merged.conversations = merged.conversations.filter(c => clientIds.has(c.id));
  if (!merged.conversations.some(c => c.id === merged.activeId)) {
    merged.activeId = merged.conversations[0]?.id ?? merged.activeId;
  }
  if (merged.conversations.length === 0) return emptyChatStore();
  return merged;
}

/** Merge local + remote without inventing a throwaway when only one side exists. */
export function hydrateChatStore(local: ChatStore | null, remote: ChatStore | null): ChatStore {
  if (local && remote) return mergeChatStores(local, remote);
  const single = remote ?? local;
  if (single) return trimChatStore(single);
  return emptyChatStore();
}

export function trimChatStore(store: ChatStore): ChatStore {
  const normalized = normalizeChatStore(store);
  return normalized ?? emptyChatStore();
}
