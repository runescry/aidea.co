'use client';

import { useState, useEffect, useCallback } from 'react';
import type { JobApplication, KnowledgeBase } from '@/types/knowledge-base';
import { useSaveFeedback } from '@/hooks/useSaveFeedback';
import type { ProfileDomain } from '@/lib/profile/summary';
import { findJobApplicationIndex } from '@/lib/profile/summary';
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

  const u: ProfileUpdater = (section, updates) => {
    setData(d => ({ ...d, [section]: { ...(d[section] as object ?? {}), ...updates } as KnowledgeBase[typeof section] }));
  };

  const saveChapter = async (chapter: string) => {
    const goals = { ...(data.goals ?? {}), currentChapter: chapter };
    u('goals', { currentChapter: chapter });
    await save({ goals });
  };

  const updateJob = async (job: JobApplication, patch: Partial<JobApplication>) => {
    const projects = data.work?.currentProjects;
    if (!projects || Array.isArray(projects)) return;
    const idx = findJobApplicationIndex(data, job);
    if (idx < 0) return;
    const jobs = [...(projects.jobApplications ?? [])];
    jobs[idx] = { ...jobs[idx], ...patch };
    const currentProjects = { ...projects, jobApplications: jobs };
    const work = { ...(data.work ?? {}), currentProjects };
    u('work', { currentProjects });
    await save({ work });
  };

  const saveDomain = () => {
    if (!openDomain) return;
    switch (openDomain) {
      case 'identity':
        save({
          identity: data.identity ?? {},
          goals: data.goals ?? {},
          family: data.family ?? {},
          routines: data.routines ?? {},
          learning: data.learning ?? {},
        });
        break;
      case 'work':
        save({ work: data.work ?? {} });
        break;
      case 'contacts':
        save({ relationships: data.relationships ?? {}, work: data.work ?? {} });
        break;
      case 'health':
        save({ health: data.health ?? {} });
        break;
      case 'preferences':
        save({ preferences: data.preferences ?? {} });
        break;
      case 'finance':
        save({ finance: data.finance ?? {} });
        break;
    }
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
            Read-first control center — tap to tweak priorities; chat for everything else.
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
          onUpdateJob={(job, patch) => { void updateJob(job, patch); }}
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
        onSave={saveDomain}
        onOpenChat={draft => onOpenChat?.(draft)}
      />
    </div>
  );
}
