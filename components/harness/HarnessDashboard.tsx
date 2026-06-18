'use client';
import { useState, useCallback } from 'react';
import { useHarnessSession } from '@/hooks/useHarnessSession';
import AgentGraph from './AgentGraph';
import ToolCallFeed from './ToolCallFeed';
import StateExplorer from './StateExplorer';
import ConsensusPanel from './ConsensusPanel';
import ArtifactBrowser from './ArtifactBrowser';
import type { CostSnapshot } from '@/lib/harness/types';

type EntityType = 'company' | 'personal' | 'learning' | 'creator';
type Panel = 'graph' | 'tools' | 'state' | 'consensus' | 'artifacts';

const ENTITY_META: Record<EntityType, {
  label: string;
  icon: string;
  fields: Array<{ key: string; label: string; placeholder: string; type?: string }>;
}> = {
  company: {
    label: 'Company',
    icon: '🏢',
    fields: [
      { key: 'idea', label: 'Startup idea', placeholder: 'A B2B SaaS tool that automates invoice reconciliation for SMBs' },
    ],
  },
  personal: {
    label: 'Personal OS',
    icon: '🧠',
    fields: [
      { key: 'prompt', label: 'Life context', placeholder: 'I\'m a 32-year-old engineer who wants to transition to founding my own company in 18 months' },
      { key: 'priorities', label: 'Top priorities (comma-separated)', placeholder: 'financial independence, health, meaningful relationships' },
    ],
  },
  learning: {
    label: 'Learning OS',
    icon: '📚',
    fields: [
      { key: 'goal', label: 'What do you want to learn?', placeholder: 'Become proficient in machine learning engineering' },
      { key: 'skillLevel', label: 'Current skill level', placeholder: 'Intermediate Python dev, no ML experience' },
      { key: 'hoursPerWeek', label: 'Hours/week available', placeholder: '8', type: 'number' },
      { key: 'timeframe', label: 'Timeframe', placeholder: '6 months' },
    ],
  },
  creator: {
    label: 'Creator Studio',
    icon: '🎬',
    fields: [
      { key: 'prompt', label: 'Creator context', placeholder: 'I make YouTube videos about personal finance and want to monetise my 5k audience' },
      { key: 'platform', label: 'Primary platform', placeholder: 'YouTube' },
      { key: 'niche', label: 'Niche', placeholder: 'Personal finance for millennials' },
      { key: 'monetisationGoal', label: 'Monetisation goal', placeholder: '$5k/month within 12 months' },
    ],
  },
};

function CostBar({ cost }: { cost?: CostSnapshot }) {
  if (!cost) return null;
  return (
    <div className="flex items-center gap-4 text-[11px] font-mono text-gray-400">
      <span className="text-gray-600">cost</span>
      <span>${cost.estimatedUSD.toFixed(4)}</span>
      <span className="text-gray-600">tokens</span>
      <span>{(cost.inputTokens + cost.outputTokens).toLocaleString()}</span>
      <span className="text-gray-600">agents</span>
      <span>{cost.agentCount}</span>
      <span className="text-gray-600">calls</span>
      <span>{cost.toolCallCount}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    idle: 'bg-gray-800 text-gray-400',
    running: 'bg-blue-900/60 text-blue-300',
    paused: 'bg-amber-900/60 text-amber-300',
    complete: 'bg-green-900/60 text-green-300',
    error: 'bg-red-900/60 text-red-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${map[status] ?? map.idle}`}>
      {status}
    </span>
  );
}

const PANELS: Array<{ id: Panel; label: string }> = [
  { id: 'graph', label: 'Agent Graph' },
  { id: 'tools', label: 'Tool Calls' },
  { id: 'state', label: 'State' },
  { id: 'consensus', label: 'Consensus' },
  { id: 'artifacts', label: 'Artifacts' },
];

