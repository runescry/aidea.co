'use client';

import { useState, useMemo, useEffect } from 'react';
import type { QueueEditOverrides, QueueIntent } from '@/lib/harness/queue-types';
import { ACTION_TYPE_LABELS } from '@/lib/harness/action-labels';
import { isEmailQueueAction, normalizeEmailQueueAction } from '@/lib/harness/normalize-queue-action';
import type { TaskItem, TaskStatus } from '@/lib/harness/tasks';
import { formatTaskTime, sessionToTask, sortTaskItems, taskToChatPrompt } from '@/lib/harness/tasks';
import { queueActionAutonomyNote } from '@/lib/harness/proactive-tasks';
import { describeKbUpdate } from '@/lib/harness/kb-update-display';
import type { UserAutonomyPreference } from '@/lib/harness/proactive-tasks';
import { patchQueueAction, patchQueueActions } from '@/lib/client/queue';
import { patchSuggestion } from '@/lib/client/suggestions';
import { useWorkFeed } from '@/hooks/useWorkFeed';
import { Label, TextArea, TextField } from '@/components/harness/forms';
import MorningBriefRenderer from '@/components/harness/MorningBriefRenderer';

type Filter = 'all' | 'approval' | 'suggestions' | 'running' | 'done';

const STATUS_LABEL: Record<TaskStatus, string> = {
  needs_you: 'Awaiting approval',
  suggestion: 'Suggestion',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  needs_you: 'text-accent',
  suggestion: 'text-foreground-muted',
  running: 'text-accent',
  done: 'text-foreground-subtle',
  failed: 'text-danger',
};

const DOT_STYLE: Record<TaskStatus, string> = {
  needs_you: 'bg-accent',
  suggestion: 'bg-foreground-subtle/60',
  running: 'bg-accent animate-pulse',
  done: 'bg-foreground-subtle/40',
  failed: 'bg-danger',
};

interface SessionInfo {
  status: 'idle' | 'starting' | 'running' | 'paused' | 'complete' | 'error';
  entityType?: string;
  entityId?: string;
  activeAgents: number;
}

interface Props {
  session?: SessionInfo;
  onOpenStudio?: () => void;
  onDiscussInChat?: (prompt: string) => void;
  onTasksChanged?: () => void;
  initialFilter?: Filter;
  onClose?: () => void;
}

function isBulkEligible(task: TaskItem): boolean {
  return task.status === 'needs_you' && task.action != null;
}

function queueExecutionError(action?: { payload?: Record<string, unknown> }): string | null {
  return typeof action?.payload?.executionError === 'string'
    ? action.payload.executionError
    : null;
}

function bulkResultMessage(intent: QueueIntent, results: Array<{ action?: { status: string; payload?: Record<string, unknown> } }>): { type: 'ok' | 'err'; message: string } {
  const succeeded = results.filter(r => {
    if (!r.action) return false;
    if (intent === 'reject') return r.action.status === 'rejected';
    if (intent === 'save') return r.action.status === 'saved';
    return r.action.status === 'executed' || r.action.status === 'approved';
  }).length;
  const failed = results.filter(r => r.action?.status === 'failed').length;
  const firstError = results.map(r => queueExecutionError(r.action)).find(Boolean) ?? null;

  if (intent === 'reject') {
    return { type: 'ok', message: succeeded === 1 ? 'Rejected 1 item' : `Rejected ${succeeded} items` };
  }
  if (intent === 'save') {
    if (failed > 0 && succeeded > 0) {
      return {
        type: 'err',
        message: firstError
          ? `Saved ${succeeded}, ${failed} failed — ${firstError}`
          : `Saved ${succeeded}, ${failed} failed`,
      };
    }
    if (failed > 0) {
      if (failed === 1 && firstError) {
        return { type: 'err', message: firstError };
      }
      return { type: 'err', message: failed === 1 ? 'Could not save draft' : `Could not save ${failed} drafts` };
    }
    return { type: 'ok', message: succeeded === 1 ? 'Saved to Gmail drafts' : `Saved ${succeeded} drafts` };
  }

  if (failed > 0 && succeeded > 0) {
    return { type: 'err', message: `Sent ${succeeded}, ${failed} failed` };
  }
  if (failed > 0) {
    return { type: 'err', message: failed === 1 ? 'Send failed — try Save to drafts' : `${failed} sends failed` };
  }
  if (succeeded === 0) {
    return { type: 'err', message: 'No items updated' };
  }
  return { type: 'ok', message: succeeded === 1 ? 'Sent' : `Sent ${succeeded} items` };
}

