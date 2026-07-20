'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { TaskItem } from '@/lib/harness/tasks';
import type { UserAutonomyPreference } from '@/lib/harness/proactive-tasks';
import {
  POLL_BADGE_MS,
  POLL_HOME_ACTIVE_MS,
  POLL_HOME_IDLE_MS,
} from '@/lib/client/poll-intervals';

export interface WorkFeedAutonomy {
  level: UserAutonomyPreference;
  label: string;
  hint: string;
}

interface WorkFeedPayload {
  tasks: TaskItem[];
  needsYou: number;
  suggestions: number;
  timeline: TaskItem[];
  autonomy: WorkFeedAutonomy | null;
}

interface WorkFeedContextValue {
  tasks: TaskItem[];
  needsYou: number;
  suggestions: number;
  timeline: TaskItem[];
  autonomy: WorkFeedAutonomy | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const WorkFeedContext = createContext<WorkFeedContextValue | null>(null);
const WORK_FEED_CACHE_PREFIX = 'aidea-work-feed-v1:';
const WORK_FEED_CACHE_MS = 2 * 60 * 1000;

interface CachedWorkFeedPayload {
  at: number;
  data: WorkFeedPayload;
}

async function currentWorkFeedCacheKey(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return null;
    const body = await res.json() as { userId?: string };
    return body.userId ? `${WORK_FEED_CACHE_PREFIX}${body.userId}` : null;
  } catch {
    return null;
  }
}

function readCachedWorkFeed(key: string): WorkFeedPayload | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedWorkFeedPayload;
    if (!cached?.data || Date.now() - cached.at > WORK_FEED_CACHE_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writeCachedWorkFeed(key: string, data: WorkFeedPayload): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data } satisfies CachedWorkFeedPayload));
  } catch {
    // quota or private mode
  }
}

export function clearCachedWorkFeed(): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(WORK_FEED_CACHE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // private mode
  }
}

interface ProviderProps {
  children: ReactNode;
  homeActive: boolean;
  profileActive?: boolean;
  agentsRunning: boolean;
  chatStreaming: boolean;
  refreshKey?: number;
}

function feedSurfaceActive(homeActive: boolean, profileActive: boolean): boolean {
  return homeActive || profileActive;
}

function pollDelayMs(surfaceActive: boolean, active: boolean): number {
  if (!surfaceActive) return POLL_BADGE_MS;
  return active ? POLL_HOME_ACTIVE_MS : POLL_HOME_IDLE_MS;
}

export function WorkFeedProvider({
  children,
  homeActive,
  profileActive = false,
  agentsRunning,
  chatStreaming,
  refreshKey = 0,
}: ProviderProps) {
  const [data, setData] = useState<WorkFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchGenRef = useRef(0);
  const cacheKeyRef = useRef<string | null>(null);
  const surfaceActiveRef = useRef(feedSurfaceActive(homeActive, profileActive));
  const activeRef = useRef(agentsRunning || chatStreaming);

  surfaceActiveRef.current = feedSurfaceActive(homeActive, profileActive);
  activeRef.current = agentsRunning || chatStreaming;

  const fetchFeed = useCallback(async (full: boolean) => {
    const gen = ++fetchGenRef.current;
    const url = full ? '/api/tasks' : '/api/tasks?summary=1';

    try {
      const res = await fetch(url);
      if (gen !== fetchGenRef.current) return;

      if (!res.ok) {
        if (!full) return;
        setData({ tasks: [], needsYou: 0, suggestions: 0, timeline: [], autonomy: null });
        return;
      }
      const body = await res.json() as Partial<WorkFeedPayload> & { needsYou?: number; suggestions?: number };
      if (gen !== fetchGenRef.current) return;

      if (full) {
        const nextData = {
          tasks: body.tasks ?? [],
          needsYou: body.needsYou ?? 0,
          suggestions: body.suggestions ?? 0,
          timeline: body.timeline ?? [],
          autonomy: body.autonomy ?? null,
        };
        setData(nextData);
        if (cacheKeyRef.current) writeCachedWorkFeed(cacheKeyRef.current, nextData);
      } else if (typeof body.needsYou === 'number') {
        setData(prev => ({
          tasks: prev?.tasks ?? [],
          needsYou: body.needsYou!,
          suggestions: body.suggestions ?? prev?.suggestions ?? 0,
          timeline: prev?.timeline ?? [],
          autonomy: prev?.autonomy ?? null,
        }));
      }
    } catch {
      // ignore transient network errors; next poll will retry
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (surfaceActiveRef.current) {
      await fetchFeed(true);
      return;
    }
    await fetchFeed(false);
  }, [fetchFeed]);

  useEffect(() => {
    let cancelled = false;
    void currentWorkFeedCacheKey().then(key => {
      if (cancelled || !key) return;
      cacheKeyRef.current = key;
      const cached = readCachedWorkFeed(key);
      if (!cached) return;
      setData(cached);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    setLoading(true);
    void fetchFeed(feedSurfaceActive(homeActive, profileActive));
  }, [homeActive, profileActive, fetchFeed]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timeoutId = setTimeout(async () => {
        if (!document.hidden) {
          await fetchFeed(surfaceActiveRef.current);
        }
        schedule();
      }, pollDelayMs(surfaceActiveRef.current, activeRef.current));
    };

    schedule();
    return () => clearTimeout(timeoutId);
  }, [fetchFeed]);

  const value = useMemo<WorkFeedContextValue>(() => ({
    tasks: data?.tasks ?? [],
    needsYou: data?.needsYou ?? 0,
    suggestions: data?.suggestions ?? 0,
    timeline: data?.timeline ?? [],
    autonomy: data?.autonomy ?? null,
    loading: loading && !data,
    refresh,
  }), [data, loading, refresh]);

  return (
    <WorkFeedContext.Provider value={value}>
      {children}
    </WorkFeedContext.Provider>
  );
}

export function useWorkFeed(): WorkFeedContextValue {
  const ctx = useContext(WorkFeedContext);
  if (!ctx) throw new Error('useWorkFeed must be used within WorkFeedProvider');
  return ctx;
}