export default function HarnessDashboard() {
  const { state, startSession, reset } = useHarnessSession();
  const [entity, setEntity] = useState<EntityType>('company');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<Panel>('graph');

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
  };

  const handleReset = () => {
    reset();
    setFields({});
  };

  const activeAgents = Object.values(state.agents).filter(a => a.status === 'running').length;
  const consensusCount = Object.values(state.consensus).filter(c => c.status === 'in-progress').length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight">aidea</span>
          <span className="text-gray-600 text-sm">agentic workforce</span>
        </div>
        <div className="flex items-center gap-4">
          <CostBar cost={state.cost} />
          <StatusBadge status={state.status} />
        </div>
      </header>

      {/* Control row */}
      <div className="border-b border-gray-800 px-6 py-4 space-y-4">
        {/* Entity selector */}
        <div className="flex gap-2">
          {(Object.keys(ENTITY_META) as EntityType[]).map(e => (
            <button
              key={e}
              disabled={isActive}
              onClick={() => { setEntity(e); setFields({}); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                entity === e
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 disabled:opacity-50'
              }`}
            >
              {ENTITY_META[e].icon} {ENTITY_META[e].label}
            </button>
          ))}
        </div>

        {/* Input fields */}
        {!hasContent && (
          <div className="grid grid-cols-1 gap-3 max-w-3xl">
            {meta.fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                {f.key === 'prompt' || f.key === 'idea' || f.key === 'goal' ? (
                  <textarea
                    rows={2}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-600 placeholder-gray-600"
                    placeholder={f.placeholder}
                    value={fields[f.key] ?? ''}
                    onChange={e => handleSetField(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-600 placeholder-gray-600"
                    placeholder={f.placeholder}
                    value={fields[f.key] ?? ''}
                    onChange={e => handleSetField(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={handleStart}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-sm transition-colors"
              >
                Run {meta.label} →
              </button>
            </div>
          </div>
        )}

        {hasContent && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              {isActive ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-2" />
                  {activeAgents} agent{activeAgents !== 1 ? 's' : ''} running
                  {consensusCount > 0 && ` · ${consensusCount} consensus in progress`}
                </>
              ) : (
                `${Object.keys(state.agents).length} agents · ${state.toolCalls.length} tool calls`
              )}
            </span>
            {state.error && (
              <span className="text-red-400 text-xs">{state.error}</span>
            )}
            <button
              onClick={handleReset}
              className="ml-auto px-3 py-1 text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 rounded transition-colors"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      {hasContent && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Panel tabs */}
          <div className="flex border-b border-gray-800 px-6">
            {PANELS.map(p => {
              let badge = '';
              if (p.id === 'tools' && state.toolCalls.length > 0) badge = String(state.toolCalls.length);
              if (p.id === 'consensus' && Object.keys(state.consensus).length > 0) badge = String(Object.keys(state.consensus).length);
              if (p.id === 'artifacts' && Object.keys(state.entityState).length > 0) badge = String(Object.keys(state.entityState).length);
              if (p.id === 'graph' && Object.keys(state.agents).length > 0) badge = String(Object.keys(state.agents).length);
              return (
                <button
                  key={p.id}
                  onClick={() => setPanel(p.id)}
                  className={`px-4 py-2.5 text-sm border-b-2 transition-colors flex items-center gap-1.5 ${
                    panel === p.id
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {p.label}
                  {badge && (
                    <span className={`text-[10px] px-1 rounded ${
                      panel === p.id ? 'bg-blue-900 text-blue-300' : 'bg-gray-800 text-gray-500'
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden p-6">
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
              <div className="h-full">
                <ArtifactBrowser entityState={state.entityState} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-700 space-y-2">
          <div className="text-4xl mb-2">⬡</div>
          <div className="text-sm">Select an entity type, fill in the context, and run.</div>
          <div className="text-xs">Agents spawn, collaborate, and produce artifacts in real time.</div>
        </div>
      )}
    </div>
  );
}
