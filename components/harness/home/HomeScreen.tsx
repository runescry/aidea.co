'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import ChatInterface from '../ChatInterface';
import TaskFeed from './TaskFeed';
import IntegrationStatusBar from './IntegrationStatusBar';
import EntityRunLauncher from './EntityRunLauncher';
import MorningBriefCard from './MorningBriefCard';
import FamilyWeekView from './family/FamilyWeekView';
import { IconBriefcase, IconMenu } from '../sidebar/icons';
import { type HomeRunnableEntity } from '@/lib/entities/run-meta';
import { useWorkFeed } from '@/hooks/useWorkFeed';
import type { PendingHumanInput } from '@/lib/client/human-input';
import { buildFamilyWeekView, formatFullDate } from '@/lib/harness/family-week';

const HOME_MODE_STORAGE_KEY = 'aidea-home-mode';
type HomeMode = 'family' | 'admin';

function isHomeMode(value: string | null): value is HomeMode {
  return value === 'family' || value === 'admin';
}

interface SessionInfo {
  status: 'idle' | 'starting' | 'running' | 'paused' | 'complete' | 'error';
  entityType?: string;
  entityId?: string;
  activeAgents: number;
}

interface Props {
  session: SessionInfo;
  onOpenStudio?: () => void;
  onOpenChats?: () => void;
  onOpenSettings?: () => void;
  onStartRun?: (entityType: HomeRunnableEntity, input: Record<string, unknown>) => void;
  runInProgress?: boolean;
  onTaskRefresh?: () => void;
  humanInputPending?: PendingHumanInput | null;
  chatPrefill?: string | null;
  onChatPrefillApplied?: () => void;
}

export default function HomeScreen({
  session,
  onOpenStudio,
  onOpenChats,
  onOpenSettings,
  onStartRun,
  runInProgress,
  onTaskRefresh,
  humanInputPending,
  chatPrefill: externalChatPrefill,
  onChatPrefillApplied,
}: Props) {
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [modeOverride, setModeOverride] = useState<HomeMode | null>(null);
  const { needsYou, tasks } = useWorkFeed();

  const briefTask = tasks.find(t => t.source === 'brief') ?? null;
  const familyView = useMemo(() => buildFamilyWeekView(briefTask?.brief ?? null), [briefTask]);

  useEffect(() => {
    const stored = window.localStorage.getItem(HOME_MODE_STORAGE_KEY);
    if (isHomeMode(stored)) setModeOverride(stored);
  }, []);

  const switchMode = useCallback((mode: HomeMode) => {
    setModeOverride(mode);
    window.localStorage.setItem(HOME_MODE_STORAGE_KEY, mode);
  }, []);

  const familyMode = familyView.hasFamilyData && (modeOverride ?? 'family') === 'family';

  const inboxInitialFilter = needsYou > 0 ? 'approval' as const : 'all' as const;

  const handleDiscussInChat = useCallback((prompt: string) => {
    setInboxOpen(false);
    setChatPrefill(prompt);
  }, []);

  const taskFeedProps = {
    session,
    onOpenStudio,
    onDiscussInChat: handleDiscussInChat,
    onTasksChanged: onTaskRefresh,
    humanInputPending,
  };

  if (familyMode) {
    const briefDate = typeof briefTask?.brief?.date === 'string' ? briefTask.brief.date : '';
    const dateLabel = formatFullDate(briefDate) || new Date().toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-surface-muted">
        <FamilyWeekView view={familyView} dateLabel={dateLabel} onManage={() => switchMode('admin')} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <section className="flex-1 flex flex-col min-w-0 min-h-0 lg:border-r border-border bg-surface">
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
              Type below to delegate — drafts and updates appear in Inbox.
            </p>
          </div>
          {familyView.hasFamilyData && (
            <button
              type="button"
              onClick={() => switchMode('family')}
              className="shrink-0 text-[12px] font-medium text-accent hover:text-accent/80 mr-1"
            >
              Family view
            </button>
          )}
          <button
            type="button"
            onClick={() => setInboxOpen(true)}
            className="lg:hidden shrink-0 relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-medium text-foreground-muted hover:text-foreground hover:bg-surface-subtle border border-border"
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
        </div>

        <IntegrationStatusBar onOpenSettings={onOpenSettings} />

        {onStartRun && (
          <div className="shrink-0 px-3 py-2 border-b border-border lg:px-6">
            <EntityRunLauncher disabled={runInProgress} onStartRun={onStartRun} />
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col px-3 py-2 sm:px-4 lg:px-6 lg:py-3 gap-2">
          {briefTask && (
            <MorningBriefCard
              task={briefTask}
              onOpenInbox={() => setInboxOpen(true)}
            />
          )}
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
      </section>

      <aside className="hidden lg:flex flex-col min-h-0 lg:w-[380px] lg:max-w-[42vw] shrink-0">
        <TaskFeed {...taskFeedProps} />
      </aside>

      {inboxOpen && (
        <>
          <button
            type="button"
            className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]"
            aria-label="Close inbox"
            onClick={() => setInboxOpen(false)}
          />
          <aside className="lg:hidden fixed inset-0 z-50 flex flex-col bg-surface">
            <TaskFeed
              key={`inbox-mobile-${inboxInitialFilter}`}
              {...taskFeedProps}
              initialFilter={inboxInitialFilter}
              onClose={() => setInboxOpen(false)}
              onOpenStudio={() => {
                setInboxOpen(false);
                onOpenStudio?.();
              }}
            />
          </aside>
        </>
      )}
    </div>
  );
}
