'use client';

import { useState, useCallback } from 'react';
import ChatInterface from '../ChatInterface';
import TaskFeed from './TaskFeed';
import IntegrationStatusBar from './IntegrationStatusBar';
import { IconMenu } from '../sidebar/icons';

interface SessionInfo {
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  entityType?: string;
  entityId?: string;
  activeAgents: number;
}

interface Props {
  session: SessionInfo;
  onOpenStudio?: () => void;
  onOpenChats?: () => void;
  onOpenSettings?: () => void;
  taskRefreshKey?: number;
  onTaskRefresh?: () => void;
}

export default function HomeScreen({
  session,
  onOpenStudio,
  onOpenChats,
  onOpenSettings,
  taskRefreshKey,
  onTaskRefresh,
}: Props) {
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);

  const handleDiscussInChat = useCallback((prompt: string) => {
    setChatPrefill(prompt);
  }, []);

  const taskFeed = (
    <TaskFeed
      session={session}
      onOpenStudio={onOpenStudio}
      refreshKey={taskRefreshKey}
      onDiscussInChat={handleDiscussInChat}
      onTasksChanged={onTaskRefresh}
    />
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <section className="flex-1 flex flex-col min-w-0 min-h-[45vh] lg:min-h-0 lg:border-r border-border bg-surface">
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
        </div>

        <IntegrationStatusBar onOpenSettings={onOpenSettings} refreshKey={taskRefreshKey} />

        <div className="flex-1 min-h-0 flex flex-col px-3 py-2 sm:px-4 lg:px-6 lg:py-3">
          <ChatInterface
            variant="home"
            onMessageComplete={onTaskRefresh}
            prefill={chatPrefill}
            onPrefillApplied={() => setChatPrefill(null)}
          />
        </div>
      </section>

      <aside className="flex flex-col min-h-0 h-[42vh] shrink-0 border-t border-border lg:h-auto lg:w-[380px] lg:max-w-[42vw] lg:border-t-0">
        {taskFeed}
      </aside>
    </div>
  );
}
