import { getSql, toJson } from '@/lib/db/client';
import type { EntityState } from '@/lib/harness/types';
import type { QueuedAction } from '@/lib/harness/queue';
import type { AppSettings } from '@/lib/settings';

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

export async function listQueue(userId: string): Promise<QueuedAction[]> {
  const sql = getSql();
  const rows = await sql<{ payload: QueuedAction }[]>`
    SELECT payload FROM action_queue WHERE user_id = ${userId} ORDER BY created_at ASC
  `;
  return rows.map(r => r.payload);
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
