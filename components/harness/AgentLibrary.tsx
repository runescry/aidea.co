'use client';

import { useState, useEffect, useCallback } from 'react';
import { Label, TextField, TextArea } from './forms';

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
  promptPreview: string;
  override: {
    displayName?: string;
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
  const [showPrompt, setShowPrompt] = useState(false);

  const [displayName, setDisplayName] = useState('');
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
    setPromptAppend(selected.override?.promptAppend ?? '');
    setEnabledTools(selected.tools);
    setShowPrompt(false);
  }, [selected]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSaved(false);
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
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selected.id,
          displayName: displayName.trim() || undefined,
          promptAppend: promptAppend.trim() || undefined,
          tools: enabledTools.length > 0 ? enabledTools : undefined,
        }),
      });
      if (res.ok) await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selected.id, reset: true }),
      });
      await load();
    } finally {
      setSaving(false);
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
    <div className="flex-1 flex min-h-0">
      <aside className="w-[300px] shrink-0 border-r border-border bg-surface overflow-y-auto">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-foreground">Agent library</h2>
          <p className="text-[11px] text-foreground-subtle mt-0.5">
            {groups.reduce((n, g) => n + g.agents.length, 0)} agents in your workforce
          </p>
        </div>
        {groups.map(group => (
          <div key={group.id}>
            <div className="px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-foreground-subtle bg-surface-subtle/50">
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
                <div className="flex items-center gap-2">
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
      </aside>

      <main className="flex-1 overflow-y-auto min-w-0">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-sm text-foreground-muted">
            Select an agent
          </div>
        ) : (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground">{selected.displayName}</h1>
                <p className="text-xs text-foreground-muted mt-1 font-mono">{selected.id}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {selected.hasCustomization && (
                  <button type="button" onClick={handleReset} disabled={saving} className="btn-secondary text-xs py-1.5">
                    Reset
                  </button>
                )}
                <button type="button" onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5">
                  {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
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

            <div>
              <button
                type="button"
                onClick={() => setShowPrompt(s => !s)}
                className="text-[12px] font-medium text-foreground-muted hover:text-foreground"
              >
                {showPrompt ? 'Hide' : 'View'} base persona
              </button>
              {showPrompt && (
                <pre className="mt-2 text-xs text-foreground-muted bg-surface-subtle rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap border border-border leading-relaxed">
                  {selected.systemPrompt}
                </pre>
              )}
              {!showPrompt && (
                <p className="mt-2 text-xs text-foreground-subtle leading-relaxed">{selected.promptPreview}</p>
              )}
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <h3 className="text-[13px] font-semibold text-foreground">Customize</h3>
              <div>
                <Label>Display name</Label>
                <TextField
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder={selected.baseDisplayName}
                />
              </div>
              <div>
                <Label hint="Appended to the base persona on every run">Additional instructions</Label>
                <TextArea
                  value={promptAppend}
                  onChange={setPromptAppend}
                  rows={4}
                  placeholder="e.g. Always use British English. Be concise. Never suggest meetings before 9am."
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-6">
              <h3 className="text-[13px] font-semibold text-foreground">Tools</h3>
              <p className="text-xs text-foreground-muted">
                Toggle which tools this agent can use. Disabled tools won&apos;t be available at runtime.
              </p>
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
