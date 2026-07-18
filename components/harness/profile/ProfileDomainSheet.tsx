'use client';

import { useState, useEffect } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import type { ProfileDomain } from '@/lib/profile/summary';
import { chatPromptForDomain, domainReadout } from '@/lib/profile/domain-readout';
import type { ProfileUpdater } from './ProfileSections';
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
} from './ProfileSections';

const TITLES: Record<ProfileDomain, string> = {
  identity: 'Identity & goals',
  work: 'Work',
  contacts: 'People',
  health: 'Health',
  preferences: 'Preferences',
  finance: 'Finance',
};

function domainFields(domain: ProfileDomain, props: { data: KnowledgeBase; u: ProfileUpdater }) {
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
      return <RelationshipsSection {...props} embedded />;
    case 'health':
      return <HealthSection {...props} embedded />;
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
  onOpenChat: (draft: string) => void;
}

export default function ProfileDomainSheet({
  domain,
  data,
  u,
  saving,
  saved,
  onClose,
  onSave,
  onOpenChat,
}: Props) {
  const [showFields, setShowFields] = useState(false);

  useEffect(() => {
    setShowFields(false);
  }, [domain]);

  if (!domain) return null;

  const lines = domainReadout(data, domain);
  const sectionProps = { data, u, embedded: true as const };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-xl">
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title text-foreground">{TITLES[domain]}</h2>
            <p className="text-[11px] text-foreground-subtle mt-0.5">What agents know — edit via chat, not forms.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-1.5 btn-secondary text-xs shrink-0">
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
          <ul className="space-y-2">
            {lines.map((line, i) => (
              <li key={i} className="text-sm text-foreground leading-relaxed">
                {line}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                onOpenChat(chatPromptForDomain(domain));
                onClose();
              }}
              className="btn-primary min-h-11 w-full px-3 text-xs sm:w-auto"
            >
              Update via chat
            </button>
            <button
              type="button"
              onClick={() => setShowFields(v => !v)}
              className="btn-secondary min-h-11 w-full px-3 text-xs sm:w-auto"
            >
              {showFields ? 'Hide field editor' : 'Field editor'}
            </button>
          </div>

          {showFields && (
            <div className="pt-4 border-t border-border space-y-4">
              <p className="text-[11px] text-foreground-subtle">
                Advanced — prefer chat for bulk updates.
              </p>
              {domainFields(domain, sectionProps)}
              <button type="button" onClick={onSave} disabled={saving} className="btn-primary min-h-11 w-full px-4 text-xs sm:min-h-0 sm:w-auto sm:py-1.5">
                {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save section'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
