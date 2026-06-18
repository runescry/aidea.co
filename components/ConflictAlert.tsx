'use client';
import type { ConflictReport } from '@/types';

export default function ConflictAlert({ report }: { report: ConflictReport }) {
  if (!report.hasConflict || report.conflictType === 'none') return null;

  const isBlocking = report.severity === 'blocking';

  return (
    <div className={`border rounded-xl p-5 ${
      isBlocking
        ? 'bg-red-950/30 border-red-800/50'
        : 'bg-yellow-950/30 border-yellow-800/50'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          isBlocking ? 'text-red-400 bg-red-400/10' : 'text-yellow-400 bg-yellow-400/10'
        }`}>
          {isBlocking ? '⚠ CONFLICT DETECTED' : '⚡ TIMELINE NOTE'}
        </span>
        <span className="text-xs text-gray-500 capitalize">{report.severity}</span>
      </div>

      <p className={`text-sm mb-4 ${isBlocking ? 'text-red-200' : 'text-yellow-200'}`}>
        {report.gapDescription}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-purple-900/30">
          <p className="text-xs text-purple-400 mb-1">CMO</p>
          <p className="text-xs text-gray-300">{report.cmoClaim}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-emerald-900/30">
          <p className="text-xs text-emerald-400 mb-1">CTO</p>
          <p className="text-xs text-gray-300">{report.ctoClaim}</p>
        </div>
      </div>

      {report.ceoArbitration && (
        <div className="mt-4 bg-amber-950/30 border border-amber-800/30 rounded-lg p-3">
          <p className="text-xs text-amber-400 mb-1">CEO Arbitration</p>
          <p className="text-xs text-gray-300">{report.ceoArbitration}</p>
          {report.resolution && (
            <p className="text-xs text-amber-200 mt-2 font-medium">→ {report.resolution}</p>
          )}
        </div>
      )}
    </div>
  );
}
