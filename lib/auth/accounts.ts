import { ensureMigrated } from '@/lib/db/migrate';
import { getSql, hasDatabase } from '@/lib/db/client';
import type { UserExecutionContext } from './user-context';

export async function registerGoogleAccount(userId: string, nangoUserId: string): Promise<void> {
  if (!hasDatabase()) return;
  await ensureMigrated();
  const sql = getSql();
  await sql`
    INSERT INTO user_accounts (user_id, nango_user_id, mode, monitors_enabled, updated_at)
    VALUES (${userId}, ${nangoUserId}, 'google', TRUE, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      nango_user_id = EXCLUDED.nango_user_id,
      mode = EXCLUDED.mode,
      updated_at = NOW()
  `;
}

export async function listMonitorAccounts(): Promise<UserExecutionContext[]> {
  if (!hasDatabase()) return [];
  await ensureMigrated();
  const sql = getSql();
  const rows = await sql<Array<{ user_id: string; nango_user_id: string }>>`
    SELECT user_id, nango_user_id
    FROM user_accounts
    WHERE mode = 'google' AND monitors_enabled = TRUE
    ORDER BY created_at ASC
  `;
  return rows.map(row => ({ userId: row.user_id, nangoUserId: row.nango_user_id }));
}

export function buildMonitorTargets(
  accounts: UserExecutionContext[],
  fallbackUserId: string,
  includeFallback = true,
): UserExecutionContext[] {
  const byUserId = new Map(accounts.map(account => [account.userId, account]));
  if (includeFallback && !byUserId.has(fallbackUserId)) {
    byUserId.set(fallbackUserId, { userId: fallbackUserId, nangoUserId: fallbackUserId });
  }
  return [...byUserId.values()];
}

export async function listMonitorTargets(): Promise<UserExecutionContext[]> {
  const accounts = await listMonitorAccounts();
  const fallbackUserId = process.env.DEFAULT_USER_ID?.trim() || 'default';
  return buildMonitorTargets(accounts, fallbackUserId, process.env.MONITOR_INCLUDE_DEFAULT !== '0');
}

