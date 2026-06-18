'use client';
import type { CEODirective } from '@/types';

interface Props {
  directive: CEODirective;
  cycleLabel: string;
}

export default function DirectiveCard({ directive, cycleLabel }: Props) {
  return (
    <div className="bg-gray-900 border border-amber-900/40 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
          CEO
        </span>
        <span className="text-xs text-gray-500">{cycleLabel}</span>
      </div>
      <p className="text-gray-200 text-sm leading-relaxed mb-5">{directive.text}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Priorities</p>
          <ol className="space-y-1">
            {directive.priorities.map((p, i) => (
              <li key={i} className="text-xs text-gray-300">{p}</li>
            ))}
          </ol>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Lead Metrics</p>
          <div className="space-y-1">
            {Object.entries(directive.targetMetrics).map(([role, metric]) => (
              <div key={role} className="flex gap-2">
                <span className="text-xs text-gray-500 uppercase w-8 flex-shrink-0">{role}</span>
                <span className="text-xs text-gray-300">{metric}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {directive.constraints.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {directive.constraints.map((c, i) => (
            <span key={i} className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