function TaskRow({
  task,
  selected,
  onSelect,
  bulkMode,
  checked,
  onToggleCheck,
}: {
  task: TaskItem;
  selected: boolean;
  onSelect: () => void;
  bulkMode?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
}) {
  return (
    <div
      className={`w-full flex items-start gap-2 border-b border-border/60 transition-colors ${
        selected ? 'bg-accent/[0.04]' : 'hover:bg-surface-subtle/80'
      }`}
    >
      {bulkMode && (
        <label className="shrink-0 pl-3 pt-3.5 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleCheck}
            className="w-4 h-4 rounded border-border accent-accent"
            aria-label={`Select ${task.title}`}
          />
        </label>
      )}
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left px-4 py-3 flex items-start gap-3"
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
    </div>
  );
}

function payloadString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function buildEmailEdits(
  draftBody: string,
  initialBody: string,
  draftSubject: string,
  initialSubject: string,
  draftTo: string,
  initialTo: string,
  draftCc: string,
  initialCc: string,
): QueueEditOverrides | undefined {
  const edits: QueueEditOverrides = {};
  if (draftBody !== initialBody) edits.body = draftBody;
  if (initialSubject && draftSubject !== initialSubject) edits.subject = draftSubject;
  if (draftTo !== initialTo) edits.to = draftTo;
  if (draftCc !== initialCc) edits.cc = draftCc;
  return Object.keys(edits).length > 0 ? edits : undefined;
}

