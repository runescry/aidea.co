'use client';
import { useState } from 'react';

export interface PendingInput {
  requestId: string;
  question: string;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs text-gray-400 font-mono">{pending.agentRole} is waiting</span>
        </div>
        <p className="text-white text-sm leading-relaxed mb-5">{pending.question}</p>
        <textarea
          autoFocus
          rows={3}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
          placeholder="Type your answer..."
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-blue-500 placeholder-gray-500 mb-3"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-600">⌘↵ to send</span>
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || submitting}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
