'use client';
import type { ConsensusRecord } from '@/hooks/useHarnessSession';

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 w-7 text-right">{pct}%</span>
    </div>
  );
}

interface Props {
  consensus: Record<string, ConsensusRecord>;
}

export default function ConsensusPanel({ consensus }: Props) {
  const records = Object.values(consensus);
  const active = records.filter(r => r.status === 'in-progress');
  const resolved = records.filter(r => r.status === 'resolved');

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        No consensus rounds yet
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pr-1 space-y-3 text-xs font-mono">
      {active.length > 0 && (
        <div>
          <div className="text-[10px] text-amber-400 uppercase tracking-widest mb-1.5">Active</div>
          {active.map(r => (
            <ConsensusCard key={r.decisionId ?? r.topic} record={r} />
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Resolved</div>
          {resolved.map(r => (
            <ConsensusCard key={r.decisionId ?? r.topic} record={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConsensusCard({ record }: { record: ConsensusRecord }) {
  const isResolved = record.status === 'resolved';
  return (
    <div className={`border rounded p-2 mb-2 ${isResolved ? 'border-gray-800' : 'border-amber-800/50 bg-amber-950/10'}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={`font-semibold ${isResolved ? 'text-gray-300' : 'text-amber-300'}`}>
          {record.topic}
        </span>
        {isResolved && (
          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
            record.decidedBy === 'consensus' ? 'bg-green-900/50 text-green-400' : 'bg-purple-900/50 text-purple-400'
          }`}>
            {record.decidedBy === 'consensus' ? 'consensus' : 'parent override'}
          </span>
        )}
        {!isResolved && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400">
            voting
          </span>
        )}
      </div>

      {record.stakeholderRoles && record.stakeholderRoles.length > 0 && (
        <div className="text-gray-500 mb-1.5">
          Stakeholders: {record.stakeholderRoles.join(', ')}
        </div>
      )}

      {record.votes.length > 0 && (
        <div className="space-y-1 mb-1.5">
          {record.votes.map((v, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-gray-400">{v.role}</span>
                <span className="text-gray-500 truncate max-w-[180px]">{v.position.slice(0, 60)}</span>
              </div>
              <ConfidenceBar value={v.confidence} />
            </div>
          ))}
        </div>
      )}

      {record.outcome && (
        <div className="text-gray-400 border-t border-gray-800 pt-1.5 mt-1">
          <span className="text-gray-600">Outcome: </span>
          {record.outcome.slice(0, 120)}
          {record.outcome.length > 120 && '…'}
        </div>
      )}
    </div>
  );
}