function TaskDetail({
  task,
  onIntent,
  onOpenStudio,
  onDiscussInChat,
  onSuggestionAction,
  autonomyLevel,
  actionPending,
}: {
  task: TaskItem;
  onIntent: (id: string, intent: QueueIntent, edits?: QueueEditOverrides) => void;
  onOpenStudio?: () => void;
  onDiscussInChat?: (prompt: string) => void;
  onSuggestionAction?: (id: string, action: 'dismiss' | 'snooze', days?: number) => void;
  autonomyLevel?: UserAutonomyPreference;
  actionPending?: boolean;
}) {
  const action = task.action;
  const showSave = action != null && isEmailQueueAction(action);
  const isKbUpdate = action?.type === 'kb_update';
  const approveLabel = isKbUpdate ? 'Apply update' : 'Approve & send';
  const isEmailDraft = action != null && showSave && task.status === 'needs_you';
  const normalized = useMemo(
    () => (action ? normalizeEmailQueueAction(action) : null),
    [action],
  );
  const initialBody = normalized?.detail ?? '';
  const initialSubject = typeof normalized?.payload.subject === 'string'
    ? normalized.payload.subject
    : '';
  const initialTo = payloadString(normalized?.payload.to);
  const initialCc = payloadString(normalized?.payload.cc);
  const [draftBody, setDraftBody] = useState(initialBody);
  const [draftSubject, setDraftSubject] = useState(initialSubject);
  const [draftTo, setDraftTo] = useState(initialTo);
  const [draftCc, setDraftCc] = useState(initialCc);

  useEffect(() => {
    setDraftBody(initialBody);
    setDraftSubject(initialSubject);
    setDraftTo(initialTo);
    setDraftCc(initialCc);
  }, [action?.id, initialBody, initialSubject, initialTo, initialCc]);

  const emailEdits = isEmailDraft
    ? buildEmailEdits(draftBody, initialBody, draftSubject, initialSubject, draftTo, initialTo, draftCc, initialCc)
    : undefined;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-5 pb-6 space-y-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-subtle mb-1">
            {STATUS_LABEL[task.status]}
          </p>
          <h3 className="text-[15px] font-medium text-foreground leading-snug">{task.title}</h3>
          {task.subtitle && (
            <p className="text-xs text-foreground-muted mt-1">{task.subtitle}</p>
          )}
        </div>

        {task.source === 'brief' && task.brief && (
          <MorningBriefRenderer data={task.brief as unknown as Parameters<typeof MorningBriefRenderer>[0]['data']} />
        )}

        {task.source === 'proactive' && (
          <p className="text-sm text-foreground-muted leading-relaxed">
            A reminder from your profile or relationship monitor — not waiting for approval.
            Use chat to act on it or update your Context.
          </p>
        )}

        {task.source === 'proactive' && onSuggestionAction && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onSuggestionAction(task.id, 'dismiss')}
              className="text-sm font-medium text-foreground-muted rounded-lg border border-border px-3 py-2 hover:bg-surface-subtle disabled:opacity-50"
            >
              Dismiss
            </button>
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onSuggestionAction(task.id, 'snooze', 1)}
              className="text-sm font-medium text-foreground-muted rounded-lg border border-border px-3 py-2 hover:bg-surface-subtle disabled:opacity-50"
            >
              Snooze 1 day
            </button>
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onSuggestionAction(task.id, 'snooze', 7)}
              className="text-sm font-medium text-foreground-muted rounded-lg border border-border px-3 py-2 hover:bg-surface-subtle disabled:opacity-50"
            >
              Snooze 1 week
            </button>
          </div>
        )}

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

        {isEmailDraft ? (
          <div className="space-y-3">
            <div>
              <Label>To</Label>
              <TextField
                value={draftTo}
                onChange={setDraftTo}
                disabled={actionPending}
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <Label>Cc</Label>
              <TextField
                value={draftCc}
                onChange={setDraftCc}
                disabled={actionPending}
                placeholder="Optional — comma-separated"
              />
            </div>
            {initialSubject && (
              <div>
                <Label>Subject</Label>
                <TextField
                  value={draftSubject}
                  onChange={setDraftSubject}
                  disabled={actionPending}
                />
              </div>
            )}
            <div>
              <Label>Message</Label>
              <TextArea
                value={draftBody}
                onChange={setDraftBody}
                rows={10}
                disabled={actionPending}
                className="rounded-lg bg-surface-subtle/80 text-sm text-foreground leading-relaxed border border-border/50 min-h-[160px]"
              />
            </div>
          </div>
        ) : action?.detail ? (
          <div className="rounded-lg bg-surface-subtle/80 p-3 text-sm text-foreground-muted leading-relaxed whitespace-pre-wrap border border-border/50">
            {action.detail}
          </div>
        ) : null}

        {task.source === 'session' && task.preview && task.status === 'done' && (
          <div className="rounded-lg bg-surface-subtle/80 p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap border border-border/50">
            {task.preview}
          </div>
        )}

        {isKbUpdate && action && (
          <div className="rounded-lg bg-surface-subtle/80 p-3 text-sm text-foreground-muted leading-relaxed whitespace-pre-wrap border border-border/50">
            {describeKbUpdate(action)}
          </div>
        )}

        {action && task.status === 'needs_you' && (
          <p className="text-xs text-foreground-subtle">
            {queueActionAutonomyNote(autonomyLevel, action.type) ?? `${ACTION_TYPE_LABELS[action.type] ?? action.type} queued by ${action.agentRole}`}
          </p>
        )}

        {action && !action.detail && action.type !== 'kb_update' && task.status !== 'needs_you' && (
          <p className="text-xs text-foreground-subtle">
            {ACTION_TYPE_LABELS[action.type] ?? action.type} queued by {action.agentRole}
          </p>
        )}

        {onDiscussInChat && (task.source === 'proactive' || task.status === 'suggestion') && (
          <button
            type="button"
            onClick={() => onDiscussInChat(taskToChatPrompt(task))}
            className="btn-primary text-sm w-full sm:w-auto"
          >
            Discuss in chat
          </button>
        )}

        {onDiscussInChat && task.source === 'queue' && task.status !== 'needs_you' && (
          <button
            type="button"
            onClick={() => onDiscussInChat(taskToChatPrompt(task))}
            className="text-sm font-medium text-accent hover:text-accent/80 transition-colors"
          >
            Discuss in chat →
          </button>
        )}

        {onDiscussInChat && task.source === 'queue' && task.status === 'needs_you' && (
          <button
            type="button"
            onClick={() => onDiscussInChat(taskToChatPrompt(task))}
            className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Ask about this draft →
          </button>
        )}
      </div>

      {action && task.status === 'needs_you' && (
        <div className="shrink-0 border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <button
            type="button"
            disabled={actionPending}
            onClick={() => onIntent(action.id, 'approve', emailEdits)}
            className="w-full py-3 text-sm font-semibold bg-foreground text-surface rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {actionPending ? 'Working…' : approveLabel}
          </button>
          <div className={`flex gap-2 ${showSave ? '' : 'hidden'}`}>
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onIntent(action.id, 'save', emailEdits)}
              className="flex-1 py-3 text-sm font-semibold text-foreground rounded-lg border border-accent/40 bg-accent/5 hover:bg-accent/10 transition-colors disabled:opacity-50"
            >
              Save to drafts
            </button>
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onIntent(action.id, 'reject')}
              className="flex-1 py-3 text-sm font-semibold text-foreground-muted rounded-lg border border-border hover:bg-surface-subtle transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          {!showSave && (
            <button
              type="button"
              disabled={actionPending}
              onClick={() => onIntent(action.id, 'reject')}
              className="w-full py-3 text-sm font-semibold text-foreground-muted rounded-lg border border-border hover:bg-surface-subtle transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskFeed({
  session,
  onOpenStudio,
  onDiscussInChat,
  onTasksChanged,
  initialFilter = 'all',
  onClose,
}: Props) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionFeedback, setActionFeedback] = useState<{ type: 'ok' | 'err'; message: string } | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const { tasks, needsYou: approvalCount, suggestions: suggestionCount, autonomy, loading, refresh } = useWorkFeed();

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

  const runningCount = useMemo(
    () => allTasks.filter(t => t.status === 'running').length,
    [allTasks],
  );

  const filtered = useMemo(() => {
    if (filter === 'approval') return allTasks.filter(t => t.status === 'needs_you');
    if (filter === 'suggestions') return allTasks.filter(t => t.status === 'suggestion');
    if (filter === 'running') return allTasks.filter(t => t.status === 'running');
    if (filter === 'done') return allTasks.filter(t => t.status === 'done' || t.status === 'failed');
    return allTasks;
  }, [allTasks, filter]);

  const bulkEligible = useMemo(
    () => filtered.filter(isBulkEligible),
    [filtered],
  );

  const selectedBulkTasks = useMemo(
    () => bulkEligible.filter(task => selectedIds.has(task.id)),
    [bulkEligible, selectedIds],
  );

  const selectedEmailCount = useMemo(
    () => selectedBulkTasks.filter(task => task.action && isEmailQueueAction(task.action)).length,
    [selectedBulkTasks],
  );

  const allBulkSelected = bulkEligible.length > 0 && bulkEligible.every(task => selectedIds.has(task.id));

  const toggleSelected = (taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allBulkSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(bulkEligible.map(task => task.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selected = filtered.find(t => t.id === selectedId) ?? allTasks.find(t => t.id === selectedId) ?? null;

  const handleIntent = async (id: string, intent: QueueIntent, edits?: QueueEditOverrides) => {
    setActionPending(true);
    const result = await patchQueueAction(id, intent, edits);
    setActionPending(false);
    if (result.ok) {
      const action = result.action;
      const executionError = queueExecutionError(action);
      let message = 'Done';
      let type: 'ok' | 'err' = 'ok';

      if (action.status === 'failed') {
        type = 'err';
        message = executionError ?? 'Update failed';
      } else if (intent === 'reject') {
        message = 'Rejected';
      } else if (intent === 'save') {
        message = action.status === 'saved' ? 'Saved to Gmail drafts' : 'Done';
      } else if (intent === 'approve') {
        if (action.status === 'executed') {
          message = action.type === 'kb_update' ? 'Profile updated' : 'Sent';
        } else {
          message = action.type === 'kb_update' ? 'Update approved' : 'Approved';
        }
      }

      setActionFeedback({ type, message });
      setSelectedId(null);
      clearSelection();
      refresh();
      onTasksChanged?.();
      setTimeout(() => setActionFeedback(null), 3500);
    } else {
      setActionFeedback({ type: 'err', message: result.error });
    }
  };

  const handleSuggestionAction = async (
    id: string,
    action: 'dismiss' | 'snooze',
    days?: number,
  ) => {
    setActionPending(true);
    const result = await patchSuggestion(id, action, days);
    setActionPending(false);
    if (result.ok) {
      setActionFeedback({
        type: 'ok',
        message: action === 'dismiss' ? 'Dismissed' : `Snoozed${days ? ` for ${days} day${days === 1 ? '' : 's'}` : ''}`,
      });
      setSelectedId(null);
      refresh();
      onTasksChanged?.();
      setTimeout(() => setActionFeedback(null), 3500);
    } else {
      setActionFeedback({ type: 'err', message: result.error });
    }
  };

  const handleBulkIntent = async (intent: QueueIntent) => {
    const tasks = intent === 'save'
      ? selectedBulkTasks.filter(task => task.action && isEmailQueueAction(task.action))
      : selectedBulkTasks;

    const ids = tasks
      .map(task => task.action?.id)
      .filter((id): id is string => Boolean(id));

    if (ids.length === 0) {
      setActionFeedback({
        type: 'err',
        message: intent === 'save' ? 'No email drafts selected' : 'No items selected',
      });
      return;
    }

    setActionPending(true);
    const result = await patchQueueActions(ids, intent);
    setActionPending(false);

    if (!result.ok) {
      setActionFeedback({ type: 'err', message: result.error });
      return;
    }

    const feedback = bulkResultMessage(intent, result.results);
    setActionFeedback(feedback);
    clearSelection();
    refresh();
    onTasksChanged?.();
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const filters: Array<{ id: Filter; label: string; shortLabel?: string; count?: number }> = [
    { id: 'all', label: 'All' },
    { id: 'approval', label: 'Awaiting approval', shortLabel: 'Approve', count: approvalCount },
    { id: 'suggestions', label: 'Suggestions', count: suggestionCount },
    { id: 'running', label: 'Running', count: runningCount },
    { id: 'done', label: 'Done' },
  ];

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-4 pt-4 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-[13px] font-semibold text-foreground tracking-tight">Inbox</h2>
          <div className="flex items-center gap-2 shrink-0">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 -mr-1 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-subtle"
                aria-label="Close"
              >
                ×
              </button>
            )}
            {autonomy && (
              <span
                className="text-[10px] text-foreground-subtle hidden sm:inline"
                title={autonomy.hint}
              >
                {autonomy.label}
              </span>
            )}
            {approvalCount > 0 && (
              <span className="text-[11px] font-medium text-accent tabular-nums">
                {approvalCount} to approve
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {filters.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setSelectedId(null);
                clearSelection();
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                filter === f.id
                  ? 'bg-foreground text-surface'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
              }`}
            >
              <span className="sm:hidden">{f.shortLabel ?? f.label}</span>
              <span className="hidden sm:inline">{f.label}</span>
              {f.count != null && f.count > 0 && (
                <span className="ml-1 opacity-80">{f.count}</span>
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
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="shrink-0 px-4 py-2 text-[11px] text-foreground-muted hover:text-foreground border-b border-border text-left"
            >
              ← Back to list
            </button>
            <div className="flex-1 min-h-0">
              <TaskDetail
                task={selected}
                onIntent={handleIntent}
                onOpenStudio={onOpenStudio}
                onDiscussInChat={onDiscussInChat}
                onSuggestionAction={handleSuggestionAction}
                autonomyLevel={autonomy?.level}
                actionPending={actionPending}
              />
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-foreground-muted">Nothing here yet</p>
            <p className="text-xs text-foreground-subtle mt-1 max-w-[240px] leading-relaxed">
              {filter === 'approval'
                ? 'Drafts and profile updates from your agents appear here for Approve or Reject.'
                : filter === 'suggestions'
                  ? 'Reminders from your projects and relationships — open one to discuss in chat.'
                  : 'Ask your chief of staff to do something — drafts and updates show up here.'}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {bulkEligible.length > 0 && (
              <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-subtle/40">
                <label className="flex items-center gap-2 text-[11px] text-foreground-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allBulkSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border accent-accent"
                  />
                  Select all
                  <span className="text-foreground-subtle">({bulkEligible.length})</span>
                </label>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-[11px] font-medium text-foreground-muted hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {filtered.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selectedId === task.id}
                  onSelect={() => setSelectedId(task.id)}
                  bulkMode={isBulkEligible(task)}
                  checked={selectedIds.has(task.id)}
                  onToggleCheck={() => toggleSelected(task.id)}
                />
              ))}
            </div>
            {selectedIds.size > 0 && (
              <div className="shrink-0 border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
                <p className="text-[11px] font-medium text-foreground-muted">
                  {selectedIds.size} selected
                </p>
                <button
                  type="button"
                  disabled={actionPending}
                  onClick={() => handleBulkIntent('approve')}
                  className="w-full py-2.5 text-sm font-semibold bg-foreground text-surface rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {actionPending ? 'Working…' : `Approve & send (${selectedIds.size})`}
                </button>
                <div className="flex gap-2">
                  {selectedEmailCount > 0 && (
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => handleBulkIntent('save')}
                      className="flex-1 py-2.5 text-sm font-semibold text-foreground rounded-lg border border-accent/40 bg-accent/5 hover:bg-accent/10 transition-colors disabled:opacity-50"
                    >
                      Save to drafts ({selectedEmailCount})
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => handleBulkIntent('reject')}
                    className="flex-1 py-2.5 text-sm font-semibold text-foreground-muted rounded-lg border border-border hover:bg-surface-subtle transition-colors disabled:opacity-50"
                  >
                    Reject ({selectedIds.size})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
