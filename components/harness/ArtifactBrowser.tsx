'use client';
import { useState } from 'react';

const ARTIFACT_KEYS = [
  'company_identity', 'ceo_directive', 'ceo_directive_cycle2',
  'cpo_output', 'cmo_output', 'cto_output', 'cfo_output',
  'copywriter_artifact', 'outreach_artifact', 'pricing_artifact', 'research_artifact',
  'life_context', 'life_ceo_output',
  'growth_output', 'health_output', 'finance_output', 'relationships_output', 'systems_output',
  'research_output', 'plan_output',
];

const ARTIFACT_LABELS: Record<string, string> = {
  company_identity: 'Company Identity',
  ceo_directive: 'CEO Directive (Cycle 1)',
  ceo_directive_cycle2: 'CEO Directive (Cycle 2)',
  cpo_output: 'CPO — Product Plan',
  cmo_output: 'CMO — Marketing Plan',
  cto_output: 'CTO — Engineering Plan',
  cfo_output: 'CFO — Financial Plan',
  copywriter_artifact: 'Copywriter — Content',
  outreach_artifact: 'Outreach — Messages',
  pricing_artifact: 'Pricing — Model & Page',
  research_artifact: 'Research — Discovery',
  life_context: 'Life Context',
  life_ceo_output: 'Life CEO — Quarterly Plan',
  growth_output: 'Growth Director — Skills & Career',
  health_output: 'Health Director — Protocol',
  finance_output: 'Finance Director — Plan',
  relationships_output: 'Relationships Director — Social',
  systems_output: 'Systems Director — Productivity',
  research_output: 'Research — Output',
  plan_output: 'Planner — Schedule',
};

function downloadJson(key: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${key}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function HtmlPreviewButton({ html }: { html: string }) {
  return (
    <button
      className="px-2 py-0.5 text-[10px] bg-blue-900/50 text-blue-400 rounded hover:bg-blue-800/50"
      onClick={() => {
        const w = window.open('', '_blank');
        w?.document.write(html);
      }}
    >
      Preview HTML
    </button>
  );
}

function ArtifactDetail({ stateKey, value }: { stateKey: string; value: unknown }) {
  const obj = value as Record<string, unknown>;

  const htmlField = Object.entries(obj).find(([, v]) =>
    typeof v === 'string' && (v.startsWith('<!DOCTYPE') || v.startsWith('<html'))
  );

  return (
    <div className="space-y-2 text-xs font-mono">
      <div className="flex gap-2 flex-wrap">
        <button
          className="px-2 py-0.5 text-[10px] bg-gray-800 text-gray-400 rounded hover:bg-gray-700"
          onClick={() => downloadJson(stateKey, value)}
        >
          Download JSON
        </button>
        {htmlField && <HtmlPreviewButton html={htmlField[1] as string} />}
      </div>
      {Object.entries(obj).map(([k, v]) => (
        <div key={k}>
          <div className="text-purple-400 mb-0.5">{k}</div>
          <div className="ml-2 text-gray-300 whitespace-pre-wrap break-all">
            {typeof v === 'string'
              ? (v.startsWith('<!DOCTYPE') || v.startsWith('<html'))
                ? <span className="text-gray-500 italic">[HTML content — use Preview button]</span>
                : v.length > 600 ? v.slice(0, 600) + '…' : v
              : JSON.stringify(v, null, 2).slice(0, 800)}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  entityState: Record<string, unknown>;
}

export default function ArtifactBrowser({ entityState }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const available = ARTIFACT_KEYS.filter(k => k in entityState);
  const extra = Object.keys(entityState).filter(k => !ARTIFACT_KEYS.includes(k));
  const all = [...available, ...extra];

  if (all.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        No artifacts yet — agents produce these as they work
      </div>
    );
  }

  const activeKey = selected && all.includes(selected) ? selected : all[0];

  return (
    <div className="flex h-full gap-0 text-xs font-mono">
      {/* Sidebar */}
      <div className="w-44 shrink-0 border-r border-gray-800 overflow-y-auto pr-1">
        {all.map(k => (
          <button
            key={k}
            className={`w-full text-left px-2 py-1.5 truncate transition-colors ${
              k === activeKey
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
            }`}
            onClick={() => setSelected(k)}
          >
            {ARTIFACT_LABELS[k] ?? k}
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto pl-3 pt-1">
        {activeKey && entityState[activeKey] !== undefined && (
          <>
            <div className="text-amber-300 font-semibold mb-2">
              {ARTIFACT_LABELS[activeKey] ?? activeKey}
            </div>
            {typeof entityState[activeKey] === 'object' && entityState[activeKey] !== null
              ? <ArtifactDetail stateKey={activeKey} value={entityState[activeKey]} />
              : <div className="text-gray-300 whitespace-pre-wrap">{String(entityState[activeKey])}</div>
            }
          </>
        )}
      </div>
    </div>
  );
}
