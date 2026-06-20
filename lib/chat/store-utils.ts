import type { ChatConversation, ChatStore } from '@/types/chat';

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 200;
const MAX_DELETED_IDS = 500;

function capDeletedIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)].slice(-MAX_DELETED_IDS);
}

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
    deletedConversationIds: [],
  };
}

export function normalizeChatStore(raw: unknown): ChatStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as ChatStore;
  if (!Array.isArray(data.conversations) || !data.activeId) return null;

  const deleted = new Set(capDeletedIds(data.deletedConversationIds ?? []));

  const conversations = data.conversations
    .slice(0, MAX_CONVERSATIONS)
    .map(c => ({
      ...c,
      messages: (c.messages ?? []).slice(-MAX_MESSAGES_PER_CONVERSATION),
    }))
    .filter(c => c.id && c.title && !deleted.has(c.id));

  if (conversations.length === 0) return null;

  const activeId = conversations.some(c => c.id === data.activeId)
    ? data.activeId
    : conversations[0].id;

  return {
    conversations,
    activeId,
    deletedConversationIds: capDeletedIds(deleted),
  };
}

export function mergeChatStores(local: ChatStore, remote: ChatStore | null): ChatStore {
  const deleted = new Set(capDeletedIds([
    ...(local.deletedConversationIds ?? []),
    ...(remote?.deletedConversationIds ?? []),
  ]));

  if (!remote) {
    const conversations = local.conversations
      .filter(c => !deleted.has(c.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_CONVERSATIONS);
    if (conversations.length === 0) return emptyChatStore();
    const activeId = conversations.some(c => c.id === local.activeId)
      ? local.activeId
      : conversations[0].id;
    return { conversations, activeId, deletedConversationIds: capDeletedIds(deleted) };
  }

  const byId = new Map<string, ChatConversation>();
  for (const c of remote.conversations) {
    if (!deleted.has(c.id)) byId.set(c.id, c);
  }
  for (const c of local.conversations) {
    if (deleted.has(c.id)) {
      byId.delete(c.id);
      continue;
    }
    const existing = byId.get(c.id);
    if (!existing || new Date(c.updatedAt) >= new Date(existing.updatedAt)) {
      byId.set(c.id, c);
    }
  }

  const conversations = [...byId.values()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_CONVERSATIONS);

  if (conversations.length === 0) return emptyChatStore();

  const activeId =
    conversations.some(c => c.id === local.activeId) ? local.activeId
    : conversations.some(c => c.id === remote.activeId) ? remote.activeId
    : conversations[0].id;

  return {
    conversations,
    activeId,
    deletedConversationIds: capDeletedIds(deleted),
  };
}

/** Apply a client PUT — honour explicit deletes and conversations omitted from the payload. */
export function applyChatStoreUpdate(client: ChatStore, server: ChatStore | null): ChatStore {
  const implicitDeletes = server
    ? server.conversations
        .filter(c => !client.conversations.some(cc => cc.id === c.id))
        .map(c => c.id)
    : [];

  const clientWithDeletes: ChatStore = {
    ...client,
    deletedConversationIds: capDeletedIds([
      ...(client.deletedConversationIds ?? []),
      ...implicitDeletes,
    ]),
  };

  return mergeChatStores(clientWithDeletes, server);
}
