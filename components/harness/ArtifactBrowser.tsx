'use client';
import { useState } from 'react';
import MorningBriefRenderer from './MorningBriefRenderer';

const ARTIFACT_KEYS = [
  'company_identity', 'ceo_directive', 'ceo_directive_cycle2',
  'cpo_output', 'cmo_output', 'cto_output', 'cfo_output',
  'copywriter_artifact', 'outreach_artifact', 'pricing_artifact', 'research_artifact',
  'life_context', 'life_ceo_output', 'values_output', 'mental_health_output',
  'growth_output', 'health_output', 'finance_output', 'relationships_output', 'systems_output',
  'morning_brief', 'inbox_triage', 'calendar_brief', 'health_brief', 'news_brief', 'work_prep',
  'dispatch_response', 'relationship_monitor',
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
  values_output: 'Values — Constitution',
  mental_health_output: 'Mental Health — Protocol',
  growth_output: 'Growth Director — Skills & Career',
  health_output: 'Health Director — Protocol',
  finance_output: 'Finance Director — Plan',
  relationships_output: 'Relationships Director — Social',
  systems_output: 'Systems Director — Productivity',
  morning_brief: 'Morning Brief',
  inbox_triage: 'Inbox Triage',
  calendar_brief: 'Calendar Brief',
  health_brief: 'Health Brief',
  news_brief: 'News Headlines',
  work_prep: 'Work Prep',
  dispatch_response: 'Dispatch Response',
  relationship_monitor: 'Relationship Monitor',
  research_output: 'Research — Output',
  plan_output: 'Planner — Schedule',
};

const RICH_RENDERERS: Record<string, boolean> = {
  morning_brief: true,
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
      className="px-2 py-0.5 text-[10px] bg-accent/10 text-accent rounded hover:bg-accent/20"
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
  const [rawMode, setRawMode] = useState(false);
  const obj = value as Record<string, unknown>;

  const isRichRenderable = RICH_RENDERERS[stateKey];
  const htmlField = !isRichRenderable
    ? Object.entries(obj).find(([, v]) =>
        typeof v === 'string' && (v.startsWith('<!DOCTYPE') || v.startsWith('<html'))
      )
    : undefined;

  if (isRichRenderable && stateKey === 'morning_brief' && !rawMode) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <button
            className="px-2 py-0.5 text-[10px] bg-surface-subtle text-foreground-muted rounded hover:bg-border/60 border border-border"
            onClick={() => downloadJson(stateKey, value)}
          >
            Download JSON
          </button>
          <button
            className="px-2 py-0.5 text-[10px] bg-surface-subtle text-foreground-muted rounded hover:bg-border/60 border border-border"
            onClick={() => setRawMode(true)}
          >
            Raw JSON
          </button>
        </div>
        <MorningBriefRenderer data={value as Parameters<typeof MorningBriefRenderer>[0]['data']} />
      </div>
    );
  }

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
        {rawMode && (
          <button
            className="px-2 py-0.5 text-[10px] bg-surface-subtle text-foreground-muted rounded hover:bg-border/60 border border-border"
            onClick={() => setRawMode(false)}
          >
            Rich view
          </button>
        )}
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
      <div className="flex items-center justify-center h-full text-foreground-subtle text-sm">
        No artifacts yet — agents produce these as they work
      </div>
    );
  }

  const activeKey = selected && all.includes(selected) ? selected : all[0];

  return (
    <div className="flex h-full gap-0 text-xs font-mono">
      {/* Sidebar */}
      <div className="w-44 shrink-0 border-r border-border overflow-y-auto pr-1">
        {all.map(k => (
          <button
            key={k}
            className={`w-full text-left px-2 py-1.5 truncate transition-colors rounded ${
              k === activeKey
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-foreground-muted hover:bg-surface-subtle hover:text-foreground'
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
            <div className="text-warning font-semibold mb-3">
              {ARTIFACT_LABELS[activeKey] ?? activeKey}
            </div>
            {typeof entityState[activeKey] === 'object' && entityState[activeKey] !== null
              ? <ArtifactDetail stateKey={activeKey} value={entityState[activeKey]} />
              : <div className="text-foreground whitespace-pre-wrap">{String(entityState[activeKey])}</div>
            }
          </>
        )}
      </div>
    </div>
  );
}
