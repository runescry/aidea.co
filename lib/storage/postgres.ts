import { getSql, toJson } from '@/lib/db/client';
import type { EntityState } from '@/lib/harness/types';
import type { QueuedAction } from '@/lib/harness/queue-types';
import type { AppSettings } from '@/lib/settings';
import type { ChatConversation, ChatStore } from '@/types/chat';
import { emptyChatStore, normalizeChatStore } from '@/lib/chat/store-utils';
import {
  ensureActiveId,
  parseLegacyChatStore,
  rowToConversation,
} from './chat-conversations';

const globalForChatMigration = globalThis as typeof globalThis & {
  __aideaLegacyChatMigratedUsers?: Set<string>;
};

function legacyChatMigratedUsers(): Set<string> {
  if (!globalForChatMigration.__aideaLegacyChatMigratedUsers) {
    globalForChatMigration.__aideaLegacyChatMigratedUsers = new Set<string>();
  }
  return globalForChatMigration.__aideaLegacyChatMigratedUsers;
}

export async function readProfile(userId: string): Promise<Record<string, unknown>> {
  const sql = getSql();
  const rows = await sql<{ data: Record<string, unknown> }[]>`
    SELECT data FROM profiles WHERE user_id = ${userId}
  `;
  if (rows.length === 0) return {};
  return rows[0].data;
}

export async function writeProfile(userId: string, data: Record<string, unknown>): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO profiles (user_id, data, updated_at)
    VALUES (${userId}, ${sql.json(toJson(data))}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

export async function getQueueAction(userId: string, id: string): Promise<QueuedAction | null> {
  const sql = getSql();
  const rows = await sql<{ payload: QueuedAction }[]>`
    SELECT payload FROM action_queue WHERE user_id = ${userId} AND id = ${id}
  `;
  if (rows.length === 0) return null;
  return rows[0].payload;
}

export async function listQueue(userId: string): Promise<QueuedAction[]> {
  const sql = getSql();
  const rows = await sql<{ payload: QueuedAction }[]>`
    SELECT payload FROM action_queue WHERE user_id = ${userId} ORDER BY created_at ASC
  `;
  return rows.map(r => r.payload);
}

export async function countPendingQueue(userId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM action_queue
    WHERE user_id = ${userId} AND status = 'pending'
  `;
  return rows[0]?.count ?? 0;
}

export async function saveQueueAction(userId: string, action: QueuedAction): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO action_queue (id, user_id, payload, status, created_at)
    VALUES (${action.id}, ${userId}, ${sql.json(toJson(action))}, ${action.status}, ${action.createdAt})
    ON CONFLICT (id, user_id) DO UPDATE SET payload = EXCLUDED.payload, status = EXCLUDED.status
  `;
}

export async function replaceQueue(userId: string, actions: QueuedAction[]): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM action_queue WHERE user_id = ${userId}`;
  for (const action of actions) {
    await saveQueueAction(userId, action);
  }
}

export async function loadEntities(userId: string): Promise<EntityState[]> {
  const sql = getSql();
  const rows = await sql<{ data: EntityState }[]>`
    SELECT data FROM harness_entities WHERE user_id = ${userId} ORDER BY updated_at DESC
  `;
  return rows.map(r => r.data);
}

export async function saveEntity(userId: string, state: EntityState): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO harness_entities (id, user_id, data, updated_at)
    VALUES (${state.entityId}, ${userId}, ${sql.json(toJson(state))}, NOW())
    ON CONFLICT (id, user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

export async function readLatestBrief(userId: string): Promise<Record<string, unknown> | null> {
  const sql = getSql();
  const rows = await sql<{ data: Record<string, unknown> }[]>`
    SELECT data FROM latest_briefs WHERE user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  return rows[0].data;
}

export async function writeLatestBrief(userId: string, data: Record<string, unknown>): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO latest_briefs (user_id, data, generated_at)
    VALUES (${userId}, ${sql.json(toJson(data))}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, generated_at = NOW()
  `;
}

export async function readSettings(userId: string): Promise<AppSettings> {
  const sql = getSql();
  const rows = await sql<{ data: AppSettings }[]>`
    SELECT data FROM app_settings WHERE user_id = ${userId}
  `;
  if (rows.length === 0) return {};
  return rows[0].data;
}

export async function writeSettings(userId: string, data: AppSettings): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO app_settings (user_id, data, updated_at)
    VALUES (${userId}, ${sql.json(toJson(data))}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

async function migrateLegacyChatStore(userId: string): Promise<void> {
  const migratedUsers = legacyChatMigratedUsers();
  if (migratedUsers.has(userId)) return;

  const sql = getSql();
  const existing = await sql<{ n: number }[]>`
    SELECT 1 AS n FROM chat_conversations WHERE user_id = ${userId} LIMIT 1
  `;
  if (existing.length > 0) {
    migratedUsers.add(userId);
    return;
  }

  const legacyRows = await sql<{ data: unknown }[]>`
    SELECT data FROM chat_store WHERE user_id = ${userId}
  `;
  if (legacyRows.length === 0) {
    migratedUsers.add(userId);
    return;
  }

  const parsed = parseLegacyChatStore(legacyRows[0].data);
  if (!parsed) {
    migratedUsers.add(userId);
    return;
  }

  await writeChatStore(userId, parsed);
  await sql`DELETE FROM chat_store WHERE user_id = ${userId}`;
  migratedUsers.add(userId);
}

async function upsertChatMeta(userId: string, activeId: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO chat_meta (user_id, active_conversation_id, updated_at)
    VALUES (${userId}, ${activeId}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      active_conversation_id = EXCLUDED.active_conversation_id,
      updated_at = NOW()
  `;
}

