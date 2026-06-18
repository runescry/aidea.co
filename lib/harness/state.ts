import * as fs from 'fs';
import * as path from 'path';
import type { EntityState, EntityType } from './types';

const STATE_PATH = path.join(process.cwd(), 'data', 'harness-state.json');

interface StateFile {
  version: string;
  entities: EntityState[];
}

let writeLock = false;

async function withLock(fn: () => void): Promise<void> {
  while (writeLock) await new Promise(r => setTimeout(r, 10));
  writeLock = true;
  try { fn(); } finally { writeLock = false; }
}

function ensureDataDir(): void {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFile(): StateFile {
  ensureDataDir();
  if (!fs.existsSync(STATE_PATH)) return { version: '1.0', entities: [] };
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as StateFile;
}

function writeFile(file: StateFile): void {
  ensureDataDir();
  fs.writeFileSync(STATE_PATH, JSON.stringify(file, null, 2), 'utf-8');
}

export function createEntityState(
  entityId: string,
  entityType: EntityType,
  entityName: string,
  initialData: Record<string, unknown>
): EntityState {
  return {
    entityId,
    entityType,
    entityName,
    status: 'running',
    data: initialData,
    decisions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function persistEntityState(state: EntityState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await withLock(() => {
    const file = readFile();
    const idx = file.entities.findIndex(e => e.entityId === state.entityId);
    if (idx === -1) file.entities.push(state);
    else file.entities[idx] = state;
    writeFile(file);
  });
}

export function findEntityState(entityId: string): EntityState | undefined {
  return readFile().entities.find(e => e.entityId === entityId);
}

// Atomic key write — updates in-memory state + persists
export async function setStateKey(
  state: EntityState,
  key: string,
  value: unknown
): Promise<void> {
  state.data[key] = value;
  state.updatedAt = new Date().toISOString();
  await persistEntityState(state);
}

export function getStateKeys(
  state: EntityState,
  keys: string[]
): Record<string, unknown> {
  return Object.fromEntries(keys.map(k => [k, state.data[k] ?? null]));
}
