'use client';

import { useState, useCallback } from 'react';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { Label, TextField, SelectField } from '../forms';

const STEPS = [
  { id: 'name', title: 'Your name', subtitle: 'How agents address you' },
  { id: 'role', title: 'Your role', subtitle: 'Work context at a glance' },
  { id: 'autonomy', title: 'Autonomy', subtitle: 'How much agents decide alone' },
] as const;

const AUTONOMY_OPTIONS = ['supervised', 'semi-autonomous', 'autonomous'] as const;

interface Props {
  onComplete: () => void;
  onFullProfile: () => void;
}

export default function QuickStartOnboarding({ onComplete, onFullProfile }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<KnowledgeBase>({
    identity: {},
    work: {},
    preferences: { defaultAutonomyLevel: 'semi-autonomous' },
  });

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  const canContinue = (): boolean => {
    if (current.id === 'name') return Boolean(data.identity?.name?.trim());
    if (current.id === 'role') return Boolean(data.work?.role?.trim() || data.identity?.role?.trim());
    return Boolean(data.preferences?.defaultAutonomyLevel);
  };

  const saveAndFinish = useCallback(async () => {
    setSaving(true);
    try {
      const role = data.work?.role?.trim() || data.identity?.role?.trim() || '';
      await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            identity: { ...data.identity, role: data.identity?.role?.trim() || role },
            work: { ...data.work, role },
            preferences: {
              ...data.preferences,
              onboardingComplete: true,
              onboardingMode: 'quick',
            },
          },
        }),
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [data, onComplete]);

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else saveAndFinish();
  };

  const firstName = data.identity?.name?.split(' ')[0] || 'there';

  return (
    <div className="fixed inset-0 z-50 bg-surface-muted flex flex-col">
      <div className="h-1 bg-surface-subtle shrink-0">
        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <header className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0 bg-surface">
        <div>
          <div className="text-display text-foreground">aidea</div>
          <div className="text-micro text-foreground-subtle">Quick start · Step {step + 1} of {STEPS.length}</div>
        </div>
        <div className="text-right">
          <div className="text-body font-medium text-foreground">{current.title}</div>
          <div className="text-caption text-foreground-muted">{current.subtitle}</div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-md mx-auto space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-body text-foreground-muted leading-relaxed">
                Three quick questions to get you running. You can fill in the full profile later from Context.
              </p>
              <div>
                <Label hint="Required">Your name</Label>
                <TextField
                  value={data.identity?.name ?? ''}
                  onChange={v => setData(d => ({ ...d, identity: { ...d.identity, name: v } }))}
                  placeholder="Alex Chen"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-caption text-foreground-muted">
                Agents use this to tailor briefs, drafts, and recommendations.
              </p>
              <div>
                <Label hint="Required">Role / title</Label>
                <TextField
                  value={data.work?.role ?? data.identity?.role ?? ''}
                  onChange={v => setData(d => ({
                    ...d,
                    work: { ...d.work, role: v },
                    identity: { ...d.identity, role: v },
                  }))}
                  placeholder="Founder & CEO"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-caption text-foreground-muted">
                Controls what runs automatically vs. what waits for your approval in Work.
              </p>
              <div>
                <Label>Default autonomy</Label>
                <SelectField
                  value={data.preferences?.defaultAutonomyLevel ?? 'semi-autonomous'}
                  onChange={v => setData(d => ({
                    ...d,
                    preferences: {
                      ...d.preferences,
                      defaultAutonomyLevel: v as NonNullable<KnowledgeBase['preferences']>['defaultAutonomyLevel'],
                    },
                  }))}
                  options={[...AUTONOMY_OPTIONS]}
                />
              </div>
              <div className="card p-3 text-caption text-foreground-muted space-y-1">
                <p><span className="font-medium text-foreground">Supervised</span> — agents queue most actions for approval.</p>
                <p><span className="font-medium text-foreground">Semi-autonomous</span> — low-risk tasks run; sensitive ones queue.</p>
                <p><span className="font-medium text-foreground">Autonomous</span> — agents act unless you intervene.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 flex items-center justify-between shrink-0 bg-surface">
        <button
          type="button"
          onClick={onFullProfile}
          className="text-caption text-foreground-muted hover:text-foreground transition-colors"
        >
          Full profile instead (~15 min)
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} className="btn-secondary">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={!canContinue() || saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : step === STEPS.length - 1 ? `Start, ${firstName}` : 'Continue'}
          </button>
        </div>
      </footer>
    </div>
  );
}
