'use client';

import ChatInterface from '../ChatInterface';
import TaskFeed from './TaskFeed';

interface SessionInfo {
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  entityType?: string;
  activeAgents: number;
}

interface Props {
  session: SessionInfo;
  onOpenStudio?: () => void;
  taskRefreshKey?: number;
  onTaskRefresh?: () => void;
}

export default function HomeScreen({ session, onOpenStudio, taskRefreshKey, onTaskRefresh }: Props) {
  return (
    <div className="flex-1 flex min-h-0">
      <section className="flex-1 flex flex-col min-w-0 border-r border-border bg-surface min-h-0">
        <div className="shrink-0 px-6 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-foreground tracking-tight">Chief of staff</h2>
          <p className="text-[11px] text-foreground-subtle mt-0.5">
            Type below to delegate — drafts and updates appear in Work on the right.
          </p>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-6 py-3">
          <ChatInterface variant="home" onMessageComplete={onTaskRefresh} />
        </div>
      </section>

      <aside className="w-[380px] shrink-0 flex flex-col min-h-0 max-w-[42vw]">
        <TaskFeed
          session={session}
          onOpenStudio={onOpenStudio}
          refreshKey={taskRefreshKey}
        />
      </aside>
    </div>
  );
}
