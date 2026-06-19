'use client';
import { useState, useEffect, useCallback } from 'react';
import type { QueuedAction, ActionStatus } from '@/lib/harness/queue';

const TYPE_LABELS: Record<string, string> = {
  email_reply: 'Email reply',
  email_send: 'Email send',
  calendar_event: 'Calendar',
  task: 'Task',
  reminder: 'Reminder',
  message: 'Message',
  alert: 'Alert',
  kb_update: 'Profile update',
  generic: 'Action',
};

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-danger/10 text-danger',
  normal: 'bg-surface-subtle text-foreground-muted',
  low: 'bg-surface-subtle/50 text-foreground-subtle',
};

function ActionCard({
  action,
  onStatusChange,
}: {
  action: QueuedAction;
  onStatusChange: (id: string, status: ActionStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-mono bg-surface-subtle text-foreground-muted px-1.5 py-0.5 rounded">
              {TYPE_LABELS[action.type] ?? action.type}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${PRIORITY_STYLE[action.priority]}`}>
              {action.priority}
            </span>
            <span className="text-[10px] text-foreground-subtle font-mono">{action.agentRole}</span>
          </div>
          <p className="text-sm text-foreground leading-snug">{action.summary}</p>
          {action.detail && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-accent hover:underline mt-1"
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
          {expanded && action.detail && (
            <pre className="mt-2 text-xs text-foreground-muted bg-surface-subtle rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap border border-border">
              {typeof action.detail === 'string' ? action.detail : JSON.stringify(action.payload, null, 2)}
            </pre>
          )}
          {action.type === 'kb_update' && action.payload?.patch != null && (
            <pre className="mt-2 text-xs text-foreground-muted bg-surface-subtle rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap border border-border">
              {JSON.stringify(action.payload.patch, null, 2)}
            </pre>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onStatusChange(action.id, 'approved')}
          className="flex-1 py-1.5 text-xs font-medium bg-success/10 hover:bg-success/20 text-success rounded-lg transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => onStatusChange(action.id, 'rejected')}
          className="flex-1 py-1.5 text-xs font-medium bg-surface-subtle hover:bg-border/60 text-foreground-muted rounded-lg transition-colors border border-border"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export default function ActionQueue() {
  const [actions, setActions] = useState<QueuedAction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch('/api/queue?status=pending');
      if (res.ok) setActions(await res.json() as QueuedAction[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
    const id = setInterval(fetchActions, 8000);
    return () => clearInterval(id);
  }, [fetchActions]);

  const handleStatusChange = async (id: string, status: ActionStatus) => {
    await fetch('/api/queue', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setActions(prev => prev.filter(a => a.id !== id));
  };

  const handleClearAll = async () => {
    await fetch('/api/queue', { method: 'DELETE' });
    fetchActions();
  };

  if (loading) {
    return <div className="text-xs text-foreground-subtle py-8 text-center">Loading queue…</div>;
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-foreground-subtle space-y-2">
        <div className="text-2xl text-success">✓</div>
        <div className="text-sm text-foreground-muted">No pending actions</div>
        <div className="text-xs">Agents will queue drafts and proposals here for your approval.</div>
      </div>
    );
  }

  const high = actions.filter(a => a.priority === 'high');
  const rest = actions.filter(a => a.priority !== 'high');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground-muted">{actions.length} pending</span>
        <button
          onClick={handleClearAll}
          className="text-xs text-foreground-subtle hover:text-foreground-muted transition-colors"
        >
          Clear resolved
        </button>
      </div>
      {high.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-danger uppercase tracking-wider">High priority</div>
          {high.map(a => (
            <ActionCard key={a.id} action={a} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="space-y-2">
          {high.length > 0 && <div className="text-[10px] font-mono text-foreground-subtle uppercase tracking-wider">Normal</div>}
          {rest.map(a => (
            <ActionCard key={a.id} action={a} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
