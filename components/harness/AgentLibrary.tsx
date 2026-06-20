'use client';

import { useState, useEffect, useCallback } from 'react';
import { Label, TextField, TextArea } from './forms';

type PromptMode = 'append' | 'replace';

interface AgentSummary {
  id: string;
  displayName: string;
  baseDisplayName: string;
  archetype: string;
  archetypeLabel: string;
  authority: string;
  defaultModel: string;
  stateWriteKey: string;
  baseTools: string[];
  tools: string[];
  systemPrompt: string;
  effectiveSystemPrompt: string;
  promptPreview: string;
  override: {
    displayName?: string;
    systemPromptReplace?: string;
    promptAppend?: string;
    tools?: string[];
  } | null;
  hasCustomization: boolean;
}

interface AgentGroup {
  id: string;
  label: string;
  agents: AgentSummary[];
}

interface ToolInfo {
  key: string;
  name: string;
  description: string;
  realWorld: boolean;
}

export default function AgentLibrary() {
  const [groups, setGroups] = useState<AgentGroup[]>([]);
  const [toolCatalog, setToolCatalog] = useState<Record<string, ToolInfo>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showEffectivePrompt, setShowEffectivePrompt] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [promptMode, setPromptMode] = useState<PromptMode>('append');
  const [systemPromptReplace, setSystemPromptReplace] = useState('');
  const [promptAppend, setPromptAppend] = useState('');
  const [enabledTools, setEnabledTools] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/agents');
    if (res.ok) {
      const data = await res.json() as { groups: AgentGroup[]; toolCatalog: Record<string, ToolInfo> };
      setGroups(data.groups);
      setToolCatalog(data.toolCatalog);
      setSelectedId(prev => prev ?? data.groups[0]?.agents[0]?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = groups.flatMap(g => g.agents).find(a => a.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setDisplayName(selected.override?.displayName ?? '');
    setPromptMode(selected.override?.systemPromptReplace ? 'replace' : 'append');
    setSystemPromptReplace(selected.override?.systemPromptReplace ?? selected.systemPrompt);
    setPromptAppend(selected.override?.promptAppend ?? '');
    setEnabledTools(selected.tools);
    setShowEffectivePrompt(false);
    setSaveError(null);
  }, [selected]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSaved(false);
    setSaveError(null);
  };

  const toggleTool = (tool: string) => {
    setEnabledTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool],
    );
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selected.id,
          displayName: displayName.trim() || '',
          systemPromptReplace: promptMode === 'replace' ? systemPromptReplace.trim() || '' : '',
          promptAppend: promptMode === 'append' ? promptAppend.trim() || '' : (promptAppend.trim() || ''),
          tools: enabledTools,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setSaveError(err.error ?? 'Could not save — try again.');
        return;
      }
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError('Could not save — check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selected.id, reset: true }),
      });
      if (!res.ok) {
        setSaveError('Could not reset agent.');
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const switchToReplace = () => {
    if (!selected) return;
    setPromptMode('replace');
    if (!systemPromptReplace || systemPromptReplace === selected.systemPrompt) {
      setSystemPromptReplace(selected.systemPrompt);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
        Loading agents…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 overflow-hidden bg-surface">
      <aside
        className={`flex flex-col min-h-0 shrink-0 border-border bg-surface overflow-hidden ${
          selectedId ? 'hidden md:flex' : 'flex flex-1 md:flex-none'
        } w-full md:w-72 lg:w-80 border-b md:border-b-0 md:border-r`}
      >
        <div className="shrink-0 px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-foreground">Agent library</h2>
          <p className="text-[11px] text-foreground-subtle mt-0.5">
            {groups.reduce((n, g) => n + g.agents.length, 0)} agents · edits apply on next run
          </p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {groups.map(group => (
            <div key={group.id}>
              <div className="px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-foreground-subtle bg-surface-subtle/50 sticky top-0 z-10">
                {group.label}
              </div>
              {group.agents.map(agent => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handleSelect(agent.id)}
                  className={`w-full text-left px-4 py-2.5 border-b border-border/50 transition-colors ${
                    selectedId === agent.id ? 'bg-accent/[0.05]' : 'hover:bg-surface-subtle/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] text-foreground truncate">{agent.displayName}</span>
                    {agent.hasCustomization && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Customized" />
                    )}
                  </div>
                  <div className="text-[11px] text-foreground-subtle mt-0.5 truncate">
                    {agent.id} · {agent.authority}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <main className={`${!selectedId ? 'hidden md:flex' : 'flex'} flex-1 flex-col min-w-0 min-h-0 overflow-y-auto`}>
        {!selected ? (
          <div className="hidden md:flex items-center justify-center h-full text-sm text-foreground-muted">
            Select an agent
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto p-4 md:p-6 space-y-6">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="md:hidden text-[12px] text-foreground-muted hover:text-foreground -mt-1 mb-2"
            >
              ← All agents
            </button>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground">{selected.displayName}</h1>
                <p className="text-xs text-foreground-muted mt-1 font-mono">{selected.id}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex gap-2">
                  {selected.hasCustomization && (
                    <button type="button" onClick={handleReset} disabled={saving} className="btn-secondary text-xs py-1.5">
                      Reset all
                    </button>
                  )}
                  <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5">
                    {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
                {saveError && <p className="text-[11px] text-danger">{saveError}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-border p-3">
                <div className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1">Archetype</div>
                <div className="text-foreground capitalize">{selected.archetype}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1">Authority</div>
                <div className="text-foreground capitalize">{selected.authority}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1">Model</div>
                <div className="text-foreground text-xs font-mono">{selected.defaultModel}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-[10px] uppercase tracking-wider text-foreground-subtle mb-1">Writes to</div>
                <div className="text-foreground text-xs font-mono">{selected.stateWriteKey || '—'}</div>
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <h3 className="text-[13px] font-semibold text-foreground">Persona</h3>

              <div>
                <Label hint="Used at runtime — injected into every system prompt">Display name</Label>
                <TextField
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder={selected.baseDisplayName}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-foreground-muted">Prompt mode</span>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setPromptMode('append')}
                      className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                        promptMode === 'append' ? 'bg-foreground text-surface' : 'text-foreground-muted hover:text-foreground'
                      }`}
                    >
                      Append instructions
                    </button>
                    <button
                      type="button"
                      onClick={switchToReplace}
                      className={`px-3 py-1 text-[11px] font-medium transition-colors border-l border-border ${
                        promptMode === 'replace' ? 'bg-foreground text-surface' : 'text-foreground-muted hover:text-foreground'
                      }`}
                    >
                      Replace persona
                    </button>
                  </div>
                </div>

                {promptMode === 'append' ? (
                  <div>
                    <Label hint="Added after the built-in persona on every run">Additional instructions</Label>
                    <TextArea
                      value={promptAppend}
                      onChange={setPromptAppend}
                      rows={5}
                      placeholder="e.g. Always use British English. Be concise. Never suggest meetings before 9am."
                    />
                    <button
                      type="button"
                      onClick={() => setShowEffectivePrompt(s => !s)}
                      className="mt-2 text-[11px] text-foreground-muted hover:text-foreground"
                    >
                      {showEffectivePrompt ? 'Hide' : 'Preview'} runtime prompt
                    </button>
                  </div>
                ) : (
                  <div>
                    <Label hint="Replaces the built-in system prompt entirely">Custom persona</Label>
                    <TextArea
                      value={systemPromptReplace}
                      onChange={setSystemPromptReplace}
                      rows={14}
                      placeholder={selected.systemPrompt}
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-foreground-subtle mt-2">
                      Built-in persona shown for reference —{' '}
                      <button
                        type="button"
                        className="text-accent hover:underline"
                        onClick={() => setShowEffectivePrompt(s => !s)}
                      >
                        {showEffectivePrompt ? 'hide' : 'view'}
                      </button>
                    </p>
                  </div>
                )}

                {showEffectivePrompt && (
                  <pre className="mt-3 text-xs text-foreground-muted bg-surface-subtle rounded-lg p-4 overflow-auto max-h-72 whitespace-pre-wrap border border-border leading-relaxed">
                    {promptMode === 'replace'
                      ? selected.systemPrompt
                      : selected.effectiveSystemPrompt}
                  </pre>
                )}
              </div>

              {promptMode === 'replace' && (
                <div>
                  <Label hint="Optional — still appended after your custom persona">Additional instructions</Label>
                  <TextArea
                    value={promptAppend}
                    onChange={setPromptAppend}
                    rows={3}
                    placeholder="Optional extra rules on top of your custom persona"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-border pt-6">
              <h3 className="text-[13px] font-semibold text-foreground">Tools</h3>
              <p className="text-xs text-foreground-muted">
                Toggle which tools this agent can use at runtime. You can disable all tools if needed.
              </p>
              {enabledTools.length === 0 && (
                <p className="text-[11px] text-warning">No tools enabled — this agent won&apos;t be able to take actions.</p>
              )}
              <div className="space-y-1">
                {selected.baseTools.map(tool => {
                  const info = toolCatalog[tool];
                  const on = enabledTools.includes(tool);
                  return (
                    <label
                      key={tool}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        on ? 'border-foreground/20 bg-surface-subtle/50' : 'border-border opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleTool(tool)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-mono text-foreground">{tool}</span>
                          {info?.realWorld && (
                            <span className="text-[9px] uppercase tracking-wide text-warning font-medium">Real world</span>
                          )}
                        </div>
                        {info?.description && (
                          <p className="text-[11px] text-foreground-muted mt-0.5 leading-relaxed">{info.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
