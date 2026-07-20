import { getDatabaseUrl, getSql } from '@/lib/db/client';
import { ensureMigrated } from '@/lib/db/migrate';

export type TenantCount = { table: string; count: number };

export async function tenantCounts(userId: string): Promise<TenantCount[]> {
  const sql = getSql();
  const [row] = await sql<[{ counts: Record<string, number> }]>`
    SELECT jsonb_build_object(
      'profiles', (SELECT COUNT(*)::int FROM profiles WHERE user_id = ${userId}),
      'action_queue', (SELECT COUNT(*)::int FROM action_queue WHERE user_id = ${userId}),
      'harness_entities', (SELECT COUNT(*)::int FROM harness_entities WHERE user_id = ${userId}),
      'latest_briefs', (SELECT COUNT(*)::int FROM latest_briefs WHERE user_id = ${userId}),
      'app_settings', (SELECT COUNT(*)::int FROM app_settings WHERE user_id = ${userId}),
      'chat_store', (SELECT COUNT(*)::int FROM chat_store WHERE user_id = ${userId}),
      'chat_conversations', (SELECT COUNT(*)::int FROM chat_conversations WHERE user_id = ${userId}),
      'chat_meta', (SELECT COUNT(*)::int FROM chat_meta WHERE user_id = ${userId}),
      'action_audit', (SELECT COUNT(*)::int FROM action_audit WHERE user_id = ${userId})
    ) AS counts
  `;
  return Object.entries(row.counts).map(([table, count]) => ({ table, count }));
}

export async function copyTenantData(from: string, to: string, overwrite = false): Promise<void> {
  if (from === to) return;
  const sql = getSql();

  await sql.begin(async tx => {
    await tx`
      INSERT INTO profiles (user_id, data, updated_at)
      SELECT ${to}, data, NOW() FROM profiles WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = NOW()
      WHERE ${overwrite}
    `;
    await tx`
      INSERT INTO action_queue (id, user_id, payload, status, created_at)
      SELECT id, ${to}, payload, status, created_at FROM action_queue WHERE user_id = ${from}
      ON CONFLICT (id, user_id) DO UPDATE
      SET payload = EXCLUDED.payload, status = EXCLUDED.status
      WHERE ${overwrite}
    `;
    await tx`
      INSERT INTO harness_entities (id, user_id, data, updated_at)
      SELECT id, ${to}, data, updated_at FROM harness_entities WHERE user_id = ${from}
      ON CONFLICT (id, user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
      WHERE ${overwrite}
    `;
    await tx`
      INSERT INTO latest_briefs (user_id, data, generated_at)
      SELECT ${to}, data, generated_at FROM latest_briefs WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, generated_at = EXCLUDED.generated_at
      WHERE ${overwrite}
    `;
    await tx`
      INSERT INTO app_settings (user_id, data, updated_at)
      SELECT ${to}, data, updated_at FROM app_settings WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
      WHERE ${overwrite}
    `;
    await tx`
      INSERT INTO chat_store (user_id, data, updated_at)
      SELECT ${to}, data, updated_at FROM chat_store WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
      WHERE ${overwrite}
    `;
    await tx`
      INSERT INTO chat_conversations (id, user_id, title, messages, created_at, updated_at)
      SELECT id, ${to}, title, messages, created_at, updated_at FROM chat_conversations WHERE user_id = ${from}
      ON CONFLICT (id, user_id) DO UPDATE
      SET title = EXCLUDED.title, messages = EXCLUDED.messages, updated_at = EXCLUDED.updated_at
      WHERE ${overwrite}
    `;
    await tx`
      INSERT INTO chat_meta (user_id, active_conversation_id, updated_at)
      SELECT ${to}, active_conversation_id, updated_at FROM chat_meta WHERE user_id = ${from}
      ON CONFLICT (user_id) DO UPDATE
      SET active_conversation_id = EXCLUDED.active_conversation_id, updated_at = EXCLUDED.updated_at
      WHERE ${overwrite}
    `;
    await tx`
      INSERT INTO action_audit (id, user_id, action_id, payload, resolved_at)
      SELECT id, ${to}, action_id, payload, resolved_at FROM action_audit WHERE user_id = ${from}
      ON CONFLICT (id, user_id) DO UPDATE
      SET action_id = EXCLUDED.action_id, payload = EXCLUDED.payload, resolved_at = EXCLUDED.resolved_at
      WHERE ${overwrite}
    `;
  });
}

export async function claimTenantData(from: string, to: string): Promise<void> {
  if (!getDatabaseUrl() || from === to) return;
  await ensureMigrated();
  await copyTenantData(from, to, false);
}
