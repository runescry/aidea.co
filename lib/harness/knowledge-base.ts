import * as fs from 'fs';
import * as path from 'path';

const KB_PATH = path.join(process.cwd(), 'data', 'knowledge-base.json');

let writeLock = false;

async function withLock(fn: () => void): Promise<void> {
  while (writeLock) await new Promise(r => setTimeout(r, 10));
  writeLock = true;
  try { fn(); } finally { writeLock = false; }
}

function ensureDataDir(): void {
  const dir = path.dirname(KB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFile(): Record<string, unknown> {
  ensureDataDir();
  if (!fs.existsSync(KB_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(KB_PATH, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeFile(data: Record<string, unknown>): void {
  ensureDataDir();
  fs.writeFileSync(KB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function readKB(keys: string[]): Record<string, unknown> {
  const data = readFile();
  return Object.fromEntries(keys.map(k => [k, getNestedKey(data, k) ?? null]));
}

export function readAllKB(): Record<string, unknown> {
  return readFile();
}

export async function writeKB(key: string, value: unknown): Promise<void> {
  await withLock(() => {
    const data = readFile();
    setNestedKey(data, key, value);
    writeFile(data);
  });
}

export async function writeManyKB(updates: Record<string, unknown>): Promise<void> {
  await withLock(() => {
    const data = readFile();
    for (const [k, v] of Object.entries(updates)) {
      setNestedKey(data, k, v);
    }
    writeFile(data);
  });
}

// Supports dot-notation: "family.children" → data.family.children
function getNestedKey(obj: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((curr, part) => {
    if (curr && typeof curr === 'object') return (curr as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

function setNestedKey(obj: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof curr[parts[i]] !== 'object' || curr[parts[i]] === null) {
      curr[parts[i]] = {};
    }
    curr = curr[parts[i]] as Record<string, unknown>;
  }
  curr[parts[parts.length - 1]] = value;
}
