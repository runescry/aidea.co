'use client';

import { useState, useCallback } from 'react';
import type { HarnessState } from '@/hooks/useHarnessSession';
import AgentGraph from './AgentGraph';
import ToolCallFeed from './ToolCallFeed';
import StateExplorer from './StateExplorer';
import ConsensusPanel from './ConsensusPanel';
import ArtifactBrowser from './ArtifactBrowser';
import type { CostSnapshot } from '@/lib/harness/types';

type EntityType = 'company' | 'personal' | 'learning' | 'creator' | 'daily';
type Panel = 'graph' | 'tools' | 'state' | 'consensus' | 'artifacts';

const ENTITY_META: Record<EntityType, {
  label: string;
  fields: Array<{ key: string; label: string; placeholder: string; type?: string }>;
}> = {
  company: {
    label: 'Company',
    fields: [
      { key: 'idea', label: 'Startup idea', placeholder: 'A B2B SaaS tool that automates invoice reconciliation for SMBs' },
    ],
  },
  personal: {
    label: 'Personal OS',
    fields: [
      { key: 'prompt', label: 'Life context', placeholder: 'I\'m a 32-year-old engineer who wants to transition to founding my own company in 18 months' },
      { key: 'priorities', label: 'Top priorities (comma-separated)', placeholder: 'financial independence, health, meaningful relationships' },
    ],
  },
  learning: {
    label: 'Learning OS',
    fields: [
      { key: 'goal', label: 'What do you want to learn?', placeholder: 'Become proficient in machine learning engineering' },
      { key: 'skillLevel', label: 'Current skill level', placeholder: 'Intermediate Python dev, no ML experience' },
      { key: 'hoursPerWeek', label: 'Hours/week available', placeholder: '8', type: 'number' },
      { key: 'timeframe', label: 'Timeframe', placeholder: '6 months' },
    ],
  },
  creator: {
    label: 'Creator Studio',
    fields: [
      { key: 'prompt', label: 'Creator context', placeholder: 'I make YouTube videos about personal finance and want to monetise my 5k audience' },
      { key: 'platform', label: 'Primary platform', placeholder: 'YouTube' },
      { key: 'niche', label: 'Niche', placeholder: 'Personal finance for millennials' },
      { key: 'monetisationGoal', label: 'Monetisation goal', placeholder: '$5k/month within 12 months' },
    ],
  },
  daily: {
    label: 'Daily OS',
    fields: [],
  },
};

const PANELS: Array<{ id: Panel; label: string }> = [
  { id: 'artifacts', label: 'Output' },
  { id: 'graph', label: 'Agents' },
  { id: 'tools', label: 'Tools' },
  { id: 'state', label: 'State' },
  { id: 'consensus', label: 'Consensus' },
];

function CostBar({ cost }: { cost?: CostSnapshot }) {
  if (!cost) return null;
  return (
    <div className="flex items-center gap-3 text-[11px] text-foreground-subtle tabular-nums">
      <span>${cost.estimatedUSD.toFixed(4)}</span>
      <span>{(cost.inputTokens + cost.outputTokens).toLocaleString()} tok</span>
    </div>
  );
}

interface Props {
  state: HarnessState;
  startSession: (entityType: EntityType, input: Record<string, unknown>) => void;
  reset: () => void;
}

