import type { EntityState } from '@/lib/harness/types';
import type { QueuedAction, ActionStatus, ActionType } from '@/lib/harness/queue-types';
import type { AppSettings } from '@/lib/settings';
import type { ChatStore } from '@/types/chat';
import { ensureMigrated } from '@/lib/db/migrate';
import { hasDatabase } from '@/lib/db/client';
import * as fs from './filesystem';
import * as pg from './postgres';

export function getUserId(): string {
  return process.env.DEFAULT_USER_ID ?? 'default';
}

function usePostgres(): boolean {
  return hasDatabase();
}

async function ready(): Promise<void> {
  if (usePostgres()) await ensureMigrated();
}

export async function readProfile(): Promise<Record<string, unknown>> {
  await ready();
  const userId = getUserId();
  return usePostgres() ? pg.readProfile(userId) : fs.readProfile();
}

export async function writeProfile(data: Record<string, unknown>): Promise<void> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) await pg.writeProfile(userId, data);
  else fs.writeProfile(data);
}

export async function mergeProfile(updates: Record<string, unknown>): Promise<void> {
  const current = await readProfile();
  for (const [k, v] of Object.entries(updates)) {
    if (k.includes('.')) {
      const { setNestedKey } = await import('./nested-keys');
      setNestedKey(current, k, v);
    } else {
      current[k] = v;
    }
  }
  await writeProfile(current);
}

export async function getQueuedAction(id: string): Promise<QueuedAction | null> {
  await ready();
  const userId = getUserId();
  return usePostgres() ? pg.getQueueAction(userId, id) : fs.getQueueAction(id);
}

export async function listQueuedActions(filter?: {
  status?: ActionStatus;
  type?: ActionType;
}): Promise<QueuedAction[]> {
  await ready();
  const userId = getUserId();
  const all = usePostgres() ? await pg.listQueue(userId) : fs.listQueue();
  if (!filter) return all;
  return all.filter(a => {
    if (filter.status && a.status !== filter.status) return false;
    if (filter.type && a.type !== filter.type) return false;
    return true;
  });
}

export async function countPendingQueuedActions(): Promise<number> {
  await ready();
  const userId = getUserId();
  return usePostgres() ? pg.countPendingQueue(userId) : fs.countPendingQueue();
}

export async function saveQueuedAction(action: QueuedAction): Promise<void> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) await pg.saveQueueAction(userId, action);
  else fs.saveQueueAction(action);
}

export async function replaceQueue(actions: QueuedAction[]): Promise<void> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) await pg.replaceQueue(userId, actions);
  else fs.replaceQueue(actions);
}

export async function loadEntityStates(): Promise<EntityState[]> {
  await ready();
  const userId = getUserId();
  return usePostgres() ? pg.loadEntities(userId) : fs.loadEntities();
}

export async function saveEntityState(state: EntityState): Promise<void> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) await pg.saveEntity(userId, state);
  else fs.saveEntity(state);
}

export async function readLatestBrief(): Promise<Record<string, unknown> | null> {
  await ready();
  const userId = getUserId();
  return usePostgres() ? pg.readLatestBrief(userId) : fs.readLatestBrief();
}

export async function writeLatestBrief(data: Record<string, unknown>): Promise<void> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) await pg.writeLatestBrief(userId, data);
  else fs.writeLatestBrief(data);
}

export function isProductionDeploy(): boolean {
  return process.env.VERCEL === '1';
}

export async function readStoredSettings(): Promise<AppSettings> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) return pg.readSettings(userId);
  return fs.readSettings();
}

export async function writeStoredSettings(updates: Partial<AppSettings>): Promise<void> {
  if (isProductionDeploy()) {
    throw new Error('Settings cannot be written on Vercel — use Environment Variables');
  }

  await ready();
  const userId = getUserId();
  const current = usePostgres() ? await pg.readSettings(userId) : fs.readSettings();
  for (const [key, value] of Object.entries(updates) as Array<[keyof AppSettings, unknown]>) {
    if (value === undefined || value === '') delete current[key];
    else if (typeof value === 'string') current[key] = value.trim() as AppSettings[keyof AppSettings];
    else current[key] = value as AppSettings[keyof AppSettings];
  }
  if (usePostgres()) await pg.writeSettings(userId, current);
  else fs.writeSettings(current);
}

export async function readChatStore(): Promise<ChatStore | null> {
  await ready();
  const userId = getUserId();
  return usePostgres() ? pg.readChatStore(userId) : fs.readChatStore();
}

export async function writeChatStore(data: ChatStore): Promise<void> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) await pg.writeChatStore(userId, data);
  else fs.writeChatStore(data);
}

export async function deleteChatConversation(id: string): Promise<ChatStore> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) return pg.deleteChatConversation(userId, id);
  return fs.deleteChatConversation(id);
}

export async function listQueueAuditEntries(): Promise<
  import('@/lib/harness/queue-audit').QueueAuditEntry[]
> {
  await ready();
  const userId = getUserId();
  return usePostgres() ? pg.listQueueAudit(userId) : fs.listQueueAudit();
}

export async function appendQueueAuditEntry(
  entry: import('@/lib/harness/queue-audit').QueueAuditEntry
): Promise<void> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) await pg.appendQueueAudit(userId, entry);
  else fs.appendQueueAudit(entry);
}

/** Clear queue, audit, harness runs, chat, and brief — preserves profile/KB, settings, integrations. */
export async function clearActivityHistory(): Promise<void> {
  await ready();
  const userId = getUserId();
  if (usePostgres()) await pg.clearActivityHistory(userId);
  else fs.clearActivityHistory();
  // Also clear the onboarding completion flag so the wizard re-shows after a reset.
  await mergeProfile({ 'preferences.onboardingComplete': false });
}
