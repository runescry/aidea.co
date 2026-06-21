'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { hasProjects } from '@/types/knowledge-base';
import { buildContactGraph } from '@/lib/contacts/interaction-graph';
import { readHealthSyncSnapshot } from '@/lib/health/sync';
import { useSaveFeedback } from '@/hooks/useSaveFeedback';
import { StatusDot } from './forms';
import {
  IdentitySection,
  WorkSection,
  RelationshipsSection,
  GoalsSection,
  FamilySection,
  HealthSection,
  RoutinesSection,
  PreferencesSection,
  LearningSection,
  FinanceSection,
  type ProfileUpdater,
} from './profile/ProfileSections';
import ContactLensPanel from './ContactLensPanel';
import HealthLensPanel from './HealthLensPanel';

const LENSES = [
  { id: 'profile', label: 'Profile', hint: 'Identity, goals, family' },
  { id: 'work', label: 'Work', hint: 'Role and projects' },
  { id: 'contacts', label: 'Contacts', hint: 'People and graph' },
  { id: 'health', label: 'Health', hint: 'Training and wellness' },
  { id: 'preferences', label: 'Preferences', hint: 'Briefings and tone' },
  { id: 'finance', label: 'Finance', hint: 'Subscriptions and budget' },
] as const;

type ContextLens = (typeof LENSES)[number]['id'];

function lensHasData(data: KnowledgeBase, lens: ContextLens): boolean {
  switch (lens) {
    case 'profile':
      return Boolean(
        data.identity?.name?.trim()
        || data.goals?.lifePriorities?.length
        || data.family?.partner?.name?.trim()
        || data.routines?.morningRoutine?.trim()
        || data.learning?.interests?.length,
      );
    case 'work':
      return Boolean(data.work?.role?.trim() || hasProjects(data.work?.currentProjects));
    case 'contacts':
      return buildContactGraph(data).length > 0;
    case 'health':
      return Boolean(
        readHealthSyncSnapshot(data).recentActivities.length
        || data.health?.currentGoals?.length
        || Object.values(data.health?.workoutSchedule ?? {}).some(v => v?.trim()),
      );
    case 'preferences':
      return Boolean(
        data.preferences?.newsTopics?.length
        || data.preferences?.briefingTime?.trim()
        || data.preferences?.defaultAutonomyLevel,
      );
    case 'finance':
      return Boolean(
        data.finance?.monthlyBudgetNotes?.trim()
        || data.finance?.subscriptions?.some(s => s.name?.trim()),
      );
    default:
      return false;
  }
}

interface Props {
  onRestartOnboarding?: () => void;
  refreshKey?: number;
}

export default function KnowledgeBaseEditor({ onRestartOnboarding, refreshKey = 0 }: Props) {
  const [data, setData] = useState<KnowledgeBase>({});
  const [loading, setLoading] = useState(true);
  const [lens, setLens] = useState<ContextLens>('profile');
  const { saving, saved, runSave } = useSaveFeedback();

  const reload = useCallback(() => {
    setLoading(true);
    fetch('/api/kb')
      .then(r => r.json())
      .then(d => setData(d as KnowledgeBase))
      .catch(() => {})
      .finally(() => setLoading(false));
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
      finance: data.finance ?? {},
    });
  };

  const u: ProfileUpdater = (section, updates) => {
    setData(d => ({ ...d, [section]: { ...(d[section] as object ?? {}), ...updates } as KnowledgeBase[typeof section] }));
  };

  const activeLens = LENSES.find(l => l.id === lens)!;
  const filledCount = useMemo(
    () => LENSES.filter(l => lensHasData(data, l.id)).length,
    [data],
  );

  const sectionProps = { data, u, embedded: true as const };

  const lensContent = (() => {
    switch (lens) {
      case 'profile':
        return (
          <div className="space-y-8">
            <IdentitySection {...sectionProps} />
            <GoalsSection {...sectionProps} />
            <FamilySection {...sectionProps} />
            <RoutinesSection {...sectionProps} />
            <LearningSection {...sectionProps} />
          </div>
        );
      case 'work':
        return <WorkSection {...sectionProps} />;
      case 'contacts':
        return (
          <div className="space-y-8">
            <ContactLensPanel data={data} />
            <RelationshipsSection {...sectionProps} />
          </div>
        );
      case 'health':
        return (
          <div className="space-y-8">
            <HealthLensPanel data={data} />
            <HealthSection {...sectionProps} />
          </div>
        );
      case 'preferences':
        return <PreferencesSection {...sectionProps} />;
      case 'finance':
        return <FinanceSection {...sectionProps} />;
      default:
        return null;
    }
  })();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
        Loading context…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 overflow-hidden bg-surface">
      <aside
        className={`flex flex-col min-h-0 shrink-0 border-border bg-surface overflow-hidden ${
          lens ? 'hidden md:flex' : 'flex flex-1 md:flex-none'
        } w-full md:w-56 lg:w-64 border-b md:border-b-0 md:border-r`}
      >
        <div className="shrink-0 px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-foreground">Context</h2>
          <p className="text-[11px] text-foreground-subtle mt-0.5">
            {filledCount} of {LENSES.length} lenses filled
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto min-h-0 p-2 space-y-0.5">
          {LENSES.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLens(item.id)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                lens === item.id
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-foreground hover:bg-surface-subtle border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <StatusDot configured={lensHasData(data, item.id)} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <p className="text-[11px] text-foreground-subtle mt-0.5 pl-4">{item.hint}</p>
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <div className="shrink-0 px-4 py-3 border-b border-border bg-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 md:hidden">
              <label htmlFor="context-lens" className="text-[11px] text-foreground-subtle shrink-0">Lens</label>
              <select
                id="context-lens"
                value={lens}
                onChange={e => setLens(e.target.value as ContextLens)}
                className="input-field text-sm flex-1 min-w-0"
              >
                {LENSES.map(item => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            <h2 className="text-title text-foreground hidden md:block">{activeLens.label}</h2>
            <p className="text-xs text-foreground-subtle mt-0.5 hidden md:block">{activeLens.hint}</p>
            <p className="text-[11px] text-foreground-muted mt-1">
              Agents read this profile to personalise drafts, briefs, and suggestions.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {onRestartOnboarding && (
              <button type="button" onClick={onRestartOnboarding} className="px-3 py-1.5 btn-secondary text-xs">
                Re-run onboarding
              </button>
            )}
            <button type="button" onClick={handleSaveAll} disabled={saving} className="px-4 py-1.5 btn-primary text-xs">
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
          <div className="max-w-2xl">{lensContent}</div>
        </div>
      </div>
    </div>
  );
}
