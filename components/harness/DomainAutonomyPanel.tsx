'use client';
import { useEffect, useState, useCallback } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { AUTONOMY_DOMAINS, readDomainAutonomy, domainAutonomyLabel, type AutonomyLevel } from '@/lib/harness/domain-autonomy';
import { Label } from './forms';
import { useSaveFeedback } from '@/hooks/useSaveFeedback';

export default function DomainAutonomyPanel() {
  const [kb, setKb] = useState<KnowledgeBase>({});
  const { saving, saved, runSave } = useSaveFeedback();
  const load = useCallback(() => {
    fetch('/api/kb').then(r => r.json()).then(d => setKb(d as KnowledgeBase)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const levels = readDomainAutonomy(kb);
  const updateDomain = (key: typeof AUTONOMY_DOMAINS[number]['key'], level: AutonomyLevel) => {
    setKb(prev => ({ ...prev, preferences: { ...prev.preferences, domainAutonomy: { ...prev.preferences?.domainAutonomy, [key]: level } } }));
  };
  const save = () => void runSave(async () => {
    await fetch('/api/kb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: { preferences: kb.preferences } }) });
    load();
  });
  return (
    <section className="card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Trust by domain</h3>
      {AUTONOMY_DOMAINS.map(domain => (
        <div key={domain.key} className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-2">
          <Label>{domain.label}</Label>
          <select value={levels[domain.key]} onChange={e => updateDomain(domain.key, e.target.value as AutonomyLevel)} className="input-field text-sm py-1.5">
            {(['supervised','semi-autonomous','autonomous'] as AutonomyLevel[]).map(l => <option key={l} value={l}>{domainAutonomyLabel(l)}</option>)}
          </select>
        </div>
      ))}
      <button type="button" onClick={save} disabled={saving} className="btn-primary text-xs py-1.5 px-4">{saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save trust settings'}</button>
    </section>
  );
}
