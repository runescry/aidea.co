'use client';

import type { ReactNode } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import type { ProfileDomain } from '@/lib/profile/summary';
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
} from './ProfileSections';
import ContactLensPanel from '../ContactLensPanel';
import HealthLensPanel from '../HealthLensPanel';

const TITLES: Record<ProfileDomain, string> = {
  identity: 'Identity & goals',
  work: 'Work',
  contacts: 'People',
  health: 'Health',
  preferences: 'Preferences',
  finance: 'Finance',
};

function domainContent(domain: ProfileDomain, props: { data: KnowledgeBase; u: ProfileUpdater }) {
  switch (domain) {
    case 'identity':
      return (
        <div className="space-y-8">
          <GoalsSection {...props} embedded />
          <IdentitySection {...props} embedded />
          <FamilySection {...props} embedded />
          <RoutinesSection {...props} embedded />
          <LearningSection {...props} embedded />
        </div>
      );
    case 'work':
      return <WorkSection {...props} embedded />;
    case 'contacts':
      return (
        <div className="space-y-8">
          <ContactLensPanel data={props.data} />
          <RelationshipsSection {...props} embedded />
        </div>
      );
    case 'health':
      return (
        <div className="space-y-8">
          <HealthLensPanel data={props.data} />
          <HealthSection {...props} embedded />
        </div>
      );
    case 'preferences':
      return <PreferencesSection {...props} embedded />;
    case 'finance':
      return <FinanceSection {...props} embedded />;
    default:
      return null;
  }
}

interface Props {
  domain: ProfileDomain | null;
  data: KnowledgeBase;
  u: ProfileUpdater;
  saving: boolean;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function ProfileDomainSheet({
  domain,
  data,
  u,
  saving,
  saved,
  onClose,
  onSave,
}: Props) {
  if (!domain) return null;

  const sectionProps = { data, u, embedded: true as const };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex flex-col w-full max-w-lg h-full bg-surface border-l border-border shadow-xl">
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title text-foreground">{TITLES[domain]}</h2>
            <p className="text-[11px] text-foreground-subtle mt-0.5">Edit details agents use for drafts and briefs.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="px-3 py-1.5 btn-secondary text-xs">
              Close
            </button>
            <button type="button" onClick={onSave} disabled={saving} className="px-4 py-1.5 btn-primary text-xs">
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
          {domainContent(domain, sectionProps) as ReactNode}
        </div>
      </div>
    </div>
  );
}
