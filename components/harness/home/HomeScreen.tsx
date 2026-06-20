'use client';

import { useState } from 'react';
import ChatInterface from '../ChatInterface';
import TaskFeed from './TaskFeed';
import { IconBriefcase, IconMenu } from '../sidebar/icons';

interface SessionInfo {
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  entityType?: string;
  activeAgents: number;
}

interface Props {
  session: SessionInfo;
  onOpenStudio?: () => void;
  onOpenChats?: () => void;
  taskRefreshKey?: number;
  onTaskRefresh?: () => void;
}

export default function HomeScreen({
  session,
  onOpenStudio,
  onOpenChats,
  taskRefreshKey,
  onTaskRefresh,
}: Props) {
  const [workOpen, setWorkOpen] = useState(false);

  return (
    <div className="flex-1 flex min-h-0">
      <section className="flex-1 flex flex-col min-w-0 lg:border-r border-border bg-surface min-h-0">
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
              Type below to delegate — drafts and updates appear in Work.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWorkOpen(true)}
            className="lg:hidden shrink-0 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-medium text-foreground-muted hover:text-foreground hover:bg-surface-subtle border border-border"
            aria-label="Open work panel"
          >
            <IconBriefcase className="w-4 h-4" />
            Work
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-3 py-2 sm:px-4 lg:px-6 lg:py-3">
          <ChatInterface variant="home" onMessageComplete={onTaskRefresh} />
        </div>
      </section>

      <aside className="hidden lg:flex w-[380px] shrink-0 flex-col min-h-0 max-w-[42vw]">
        <TaskFeed
          session={session}
          onOpenStudio={onOpenStudio}
          refreshKey={taskRefreshKey}
        />
      </aside>

      {workOpen && (
        <>
          <button
            type="button"
            className="lg:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]"
            aria-label="Close work panel"
            onClick={() => setWorkOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col bg-surface shadow-xl border-l border-border">
            <div className="shrink-0 flex items-center justify-between h-12 px-3 border-b border-border">
              <span className="text-[13px] font-semibold text-foreground">Work</span>
              <button
                type="button"
                onClick={() => setWorkOpen(false)}
                className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-subtle"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <TaskFeed
                session={session}
                onOpenStudio={() => {
                  setWorkOpen(false);
                  onOpenStudio?.();
                }}
                refreshKey={taskRefreshKey}
              />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
