'use client';
import type { CompanyIdentity } from '@/types';

export default function CompanyIdentityCard({ identity }: { identity: CompanyIdentity }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
        <div>
          <h2 className="text-2xl font-bold text-white">{identity.name}</h2>
          <p className="text-amber-300 text-sm mt-0.5">{identity.tagline}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Mission', value: identity.mission },
          { label: 'Target Customer', value: identity.targetCustomer },
          { label: 'Value Proposition', value: identity.valueProposition },
          { label: 'Competitive Edge', value: identity.competitiveEdge },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-sm text-gray-200">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
