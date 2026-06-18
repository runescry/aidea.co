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
  generic: 'Action',
};

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-900/50 text-red-300',
  normal: 'bg-gray-800 text-gray-400',
  low: 'bg-gray-800/50 text-gray-500',
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
    <div className="border border-gray-800 rounded-lg p-4 space-y-3 bg-gray-900/50">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-mono bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
              {TYPE_LABELS[action.type] ?? action.type}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${PRIORITY_STYLE[action.priority]}`}>
              {action.priority}
            </span>
            <span className="text-[10px] text-gray-600 font-mono">{action.agentRole}</span>
          </div>
          <p className="text-sm text-white leading-snug">{action.summary}</p>
          {action.detail && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-blue-500 hover:text-blue-400 mt-1"
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
          {expanded && action.detail && (
            <pre className="mt-2 text-xs text-gray-400 bg-gray-950 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
              {typeof action.detail === 'string' ? action.detail : JSON.stringify(action.payload, null, 2)}
            </pre>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onStatusChange(action.id, 'approved')}
          className="flex-1 py-1.5 text-xs font-medium bg-green-900/60 hover:bg-green-800/60 text-green-300 rounded transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => onStatusChange(action.id, 'rejected')}
          className="flex-1 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors"
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
    return <div className="text-xs text-gray-600 py-8 text-center">Loading queue...</div>;
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-700 space-y-2">
        <div className="text-2xl">✓</div>
        <div className="text-sm">No pending actions</div>
        <div className="text-xs">Agents will queue drafts and proposals here for your approval.</div>
      </div>
    );
  }

  const high = actions.filter(a => a.priority === 'high');
  const rest = actions.filter(a => a.priority !== 'high');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{actions.length} pending</span>
        <button
          onClick={handleClearAll}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Clear resolved
        </button>
      </div>
      {high.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-red-400 uppercase tracking-wider">High priority</div>
          {high.map(a => (
            <ActionCard key={a.id} action={a} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="space-y-2">
          {high.length > 0 && <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Normal</div>}
          {rest.map(a => (
            <ActionCard key={a.id} action={a} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
