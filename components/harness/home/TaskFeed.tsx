'use client';

import { useState, useMemo, useEffect } from 'react';
import type { ActionStatus } from '@/lib/harness/queue';
import { ACTION_TYPE_LABELS } from '@/lib/harness/action-labels';
import type { TaskItem, TaskStatus } from '@/lib/harness/tasks';
import { formatTaskTime, sessionToTask, sortTaskItems, taskToChatPrompt } from '@/lib/harness/tasks';
import { patchQueueAction } from '@/lib/client/queue';
import { usePollingFetch } from '@/hooks/usePollingFetch';

type Filter = 'all' | 'needs_you' | 'done';

const STATUS_LABEL: Record<TaskStatus, string> = {
  needs_you: 'Needs you',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  needs_you: 'text-accent',
  running: 'text-accent',
  done: 'text-foreground-subtle',
  failed: 'text-danger',
};

const DOT_STYLE: Record<TaskStatus, string> = {
  needs_you: 'bg-accent',
  running: 'bg-accent animate-pulse',
  done: 'bg-foreground-subtle/40',
  failed: 'bg-danger',
};

interface SessionInfo {
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  entityType?: string;
  entityId?: string;
  activeAgents: number;
}

interface Props {
  session?: SessionInfo;
  onOpenStudio?: () => void;
  refreshKey?: number;
  onDiscussInChat?: (prompt: string) => void;
  onTasksChanged?: () => void;
}

function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: TaskItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border/60 transition-colors ${
        selected ? 'bg-accent/[0.04]' : 'hover:bg-surface-subtle/80'
      }`}
    >
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT_STYLE[task.status]}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-[13px] leading-snug truncate ${task.status === 'done' ? 'text-foreground-muted' : 'text-foreground'}`}>
            {task.title}
          </p>
          <span className="text-[11px] text-foreground-subtle shrink-0 tabular-nums">
            {formatTaskTime(task.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.subtitle && (
            <span className="text-[11px] text-foreground-subtle truncate">{task.subtitle}</span>
          )}
          <span className={`text-[10px] font-medium uppercase tracking-wide shrink-0 ${STATUS_STYLE[task.status]}`}>
            {STATUS_LABEL[task.status]}
          </span>
        </div>
      </div>
    </button>
  );
}

