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

interface ProviderProps {
  children: ReactNode;
  homeActive: boolean;
  agentsRunning: boolean;
  chatStreaming: boolean;
  refreshKey?: number;
}

function pollDelayMs(homeActive: boolean, active: boolean): number {
  if (!homeActive) return POLL_BADGE_MS;
  return active ? POLL_HOME_ACTIVE_MS : POLL_HOME_IDLE_MS;
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
  const fetchGenRef = useRef(0);
  const homeActiveRef = useRef(homeActive);
  const activeRef = useRef(agentsRunning || chatStreaming);

  homeActiveRef.current = homeActive;
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
        setData({
          tasks: body.tasks ?? [],
          needsYou: body.needsYou ?? 0,
          suggestions: body.suggestions ?? 0,
          timeline: body.timeline ?? [],
          autonomy: body.autonomy ?? null,
        });
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
    if (homeActiveRef.current) {
      await fetchFeed(true);
      return;
    }
    await fetchFeed(false);
  }, [fetchFeed]);

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    setLoading(true);
    void fetchFeed(homeActive);
  }, [homeActive, fetchFeed]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      timeoutId = setTimeout(async () => {
        if (!document.hidden) {
          await fetchFeed(homeActiveRef.current);
        }
        schedule();
      }, pollDelayMs(homeActiveRef.current, activeRef.current));
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
