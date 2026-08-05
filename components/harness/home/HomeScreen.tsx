'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import ChatInterface from '../ChatInterface';
import IntegrationStatusBar from './IntegrationStatusBar';
import EntityRunLauncher from './EntityRunLauncher';
import MorningBriefCard from './MorningBriefCard';
import SchoolCard from './SchoolCard';
import SchoolWeekPanel from './SchoolWeekPanel';
import HomeSectionHeader from './HomeSectionHeader';
import FamilyWeekView from './family/FamilyWeekView';
import FamilyHomeFallback from './FamilyHomeFallback';
import { useBuilderNav } from '@/hooks/useBuilderNav';
import { IconBriefcase, IconMenu } from '../sidebar/icons';
import { type HomeRunnableEntity } from '@/lib/entities/run-meta';
import { useWorkFeed } from '@/hooks/useWorkFeed';
import type { HomePanelFocus } from '@/lib/client/home-panel-focus';
import { toggleHomePanelFocus } from '@/lib/client/home-panel-focus';
import type { SchoolFeed } from '@/types/knowledge-base';
import { buildFamilyWeekView, formatFullDate } from '@/lib/harness/family-week';

const HOME_MODE_STORAGE_KEY = 'aidea-home-mode';
type HomeMode = 'family' | 'admin';

function isHomeMode(value: string | null): value is HomeMode {
  return value === 'family' || value === 'admin';
}

/** Browser-local YYYY-MM-DD — matches SchoolTodayPanel's own "today" so the two never disagree. */
function todayYmdLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

interface Props {
  /** Hydrated on the server for PPR — avoids admin→family flash on load. */
  initialFeed?: SchoolFeed | null;
  /** PPR Suspense fallback — prefer family skeleton over admin chrome. */
  feedPending?: boolean;
  onOpenChats?: () => void;
  onOpenSettings?: () => void;
  onOpenInbox?: () => void;
  onStartRun?: (entityType: HomeRunnableEntity, input: Record<string, unknown>) => void;
  runInProgress?: boolean;
  onTaskRefresh?: () => void;
  chatPrefill?: string | null;
  onChatPrefillApplied?: () => void;
}