export default function RunStudio({ state, startSession, reset }: Props) {
  const [entity, setEntity] = useState<EntityType>('daily');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<Panel>('artifacts');

  const meta = ENTITY_META[entity];
  const isActive = state.status === 'running';
  const hasContent = state.status !== 'idle';

  const handleSetField = useCallback((key: string, val: string) => {
    setFields(f => ({ ...f, [key]: val }));
  }, []);

  const handleStart = () => {
    const input: Record<string, unknown> = {};
    for (const f of meta.fields) {
      if (fields[f.key]) input[f.key] = f.type === 'number' ? Number(fields[f.key]) : fields[f.key];
    }
    startSession(entity, input);
    setPanel('artifacts');
  };

  const handleReset = () => {
    reset();
    setFields({});
  };

  const activeAgents = Object.values(state.agents).filter(a => a.status === 'running').length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 border-b border-border bg-surface px-6 py-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Studio</h2>
            <p className="text-xs text-foreground-muted mt-0.5 max-w-xl">
              Run agent workflows directly — simulations, daily ops, research sprints. Outputs appear in Work on the home screen when queued.
            </p>
          </div>
          <CostBar cost={state.cost} />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(ENTITY_META) as EntityType[]).map(e => (
            <button
              key={e}
              type="button"
              disabled={isActive}
              onClick={() => { setEntity(e); setFields({}); }}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                entity === e
                  ? 'bg-foreground text-surface'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle disabled:opacity-50'
              }`}
            >
              {ENTITY_META[e].label}
            </button>
          ))}
        </div>

        {!hasContent && meta.fields.length > 0 && (
          <div className="grid grid-cols-1 gap-3 max-w-2xl">
            {meta.fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs text-foreground-muted mb-1">{f.label}</label>
                {f.key === 'prompt' || f.key === 'idea' || f.key === 'goal' ? (
                  <textarea
                    rows={2}
                    className="input-field resize-none"
                    placeholder={f.placeholder}
                    value={fields[f.key] ?? ''}
                    onChange={e => handleSetField(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    className="input-field"
                    placeholder={f.placeholder}
                    value={fields[f.key] ?? ''}
                    onChange={e => handleSetField(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
            <button type="button" onClick={handleStart} className="btn-primary w-fit">
              Run {meta.label}
            </button>
          </div>
        )}

        {!hasContent && entity === 'daily' && (
          <div className="max-w-2xl flex items-center gap-4">
            <p className="text-xs text-foreground-muted flex-1">
              Orchestrates inbox, calendar, health, news, and work prep using your profile.
            </p>
            <button type="button" onClick={handleStart} className="btn-primary shrink-0">
              Run workflow
            </button>
          </div>
        )}

        {hasContent && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-foreground-muted text-xs">
              {isActive ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1.5 align-middle" />
                  {activeAgents} agent{activeAgents !== 1 ? 's' : ''} running
                </>
              ) : (
                `${Object.keys(state.agents).length} agents · ${state.toolCalls.length} tool calls · ${state.status}`
              )}
            </span>
            {state.error && <span className="text-danger text-xs">{state.error}</span>}
            <button
              type="button"
              onClick={handleReset}
              className="ml-auto text-xs text-foreground-subtle hover:text-foreground transition-colors"
            >
              Reset session
            </button>
          </div>
        )}
      </div>

      {hasContent ? (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex border-b border-border bg-surface px-6 gap-1">
            {PANELS.map(p => {
              let badge = '';
              if (p.id === 'tools' && state.toolCalls.length > 0) badge = String(state.toolCalls.length);
              if (p.id === 'consensus' && Object.keys(state.consensus).length > 0) badge = String(Object.keys(state.consensus).length);
              if (p.id === 'artifacts' && Object.keys(state.entityState).length > 0) badge = String(Object.keys(state.entityState).length);
              if (p.id === 'graph' && Object.keys(state.agents).length > 0) badge = String(Object.keys(state.agents).length);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPanel(p.id)}
                  className={`px-3 py-2.5 text-[12px] border-b-2 transition-colors flex items-center gap-1.5 ${
                    panel === p.id
                      ? 'border-foreground text-foreground font-medium'
                      : 'border-transparent text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {p.label}
                  {badge && (
                    <span className="text-[10px] text-foreground-subtle tabular-nums">{badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden p-6 min-h-0">
            {panel === 'graph' && (
              <div className="h-full overflow-auto">
                <AgentGraph agents={state.agents} />
              </div>
            )}
            {panel === 'tools' && (
              <div className="h-full">
                <ToolCallFeed toolCalls={state.toolCalls} />
              </div>
            )}
            {panel === 'state' && (
              <div className="h-full">
                <StateExplorer entityState={state.entityState} />
              </div>
            )}
            {panel === 'consensus' && (
              <div className="h-full">
                <ConsensusPanel consensus={state.consensus} />
              </div>
            )}
            {panel === 'artifacts' && (
              <div className="h-full overflow-y-auto">
                <ArtifactBrowser entityState={state.entityState} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-foreground-subtle text-sm">
          Pick a workflow and run it to inspect agent output here.
        </div>
      )}
    </div>
  );
}
