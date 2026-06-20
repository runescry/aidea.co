'use client';
import { useState } from 'react';

export interface PendingInput {
  requestId: string;
  question: string;
  context?: string;
  agentRole: string;
}

interface Props {
  pending: PendingInput | null;
  onSubmit: (requestId: string, answer: string) => void;
}

export default function HumanInputOverlay({ pending, onSubmit }: Props) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!pending) return null;

  const handleSubmit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: pending.requestId, answer: answer.trim() }),
      });
      onSubmit(pending.requestId, answer.trim());
      setAnswer('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
      <div className="card p-6 max-w-lg w-full mx-4 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-2 h-2 rounded-full bg-warning animate-pulse" />
          <span className="text-xs text-foreground-muted font-mono">{pending.agentRole} is waiting</span>
        </div>
        <p className="text-foreground text-sm leading-relaxed mb-5">{pending.question}</p>
        {pending.context && (
          <p className="text-xs text-foreground-muted leading-relaxed mb-4 border-l-2 border-border pl-3">
            {pending.context}
          </p>
        )}
        <textarea
          autoFocus
          rows={3}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          placeholder="Type your answer…"
          className="input-field resize-none mb-3"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground-subtle">⌘↵ to send</span>
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || submitting}
            className="btn-primary text-sm py-1.5 disabled:opacity-40"
          >
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
