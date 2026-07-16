'use client';

import { useState, useCallback } from 'react';
import type { HarnessState } from '@/hooks/useHarnessSession';
import AgentGraph from './AgentGraph';
import ToolCallFeed from './ToolCallFeed';
import StateExplorer from './StateExplorer';
import ConsensusPanel from './ConsensusPanel';
import ArtifactBrowser from './ArtifactBrowser';
import type { CostSnapshot, EntityType } from '@/lib/harness/types';
import { STUDIO_ENTITY_META } from '@/lib/entities/run-meta';
import EntityTypeIcon from './studio/EntityTypeIcon';
import StudioLaunchPanel from './studio/StudioLaunchPanel';

type Panel = 'graph' | 'tools' | 'state' | 'consensus' | 'artifacts';

const ENTITY_META = STUDIO_ENTITY_META;

const PANELS: Array<{ id: Panel; label: string }> = [
  { id: 'artifacts', label: 'Output' },
  { id: 'graph', label: 'Agents' },
  { id: 'tools', label: 'Tools' },
  { id: 'state', label: 'State' },
  { id: 'consensus', label: 'Consensus' },
];

function CostBar({ cost }: { cost?: CostSnapshot }) {
  if (!cost) return null;
  const topAgents = cost.agentUsage
    ? Object.values(cost.agentUsage).sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 2)
    : [];
  return (
    <div className="flex flex-col items-end gap-0.5 text-[11px] text-foreground-subtle tabular-nums">
      <div className="flex items-center gap-3">
        <span>${cost.estimatedUSD.toFixed(4)}</span>
        <span>{(cost.inputTokens + cost.outputTokens).toLocaleString()} tok</span>
      </div>
      {topAgents.length > 0 && (
        <div className="flex flex-wrap justify-end gap-x-2 gap-y-0.5 text-micro">
          {topAgents.map(a => (
            <span key={a.agentRole}>
              {a.agentRole}: {a.totalTokens.toLocaleString()}
            </span>
          ))}
        </div>
      )}
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
  const [dailyMode, setDailyMode] = useState<'lite' | 'full'>('full');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<Panel>('artifacts');

  const meta = ENTITY_META[entity];
  const isBusy = state.status === 'running' || state.status === 'starting';
  const showWorkspace =
    state.status === 'starting'
    || state.status === 'running'
    || state.status === 'complete'
    || state.status === 'paused'
    || Object.keys(state.agents).length > 0;

  const handleSetField = useCallback((key: string, val: string) => {
    setFields(f => ({ ...f, [key]: val }));
  }, []);

  const handleStart = () => {
    const input: Record<string, unknown> = {};
    if (entity === 'daily') {
      input.mode = dailyMode;
    }
    for (const f of meta.fields) {
      if (fields[f.key]) input[f.key] = f.type === 'number' ? Number(fields[f.key]) : fields[f.key];
    }
    startSession(entity, input);
    setPanel('tools');
  };

  const handleReset = () => {
    reset();
    setFields({});
  };

  const activeAgents = Object.values(state.agents).filter(a => a.status === 'running').length;

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-surface">
      <div className="shrink-0 border-b border-border bg-surface px-4 py-3 md:px-6 md:py-4 space-y-3">
        <div className="flex items-start justify-between gap-3 md:gap-4">
          <div>
            <h2 className="text-title text-foreground">Studio</h2>
            <p className="text-caption text-foreground-muted mt-0.5 max-w-xl">
              Run multi-agent workflows and inspect output, tools, and state.
            </p>
          </div>
          <CostBar cost={state.cost} />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(ENTITY_META).filter(e => e !== 'custom') as EntityType[]).map(e => (
            <button
              key={e}
              type="button"
              disabled={isBusy}
              onClick={() => { setEntity(e); setFields({}); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium transition-colors border ${
                entity === e
                  ? 'bg-foreground text-surface border-foreground'
                  : 'text-foreground-muted border-transparent hover:text-foreground hover:bg-surface-subtle disabled:opacity-50'
              }`}
            >
              <EntityTypeIcon entity={e} className="w-3.5 h-3.5 shrink-0" />
              {ENTITY_META[e].label}
            </button>
          ))}
        </div>

        {showWorkspace && (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-caption text-foreground-muted">
              {state.status === 'starting' ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1.5 align-middle" />
                  Starting run…
                </>
              ) : state.status === 'running' ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1.5 align-middle" />
                  {activeAgents > 0
                    ? `${activeAgents} agent${activeAgents !== 1 ? 's' : ''} running`
                    : Object.keys(state.agents).length > 0
                      ? `${Object.keys(state.agents).length} agent${Object.keys(state.agents).length !== 1 ? 's' : ''} · starting up…`
                      : 'Connecting to agents…'}
                </>
              ) : (
                `${Object.keys(state.agents).length} agents · ${state.toolCalls.length} tool calls · ${state.status}`
              )}
            </span>
            {state.error && (
              <span className="text-caption text-danger">{state.error}</span>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="ml-auto text-caption text-foreground-subtle hover:text-foreground transition-colors"
            >
              Reset session
            </button>
          </div>
        )}
      </div>

      {showWorkspace ? (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex border-b border-border bg-surface px-4 md:px-6 gap-1 overflow-x-auto scrollbar-none">
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
                  className={`px-3 py-2.5 text-caption border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                    panel === p.id
                      ? 'border-foreground text-foreground font-medium'
                      : 'border-transparent text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {p.label}
                  {badge && (
                    <span className="text-micro text-foreground-subtle tabular-nums">{badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden p-4 md:p-6 min-h-0 bg-surface-muted/30">
            {panel === 'graph' && (
              <div className="h-full overflow-auto card p-4">
                <AgentGraph agents={state.agents} />
              </div>
            )}
            {panel === 'tools' && (
              <div className="h-full card p-4 overflow-hidden">
                <ToolCallFeed toolCalls={state.toolCalls} />
              </div>
            )}
            {panel === 'state' && (
              <div className="h-full card p-4 overflow-hidden">
                <StateExplorer entityState={state.entityState} />
              </div>
            )}
            {panel === 'consensus' && (
              <div className="h-full card p-4 overflow-hidden">
                <ConsensusPanel consensus={state.consensus} />
              </div>
            )}
            {panel === 'artifacts' && (
              <div className="h-full card p-4 overflow-y-auto">
                {(state.status === 'starting' || state.status === 'running')
                  && Object.keys(state.entityState).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <p className="text-caption text-foreground-muted">
                      {state.status === 'starting'
                        ? 'Connecting to agent workforce…'
                        : state.toolCalls.length > 0
                          ? `Agents working — ${state.toolCalls.length} tool call${state.toolCalls.length !== 1 ? 's' : ''} so far`
                          : 'Agents are thinking — first output usually appears within a minute'}
                    </p>
                  </div>
                ) : (
                  <ArtifactBrowser entityState={state.entityState} />
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <StudioLaunchPanel
          entity={entity}
          fields={fields}
          dailyMode={dailyMode}
          starting={state.status === 'starting'}
          onFieldChange={handleSetField}
          onDailyModeChange={setDailyMode}
          onStart={handleStart}
          error={state.status === 'error' ? state.error : undefined}
        />
      )}
    </div>
  );
}
