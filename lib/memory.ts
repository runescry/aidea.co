import * as fs from 'fs';
import * as path from 'path';
import type { MemoryFile, MemorySession } from '@/types';

const MEMORY_PATH = path.join(process.cwd(), 'data', 'memory.json');

let writeLock = false;

async function withLock(fn: () => void): Promise<void> {
  while (writeLock) await new Promise(r => setTimeout(r, 10));
  writeLock = true;
  try { fn(); } finally { writeLock = false; }
}

function ensureDataDir(): void {
  const dir = path.dirname(MEMORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readMemory(): MemoryFile {
  ensureDataDir();
  if (!fs.existsSync(MEMORY_PATH)) return { version: '1.0', sessions: [] };
  return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8')) as MemoryFile;
}

function writeMemory(memory: MemoryFile): void {
  ensureDataDir();
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2), 'utf-8');
}

export async function writeSession(session: MemorySession): Promise<void> {
  await withLock(() => {
    const memory = readMemory();
    const idx = memory.sessions.findIndex(s => s.sessionId === session.sessionId);
    if (idx === -1) memory.sessions.push(session);
    else memory.sessions[idx] = session;
    writeMemory(memory);
  });
}

export async function updateSession(session: MemorySession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await writeSession(session);
}

export function findSession(sessionId: string): MemorySession | undefined {
  return readMemory().sessions.find(s => s.sessionId === sessionId);
}