export default function HomeScreen({
  initialFeed = null,
  feedPending = false,
  onOpenChats,
  onOpenSettings,
  onOpenInbox,
  onStartRun,
  runInProgress,
  onTaskRefresh,
  chatPrefill: externalChatPrefill,
  onChatPrefillApplied,
}: Props) {
  const [panelFocus, setPanelFocus] = useState<HomePanelFocus | null>(null);
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const [schoolRefreshKey, setSchoolRefreshKey] = useState(0);
  const [schoolSyncing, setSchoolSyncing] = useState(false);
  const [schoolSyncError, setSchoolSyncError] = useState<string | null>(null);
  const [feed, setFeed] = useState<SchoolFeed | null>(initialFeed);
  const [modeOverride, setModeOverride] = useState<HomeMode | null>(null);
  const { needsYou, tasks } = useWorkFeed();
  const { builderNav } = useBuilderNav();

  const briefTask = tasks.find(t => t.source === 'brief') ?? null;

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/school-feed')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { feed: SchoolFeed | null } | null) => {
        if (!cancelled) setFeed(data?.feed ?? null);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [schoolRefreshKey]);

  const familyView = useMemo(() => buildFamilyWeekView(feed, todayYmdLocal()), [feed]);

  useEffect(() => {
    const stored = window.localStorage.getItem(HOME_MODE_STORAGE_KEY);
    if (isHomeMode(stored)) setModeOverride(stored);
  }, []);

  const switchMode = useCallback((mode: HomeMode) => {
    setModeOverride(mode);
    window.localStorage.setItem(HOME_MODE_STORAGE_KEY, mode);
  }, []);

  const handleSchoolSync = useCallback(async () => {
    setSchoolSyncing(true);
    setSchoolSyncError(null);
    try {
      const res = await fetch('/api/school-feed/sync', { method: 'POST' });
      const data = await res.json() as {
        ok?: boolean;
        inbox?: { error?: string };
        calendar?: { error?: string };
        result?: { error?: string };
        error?: string;
      };
      if (!res.ok) {
        setSchoolSyncError(
          data.calendar?.error ?? data.inbox?.error ?? data.result?.error ?? data.error
            ?? 'School sync failed — check Gmail and Calendar are connected in Settings',
        );
        return;
      }
      if (data.calendar?.error && !data.inbox?.error) {
        setSchoolSyncError(`Gmail synced; calendar: ${data.calendar.error}`);
      } else if (data.inbox?.error && !data.calendar?.error) {
        setSchoolSyncError(`Calendar synced; Gmail: ${data.inbox.error}`);
      }
      setSchoolRefreshKey(key => key + 1);
    } catch {
      setSchoolSyncError('School sync failed — check Gmail is connected in Settings');
    } finally {
      setSchoolSyncing(false);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanelFocus(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (initialFeed !== null) setFeed(initialFeed);
  }, [initialFeed]);

  // An incoming chat prefill (e.g. "Discuss in chat" from Inbox) always needs the chat surface
  // visible — family mode doesn't mount ChatInterface, so it would otherwise swallow the draft.
  const prefersFamily = (modeOverride ?? 'family') === 'family';
  const familyMode = !externalChatPrefill && prefersFamily && (feedPending || familyView.hasFamilyData);

  const schoolExpanded = panelFocus === 'school';
  const chatExpanded = panelFocus === 'chat';
  const showSchool = panelFocus !== 'chat';
  const showChat = panelFocus !== 'school';

  const togglePanel = (panel: HomePanelFocus) => {
    setPanelFocus(current => toggleHomePanelFocus(current, panel));
  };

  if (familyMode && feedPending && !familyView.hasFamilyData) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-surface-muted">
        <FamilyHomeFallback />
      </div>
    );
  }

  if (familyMode && familyView.hasFamilyData) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-surface-muted">
        <FamilyWeekView
          view={familyView}
          dateLabel={formatFullDate(todayYmdLocal())}
          onManage={() => switchMode('admin')}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <section className="flex flex-col min-w-0 min-h-0 flex-1 bg-surface lg:border-r border-border">
        <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border lg:px-6 lg:py-3">
          <button
            type="button"
            onClick={onOpenChats}
            className="md:hidden p-2 -ml-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-subtle"
            aria-label="Open chats"
          >
            <IconMenu />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-foreground tracking-tight truncate">
              Chief of staff
            </h2>
            <p className="text-[11px] text-foreground-subtle mt-0.5 hidden sm:block truncate">
              School mail & chat · calendar on the right
            </p>
          </div>
          {familyView.hasFamilyData && (
            <button
              type="button"
              onClick={() => switchMode('family')}
              className="shrink-0 text-[12px] font-medium text-accent hover:text-accent/80"
            >
              Family view
            </button>
          )}
          {onOpenInbox && (
            <button
              type="button"
              onClick={onOpenInbox}
              className="md:hidden shrink-0 relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-medium text-foreground-muted hover:text-foreground hover:bg-surface-subtle border border-border"
              aria-label="Open inbox"
            >
              <IconBriefcase className="w-4 h-4" />
              Inbox
              {needsYou > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-surface tabular-nums">
                  {needsYou > 9 ? '9+' : needsYou}
                </span>
              )}
            </button>
          )}
        </div>

        <IntegrationStatusBar onOpenSettings={onOpenSettings} />

        {builderNav && onStartRun && (
          <div className="shrink-0 px-3 py-2 border-b border-border lg:px-6">
            <EntityRunLauncher disabled={runInProgress} onStartRun={onStartRun} />
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {showSchool && (
            <div
              className={`flex flex-col min-h-0 border-b border-border bg-surface-muted/40 ${
                schoolExpanded ? 'flex-1' : 'shrink-0 max-h-[min(50vh,480px)]'
              }`}
            >
              <HomeSectionHeader
                title="School updates"
                subtitle="Gmail triage — tap an item to open in mail"
                titleUppercase
                expanded={schoolExpanded}
                onToggleExpand={() => togglePanel('school')}
                onSync={handleSchoolSync}
                syncing={schoolSyncing}
              />
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 sm:px-4 lg:px-6 space-y-2">
                {briefTask && (
                  <MorningBriefCard
                    task={briefTask}
                    onOpenInbox={onOpenInbox}
                  />
                )}
                <SchoolWeekPanel
                  refreshKey={schoolRefreshKey}
                  className="lg:hidden"
                />
                <SchoolCard hideTitle refreshKey={schoolRefreshKey} syncError={schoolSyncError} />
              </div>
            </div>
          )}

          {showChat && (
            <div
              className={`flex flex-col min-h-0 bg-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] border-t border-border ${
                chatExpanded ? 'flex-1' : 'flex-1 min-h-[12rem]'
              }`}
            >
              <HomeSectionHeader
                title="Chat"
                subtitle="Delegate research, drafts, and schedule checks"
                expanded={chatExpanded}
                onToggleExpand={() => togglePanel('chat')}
              />
              <div className="flex-1 min-h-0 px-3 sm:px-4 lg:px-6">
                <ChatInterface
                  variant="home"
                  onMessageComplete={onTaskRefresh}
                  prefill={externalChatPrefill ?? chatPrefill}
                  onPrefillApplied={() => {
                    onChatPrefillApplied?.();
                    setChatPrefill(null);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <aside className="hidden lg:flex lg:w-[380px] lg:max-w-[42vw] flex-col min-h-0 shrink-0">
        <SchoolWeekPanel
          refreshKey={schoolRefreshKey}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain border-b-0"
        />
      </aside>
    </div>
  );
}
