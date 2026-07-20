import * as fs from 'fs';
import * as path from 'path';
import type { EntityState } from '@/lib/harness/types';
import type { QueuedAction } from '@/lib/harness/queue-types';
import type { AppSettings } from '@/lib/settings';
import type { ChatConversation, ChatStore } from '@/types/chat';
import { emptyChatStore, normalizeChatStore } from '@/lib/chat/store-utils';
import {
  ensureActiveId,
  parseLegacyChatStore,
} from './chat-conversations';

const DATA_DIR = path.join(process.cwd(), 'data');
const CHAT_DIR = path.join(DATA_DIR, 'chat');
const CHAT_CONVERSATIONS_DIR = path.join(CHAT_DIR, 'conversations');
const CHAT_META_FILE = path.join(CHAT_DIR, 'meta.json');
const LEGACY_CHAT_FILE = 'chat-store.json';

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

export function readIntegrationCredential<T>(provider: string): T | null {
  return readJson<Record<string, T>>('integration-credentials.json', {})[provider] ?? null;
}

export function writeIntegrationCredential(provider: string, data: unknown | null): void {
  const credentials = readJson<Record<string, unknown>>('integration-credentials.json', {});
  if (data === null) delete credentials[provider];
  else credentials[provider] = data;
  writeJson('integration-credentials.json', credentials);
}

export function getQueueAction(id: string): QueuedAction | null {
  return listQueue().find(action => action.id === id) ?? null;
}

export function listQueue(): QueuedAction[] {
  return readJson('action-queue.json', []);
}

export function countPendingQueue(): number {
  return listQueue().filter(action => action.status === 'pending').length;
}

export function saveQueueAction(action: QueuedAction): void {
  const all = listQueue();
  const idx = all.findIndex(a => a.id === action.id);
  if (idx === -1) all.push(action);
  else all[idx] = action;
  writeJson('action-queue.json', all);
}

export function claimQueueAction(action: QueuedAction): QueuedAction | null {
  const all = listQueue();
  const idx = all.findIndex(candidate => candidate.id === action.id && candidate.status === 'pending');
  if (idx === -1) return null;
  const claimed = { ...action, status: 'executing' as const };
  all[idx] = claimed;
  writeJson('action-queue.json', all);
  return claimed;
}

export function replaceQueue(actions: QueuedAction[]): void {
  writeJson('action-queue.json', actions);
}

export function listQueueAudit(): import('@/lib/harness/queue-audit').QueueAuditEntry[] {
  return readJson('action-audit.json', []);
}

export function appendQueueAudit(
  entry: import('@/lib/harness/queue-audit').QueueAuditEntry
): void {
  const all = listQueueAudit();
  all.push(entry);
  writeJson('action-audit.json', all);
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

function migrateLegacyChatStoreFs(): void {
  if (fs.existsSync(CHAT_META_FILE)) return;

  const legacy = readJson<ChatStore | null>(LEGACY_CHAT_FILE, null);
  if (!legacy) return;

  const parsed = parseLegacyChatStore(legacy);
  if (!parsed) return;

  writeChatStore(parsed);

  const legacyPath = path.join(DATA_DIR, LEGACY_CHAT_FILE);
  if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
}

function readChatMeta(): { activeId: string } | null {
  ensureDir();
  if (!fs.existsSync(CHAT_DIR)) return null;
  if (!fs.existsSync(CHAT_META_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHAT_META_FILE, 'utf-8')) as { activeId: string };
  } catch {
    return null;
  }
}

function writeChatMeta(activeId: string): void {
  ensureDir();
  if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR, { recursive: true });
  fs.writeFileSync(CHAT_META_FILE, JSON.stringify({ activeId }, null, 2), 'utf-8');
}

function listConversationFiles(): string[] {
  ensureDir();
  if (!fs.existsSync(CHAT_CONVERSATIONS_DIR)) return [];
  return fs.readdirSync(CHAT_CONVERSATIONS_DIR).filter(f => f.endsWith('.json'));
}

function readConversationFile(fileName: string): ChatConversation | null {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(CHAT_CONVERSATIONS_DIR, fileName), 'utf-8'),
    );
    if (!raw?.id || !raw?.title) return null;
    return raw as ChatConversation;
  } catch {
    return null;
  }
}

export function readChatStore(): ChatStore | null {
  migrateLegacyChatStoreFs();

  const files = listConversationFiles();
  if (files.length === 0) return null;

  const conversations = files
    .map(readConversationFile)
    .filter((c): c is ChatConversation => c !== null);

  if (conversations.length === 0) return null;

  const meta = readChatMeta();
  return normalizeChatStore({
    conversations,
    activeId: meta?.activeId ?? conversations[0].id,
  });
}

export function writeChatStore(data: ChatStore): void {
  const store = ensureActiveId(data);
  ensureDir();
  if (!fs.existsSync(CHAT_CONVERSATIONS_DIR)) {
    fs.mkdirSync(CHAT_CONVERSATIONS_DIR, { recursive: true });
  }

  const keepIds = new Set(store.conversations.map(c => c.id));
  for (const file of listConversationFiles()) {
    const id = file.replace(/\.json$/, '');
    if (!keepIds.has(id)) {
      fs.unlinkSync(path.join(CHAT_CONVERSATIONS_DIR, file));
    }
  }

  for (const conversation of store.conversations) {
    fs.writeFileSync(
      path.join(CHAT_CONVERSATIONS_DIR, `${conversation.id}.json`),
      JSON.stringify(conversation, null, 2),
      'utf-8',
    );
  }

  writeChatMeta(store.activeId);
}

export function deleteChatConversation(id: string): ChatStore {
  migrateLegacyChatStoreFs();

  const filePath = path.join(CHAT_CONVERSATIONS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  let store = readChatStore();
  if (!store || store.conversations.length === 0) {
    store = emptyChatStore();
    writeChatStore(store);
    return store;
  }

  store = ensureActiveId(store);
  writeChatMeta(store.activeId);
  return store;
}

export function clearActivityHistory(): void {
  replaceQueue([]);
  writeJson('action-audit.json', []);
  writeJson('harness-state.json', { version: '1.0', entities: [] });
  const briefPath = path.join(DATA_DIR, 'latest-brief.json');
  if (fs.existsSync(briefPath)) fs.unlinkSync(briefPath);
  writeChatStore(emptyChatStore());
}
