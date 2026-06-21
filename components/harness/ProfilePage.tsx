'use client';

import { useState, useEffect, useCallback } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { useSaveFeedback } from '@/hooks/useSaveFeedback';
import type { ProfileDomain } from '@/lib/profile/summary';
import type { ProfileUpdater } from './profile/ProfileSections';
import ProfileSummaryView from './profile/ProfileSummaryView';
import ProfileDomainSheet from './profile/ProfileDomainSheet';

interface Props {
  onRestartOnboarding?: () => void;
  onOpenChat?: (draft: string) => void;
  refreshKey?: number;
}

export default function ProfilePage({ onRestartOnboarding, onOpenChat, refreshKey = 0 }: Props) {
  const [data, setData] = useState<KnowledgeBase>({});
  const [loading, setLoading] = useState(true);
  const [openDomain, setOpenDomain] = useState<ProfileDomain | null>(null);
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

  const saveChapter = async (chapter: string) => {
    const goals = { ...(data.goals ?? {}), currentChapter: chapter };
    u('goals', { currentChapter: chapter });
    await save({ goals });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">
        Loading profile…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden bg-surface">
      <div className="shrink-0 px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title text-foreground">Profile</h1>
          <p className="text-xs text-foreground-subtle mt-0.5">
            Your control center — agents read this to personalise drafts, briefs, and suggestions.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {onRestartOnboarding && (
            <button type="button" onClick={onRestartOnboarding} className="px-3 py-1.5 btn-secondary text-xs">
              Re-run onboarding
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
        <ProfileSummaryView
          data={data}
          onEditChapter={chapter => { void saveChapter(chapter); }}
          onOpenDomain={setOpenDomain}
          onOpenChat={draft => onOpenChat?.(draft)}
        />
      </div>

      <ProfileDomainSheet
        domain={openDomain}
        data={data}
        u={u}
        saving={saving}
        saved={saved}
        onClose={() => setOpenDomain(null)}
        onSave={handleSaveAll}
      />
    </div>
  );
}
