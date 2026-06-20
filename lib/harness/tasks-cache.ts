const DEV = process.env.NODE_ENV === 'development';
const TASKS_CACHE_MS = DEV ? 15_000 : 0;

let fullTasksCache: { at: number; body: unknown } | null = null;

export function getDevTasksCache(): unknown | null {
  if (!TASKS_CACHE_MS || !fullTasksCache) return null;
  if (Date.now() - fullTasksCache.at > TASKS_CACHE_MS) {
    fullTasksCache = null;
    return null;
  }
  return fullTasksCache.body;
}

export function setDevTasksCache(body: unknown): void {
  if (!TASKS_CACHE_MS) return;
  fullTasksCache = { at: Date.now(), body };
}

export function invalidateDevTasksCache(): void {
  fullTasksCache = null;
}
