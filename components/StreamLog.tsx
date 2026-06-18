'use client';
import { useState, useRef, useEffect } from 'react';
import type { SSEEvent } from '@/types';

const AGENT_COLORS: Record<string, string> = {
  ceo: 'text-amber-400',
  cpo: 'text-blue-400',
  cmo: 'text-purple-400',
  cto: 'text-emerald-400',
  cfo: 'text-orange-400',
  conflict_detector: 'text-red-400',
  copywriter: 'text-pink-400',
  outreach: 'text-cyan-400',
  pricing: 'text-teal-400',
  research: 'text-indigo-400',
};

function truncate(s: unknown, n: number): string {
  const str = typeof s === 'string' ? s : JSON.stringify(s);
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export default function StreamLog({ events }: { events: SSEEvent[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length, isOpen]);

  const displayed = events.slice(-100);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-xs text-gray-500">Activity Log ({events.length} events)</span>
        <span className="text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-800 max-h-64 overflow-y-auto p-3 font-mono text-xs">
          {displayed.map((event, i) => {
            const ts = new Date(event.timestamp).toLocaleTimeString([], {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            });
            const agentColor = event.agent ? (AGENT_COLORS[event.agent] ?? 'text-gray-400') : 'text-gray-600';
            const isChunk = event.type === 'lead_stream_chunk' || event.type === 'working_group_stream_chunk';

            return (
              <div key={i} className={`flex gap-2 py-0.5 ${isChunk ? 'opacity-30' : ''}`}>
                <span className="text-gray-600 flex-shrink-0">[{ts}]</span>
                <span className={`flex-shrink-0 ${agentColor}`}>{event.agent ?? '—'}</span>
                <span className="text-gray-500 flex-shrink-0">{event.type}</span>
                {!isChunk && (
                  <span className="text-gray-700 truncate">
                    {truncate(event.data, 80)}
                  </span>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
