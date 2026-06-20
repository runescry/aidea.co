'use client';
import { useState, useEffect, useCallback } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { useSaveFeedback } from '@/hooks/useSaveFeedback';
import {
  IdentitySection,
  WorkSection,
  RelationshipsSection,
  GoalsSection,
  FamilySection,
  HealthSection,
  RoutinesSection,
  PreferencesSection,
  type ProfileUpdater,
} from './profile/ProfileSections';

interface Props {
  onRestartOnboarding?: () => void;
  refreshKey?: number;
}

export default function KnowledgeBaseEditor({ onRestartOnboarding, refreshKey = 0 }: Props) {
  const [data, setData] = useState<KnowledgeBase>({});
  const { saving, saved, runSave } = useSaveFeedback();

  const reload = useCallback(() => {
    fetch('/api/kb')
      .then(r => r.json())
      .then(d => setData(d as KnowledgeBase))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const save = useCallback(async (updates: Record<string, unknown>) => {
    await runSave(async () => {
      await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
    });
  }, [runSave]);

  const handleSaveAll = () => {
    save({
      identity: data.identity ?? {},
      work: data.work ?? {},
      relationships: data.relationships ?? {},
      family: data.family ?? {},
      health: data.health ?? {},
      routines: data.routines ?? {},
      goals: data.goals ?? {},
      learning: data.learning ?? {},
      preferences: data.preferences ?? {},
    });
  };

  const u: ProfileUpdater = (section, updates) => {
    setData(d => ({ ...d, [section]: { ...(d[section] as object ?? {}), ...updates } as KnowledgeBase[typeof section] }));
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">Your full profile — agents read every section to personalise outputs.</p>
        <div className="flex gap-2">
          {onRestartOnboarding && (
            <button onClick={onRestartOnboarding} className="px-3 py-1.5 btn-secondary text-xs">Re-run onboarding</button>
          )}
          <button onClick={handleSaveAll} disabled={saving} className="px-4 py-1.5 btn-primary text-xs">
            {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </div>

      <IdentitySection data={data} u={u} />
      <WorkSection data={data} u={u} />
      <RelationshipsSection data={data} u={u} />
      <GoalsSection data={data} u={u} />
      <FamilySection data={data} u={u} />
      <HealthSection data={data} u={u} />
      <RoutinesSection data={data} u={u} />
      <PreferencesSection data={data} u={u} />
    </div>
  );
}