function TaskDetail({
  task,
  onStatusChange,
  onOpenStudio,
  onDiscussInChat,
}: {
  task: TaskItem;
  onStatusChange: (id: string, status: ActionStatus) => void;
  onOpenStudio?: () => void;
  onDiscussInChat?: (prompt: string) => void;
}) {
  const action = task.action;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-subtle mb-1">
            {STATUS_LABEL[task.status]}
          </p>
          <h3 className="text-[15px] font-medium text-foreground leading-snug">{task.title}</h3>
          {task.subtitle && (
            <p className="text-xs text-foreground-muted mt-1">{task.subtitle}</p>
          )}
        </div>

        {task.source === 'session' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-muted leading-relaxed">
              Agents are working in Studio. Open it to watch progress, inspect artifacts, and debug.
            </p>
            {onOpenStudio && (
              <button type="button" onClick={onOpenStudio} className="btn-primary text-sm">
                Open Studio
              </button>
            )}
          </div>
        )}

        {action?.detail && (
          <div className="rounded-lg bg-surface-subtle/80 p-3 text-sm text-foreground-muted leading-relaxed whitespace-pre-wrap border border-border/50">
            {action.detail}
          </div>
        )}

        {task.source === 'session' && task.preview && task.status === 'done' && (
          <div className="rounded-lg bg-surface-subtle/80 p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap border border-border/50">
            {task.preview}
          </div>
        )}

        {action?.type === 'kb_update' && action.payload?.patch != null && (
          <pre className="text-xs text-foreground-muted bg-surface-subtle rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap border border-border/50">
            {JSON.stringify(action.payload.patch, null, 2)}
          </pre>
        )}

        {action && !action.detail && action.type !== 'kb_update' && (
          <p className="text-xs text-foreground-subtle">
            {ACTION_TYPE_LABELS[action.type] ?? action.type} queued by {action.agentRole}
          </p>
        )}

        {onDiscussInChat && (
          <button
            type="button"
            onClick={() => onDiscussInChat(taskToChatPrompt(task))}
            className="text-sm font-medium text-accent hover:text-accent/80 transition-colors"
          >
            Discuss in chat →
          </button>
        )}
      </div>

      {action && task.status === 'needs_you' && (
        <div className="shrink-0 border-t border-border p-4 flex gap-2 bg-surface">
          <button
            type="button"
            onClick={() => onStatusChange(action.id, 'approved')}
            className="flex-1 py-2 text-sm font-medium bg-foreground text-surface rounded-lg hover:bg-foreground/90 transition-colors"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(action.id, 'rejected')}
            className="flex-1 py-2 text-sm font-medium text-foreground-muted rounded-lg border border-border hover:bg-surface-subtle transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export default function TaskFeed({ session, onOpenStudio, refreshKey = 0, onDiscussInChat, onTasksChanged }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);

  const { data, loading, refresh } = usePollingFetch(
    async () => {
      const res = await fetch('/api/tasks');
      if (!res.ok) return { tasks: [] as TaskItem[], needsYou: 0 };
      return res.json() as Promise<{ tasks: TaskItem[]; needsYou: number }>;
    },
    8000,
    [refreshKey],
  );

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  const tasks = data?.tasks ?? [];
  const needsYouCount = data?.needsYou ?? 0;

  const allTasks = useMemo(() => {
    if (!session || session.status === 'idle') return tasks;

    const live = sessionToTask({
      entityType: session.entityType,
      entityId: session.entityId,
      activeAgents: session.activeAgents,
      status: session.status,
    });
    if (!live) return tasks;

    const duplicate = live.entityId
      ? tasks.some(t => t.entityId === live.entityId)
      : tasks.some(t => t.source === 'session' && t.status === 'running');

    if (duplicate) return tasks;
    return sortTaskItems([live, ...tasks]);
  }, [tasks, session]);

  const filtered = useMemo(() => {
    if (filter === 'needs_you') return allTasks.filter(t => t.status === 'needs_you');
    if (filter === 'done') return allTasks.filter(t => t.status === 'done' || t.status === 'failed');
    return allTasks;
  }, [allTasks, filter]);

  const selected = filtered.find(t => t.id === selectedId) ?? allTasks.find(t => t.id === selectedId) ?? null;

  const handleStatusChange = async (id: string, status: ActionStatus) => {
    const result = await patchQueueAction(id, status);
    if (result.ok) {
      setActionFeedback({
        type: 'ok',
        message: status === 'approved' ? 'Approved' : 'Rejected',
      });
      setSelectedId(null);
      refresh();
      onTasksChanged?.();
      setTimeout(() => setActionFeedback(null), 2500);
    } else {
      setActionFeedback({ type: 'err', message: result.error });
    }
  };

  const filters: Array<{ id: Filter; label: string; count?: number }> = [
    { id: 'all', label: 'All' },
    { id: 'needs_you', label: 'Needs you', count: needsYouCount },
    { id: 'done', label: 'Done' },
  ];

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-foreground tracking-tight">Work</h2>
          {needsYouCount > 0 && (
            <span className="text-[11px] font-medium text-accent tabular-nums">
              {needsYouCount} waiting
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {filters.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setFilter(f.id); setSelectedId(null); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                filter === f.id
                  ? 'bg-foreground text-surface'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
              }`}
            >
              {f.label}
              {f.id === 'needs_you' && needsYouCount > 0 && (
                <span className="ml-1 opacity-80">{needsYouCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {actionFeedback && (
          <div
            className={`shrink-0 px-4 py-2 text-[12px] font-medium border-b ${
              actionFeedback.type === 'ok'
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'bg-danger/10 text-danger border-danger/20'
            }`}
          >
            {actionFeedback.message}
          </div>
        )}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-foreground-subtle">
            Loading…
          </div>
        ) : selected ? (
          <>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="shrink-0 px-4 py-2 text-[11px] text-foreground-muted hover:text-foreground border-b border-border text-left"
            >
              ← Back to list
            </button>
            <TaskDetail
              task={selected}
              onStatusChange={handleStatusChange}
              onOpenStudio={onOpenStudio}
              onDiscussInChat={onDiscussInChat}
            />
          </>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-foreground-muted">Nothing here yet</p>
            <p className="text-xs text-foreground-subtle mt-1 max-w-[220px] leading-relaxed">
              Ask your chief of staff to do something — drafts, research, and updates show up here.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filtered.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                selected={selectedId === task.id}
                onSelect={() => setSelectedId(task.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
