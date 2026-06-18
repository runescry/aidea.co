import * as fs from 'fs';
import * as path from 'path';

const QUEUE_PATH = path.join(process.cwd(), 'data', 'action-queue.json');

let writeLock = false;

async function withLock(fn: () => void): Promise<void> {
  while (writeLock) await new Promise(r => setTimeout(r, 10));
  writeLock = true;
  try { fn(); } finally { writeLock = false; }
}

function ensureDataDir(): void {
  const dir = path.dirname(QUEUE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFile(): QueuedAction[] {
  ensureDataDir();
  if (!fs.existsSync(QUEUE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8')) as QueuedAction[];
  } catch {
    return [];
  }
}

function writeFile(actions: QueuedAction[]): void {
  ensureDataDir();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(actions, null, 2), 'utf-8');
}

export type ActionType =
  | 'email_reply'
  | 'email_send'
  | 'calendar_event'
  | 'task'
  | 'reminder'
  | 'message'
  | 'alert'
  | 'generic';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

export interface QueuedAction {
  id: string;
  type: ActionType;
  summary: string;
  detail?: string;
  agentRole: string;
  entityId?: string;
  tool: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
  resolvedAt?: string;
}

export function listActions(filter?: { status?: ActionStatus; type?: ActionType }): QueuedAction[] {
  const all = readFile();
  if (!filter) return all;
  return all.filter(a => {
    if (filter.status && a.status !== filter.status) return false;
    if (filter.type && a.type !== filter.type) return false;
    return true;
  });
}

export async function enqueueAction(
  action: Omit<QueuedAction, 'id' | 'status' | 'createdAt'>
): Promise<QueuedAction> {
  let created!: QueuedAction;
  await withLock(() => {
    const all = readFile();
    created = {
      ...action,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    all.push(created);
    writeFile(all);
  });
  return created;
}

export async function updateActionStatus(
  id: string,
  status: ActionStatus
): Promise<QueuedAction | null> {
  let updated: QueuedAction | null = null;
  await withLock(() => {
    const all = readFile();
    const idx = all.findIndex(a => a.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], status, resolvedAt: new Date().toISOString() };
    updated = all[idx];
    writeFile(all);
  });
  return updated;
}

export async function clearResolved(): Promise<number> {
  let count = 0;
  await withLock(() => {
    const all = readFile();
    const remaining = all.filter(a => a.status === 'pending');
    count = all.length - remaining.length;
    writeFile(remaining);
  });
  return count;
}
