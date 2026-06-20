'use client';
import { useState } from 'react';
import MorningBriefRenderer from './MorningBriefRenderer';
import InboxTriageRenderer from './InboxTriageRenderer';
import CalendarBriefRenderer from './CalendarBriefRenderer';
import { getArtifactLabel, getKnownArtifactKeys, sortArtifactKeys } from '@/lib/agents/artifact-labels';

const RICH_RENDERERS: Record<string, boolean> = {
  morning_brief: true,
  inbox_triage: true,
  calendar_brief: true,
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

  if (isRichRenderable && !rawMode) {
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
        {stateKey === 'morning_brief' && (
          <MorningBriefRenderer data={value as Parameters<typeof MorningBriefRenderer>[0]['data']} />
        )}
        {stateKey === 'inbox_triage' && (
          <InboxTriageRenderer data={value as Parameters<typeof InboxTriageRenderer>[0]['data']} />
        )}
        {stateKey === 'calendar_brief' && (
          <CalendarBriefRenderer data={value as Parameters<typeof CalendarBriefRenderer>[0]['data']} />
        )}
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

  const knownKeys = getKnownArtifactKeys();
  const available = knownKeys.filter(k => k in entityState);
  const extra = Object.keys(entityState).filter(k => !knownKeys.includes(k));
  const all = sortArtifactKeys([...available, ...extra]);

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
        <p className="text-caption text-foreground-muted text-center max-w-sm">
          Artifacts appear here as agents write state — briefs, drafts, research notes, and deliverables.
        </p>
        <div className="card p-3 w-full max-w-xs space-y-2">
          <div className="text-micro font-medium text-foreground-subtle uppercase tracking-wide">Example output</div>
          {['Morning brief', 'Email draft', 'Research summary'].map(label => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent/40 shrink-0" aria-hidden />
              <span className="text-caption text-foreground-muted">{label}</span>
            </div>
          ))}
        </div>
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
            {getArtifactLabel(k)}
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto pl-3 pt-1">
        {activeKey && entityState[activeKey] !== undefined && (
          <>
            <div className="text-warning font-semibold mb-3">
              {getArtifactLabel(activeKey)}
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
