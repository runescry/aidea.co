import * as fs from 'fs';
import * as path from 'path';
import type { EntityState } from '@/lib/harness/types';
import type { QueuedAction } from '@/lib/harness/queue';
import type { AppSettings } from '@/lib/settings';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

export function readProfile(): Record<string, unknown> {
  return readJson('knowledge-base.json', {});
}

export function writeProfile(data: Record<string, unknown>): void {
  writeJson('knowledge-base.json', data);
}

export function listQueue(): QueuedAction[] {
  return readJson('action-queue.json', []);
}

export function saveQueueAction(action: QueuedAction): void {
  const all = listQueue();
  const idx = all.findIndex(a => a.id === action.id);
  if (idx === -1) all.push(action);
  else all[idx] = action;
  writeJson('action-queue.json', all);
}

export function replaceQueue(actions: QueuedAction[]): void {
  writeJson('action-queue.json', actions);
}

interface StateFile {
  version: string;
  entities: EntityState[];
}

export function loadEntities(): EntityState[] {
  return readJson<StateFile>('harness-state.json', { version: '1.0', entities: [] }).entities;
}

export function saveEntity(state: EntityState): void {
  const file = readJson<StateFile>('harness-state.json', { version: '1.0', entities: [] });
  const idx = file.entities.findIndex(e => e.entityId === state.entityId);
  if (idx === -1) file.entities.push(state);
  else file.entities[idx] = state;
  writeJson('harness-state.json', file);
}

export function readLatestBrief(): Record<string, unknown> | null {
  return readJson<Record<string, unknown> | null>('latest-brief.json', null);
}

export function writeLatestBrief(data: Record<string, unknown>): void {
  writeJson('latest-brief.json', { ...data, generatedAt: new Date().toISOString() });
}

export function readSettings(): AppSettings {
  return readJson('settings.json', {});
}

export function writeSettings(data: AppSettings): void {
  writeJson('settings.json', data);
}
