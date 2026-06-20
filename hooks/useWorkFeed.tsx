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

export interface WorkFeedAutonomy {
  level: UserAutonomyPreference;
  label: string;
  hint: string;
}

interface WorkFeedPayload {
  tasks: TaskItem[];
  needsYou: number;
  suggestions: number;
  autonomy: WorkFeedAutonomy | null;
}

interface WorkFeedContextValue {
  tasks: TaskItem[];
  needsYou: number;
  suggestions: number;
  autonomy: WorkFeedAutonomy | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const WorkFeedContext = createContext<WorkFeedContextValue | null>(null);

const POLL_HOME_IDLE_MS = 20_000;
const POLL_HOME_ACTIVE_MS = 6_000;
const POLL_BADGE_MS = 45_000;

interface ProviderProps {
  children: ReactNode;
  homeActive: boolean;
  agentsRunning: boolean;
  chatStreaming: boolean;
  refreshKey?: number;
}

export function WorkFeedProvider({
  children,
  homeActive,
  agentsRunning,
  chatStreaming,
  refreshKey = 0,
}: ProviderProps) {
  const [data, setData] = useState<WorkFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<AbortController | null>(null);

  const fetchFeed = useCallback(async (full: boolean) => {
    inFlightRef.current?.abort();
    const abort = new AbortController();
    inFlightRef.current = abort;

    const url = full ? '/api/tasks' : '/api/tasks?summary=1';
    try {
      const res = await fetch(url, { signal: abort.signal });
      if (!res.ok) {
        if (!full) return;
        setData({ tasks: [], needsYou: 0, suggestions: 0, autonomy: null });
        return;
      }
      const body = await res.json() as Partial<WorkFeedPayload> & { needsYou?: number; suggestions?: number };
      if (abort.signal.aborted) return;

      if (full) {
        setData({
          tasks: body.tasks ?? [],
          needsYou: body.needsYou ?? 0,
          suggestions: body.suggestions ?? 0,
          autonomy: body.autonomy ?? null,
        });
      } else if (typeof body.needsYou === 'number') {
        setData(prev => ({
          tasks: prev?.tasks ?? [],
          needsYou: body.needsYou!,
          suggestions: body.suggestions ?? prev?.suggestions ?? 0,
          autonomy: prev?.autonomy ?? null,
        }));
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchFeed(homeActive);
  }, [fetchFeed, homeActive]);

  const active = agentsRunning || chatStreaming;

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const tick = () => {
      if (document.hidden) return;
      fetchFeed(homeActive);
    };

    const intervalMs = homeActive
      ? (active ? POLL_HOME_ACTIVE_MS : POLL_HOME_IDLE_MS)
      : POLL_BADGE_MS;

    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [homeActive, active, fetchFeed]);

  const value = useMemo<WorkFeedContextValue>(() => ({
    tasks: data?.tasks ?? [],
    needsYou: data?.needsYou ?? 0,
    suggestions: data?.suggestions ?? 0,
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