async function upsertChatConversation(userId: string, conversation: ChatConversation): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO chat_conversations (id, user_id, title, messages, created_at, updated_at)
    VALUES (
      ${conversation.id},
      ${userId},
      ${conversation.title},
      ${sql.json(toJson(conversation.messages))},
      ${conversation.createdAt},
      ${conversation.updatedAt}
    )
    ON CONFLICT (id, user_id) DO UPDATE SET
      title = EXCLUDED.title,
      messages = EXCLUDED.messages,
      updated_at = EXCLUDED.updated_at
  `;
}

export async function readChatStore(userId: string): Promise<ChatStore | null> {
  await migrateLegacyChatStore(userId);

  const sql = getSql();
  const rows = await sql<{
    id: string;
    title: string;
    messages: ChatConversation['messages'];
    created_at: string;
    updated_at: string;
  }[]>`
    SELECT id, title, messages, created_at, updated_at
    FROM chat_conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  if (rows.length === 0) return null;

  const metaRows = await sql<{ active_conversation_id: string }[]>`
    SELECT active_conversation_id FROM chat_meta WHERE user_id = ${userId}
  `;

  const conversations = rows.map(rowToConversation);
  const activeId = metaRows[0]?.active_conversation_id ?? conversations[0].id;

  return normalizeChatStore({ conversations, activeId });
}

export async function writeChatStore(userId: string, data: ChatStore): Promise<void> {
  const store = ensureActiveId(data);
  const sql = getSql();
  const ids = store.conversations.map(c => c.id);

  if (ids.length === 0) {
    await sql`DELETE FROM chat_conversations WHERE user_id = ${userId}`;
    await sql`DELETE FROM chat_meta WHERE user_id = ${userId}`;
    return;
  }

  await sql`
    DELETE FROM chat_conversations
    WHERE user_id = ${userId} AND id NOT IN ${sql(ids)}
  `;

  for (const conversation of store.conversations) {
    await upsertChatConversation(userId, conversation);
  }

  await upsertChatMeta(userId, store.activeId);
}

export async function deleteChatConversation(userId: string, id: string): Promise<ChatStore> {
  const sql = getSql();
  await sql`
    DELETE FROM chat_conversations
    WHERE user_id = ${userId} AND id = ${id}
  `;

  let store = await readChatStore(userId);
  if (!store || store.conversations.length === 0) {
    store = emptyChatStore();
    await writeChatStore(userId, store);
    return store;
  }

  store = ensureActiveId(store);
  await upsertChatMeta(userId, store.activeId);
  return store;
}

export async function listQueueAudit(
  userId: string
): Promise<import('@/lib/harness/queue-audit').QueueAuditEntry[]> {
  const sql = getSql();
  const rows = await sql<{ payload: import('@/lib/harness/queue-audit').QueueAuditEntry }[]>`
    SELECT payload FROM action_audit WHERE user_id = ${userId} ORDER BY resolved_at ASC
  `;
  return rows.map(r => r.payload);
}

export async function appendQueueAudit(
  userId: string,
  entry: import('@/lib/harness/queue-audit').QueueAuditEntry
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO action_audit (id, user_id, action_id, payload, resolved_at)
    VALUES (
      ${entry.id},
      ${userId},
      ${entry.actionId},
      ${sql.json(toJson(entry))},
      ${entry.resolvedAt}
    )
    ON CONFLICT (id, user_id) DO NOTHING
  `;
}

export async function clearActivityHistory(userId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM action_queue WHERE user_id = ${userId}`;
  await sql`DELETE FROM action_audit WHERE user_id = ${userId}`;
  await sql`DELETE FROM harness_entities WHERE user_id = ${userId}`;
  await sql`DELETE FROM chat_conversations WHERE user_id = ${userId}`;
  await sql`DELETE FROM chat_meta WHERE user_id = ${userId}`;
  await sql`DELETE FROM chat_store WHERE user_id = ${userId}`;
  await sql`DELETE FROM latest_briefs WHERE user_id = ${userId}`;
  await writeChatStore(userId, emptyChatStore());
}
