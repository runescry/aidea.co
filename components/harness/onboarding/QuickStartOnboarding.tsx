'use client';

import { useState, useCallback, useEffect } from 'react';
import Nango from '@nangohq/frontend';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { Label, TextField, SelectField } from '../forms';

const STEPS = [
  { id: 'name', title: 'Your name', subtitle: 'How agents address you' },
  { id: 'role', title: 'Your title', subtitle: 'Work context at a glance' },
  { id: 'connections', title: 'Inbox & calendar', subtitle: 'Confirm the accounts for your first brief' },
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
  const [connections, setConnections] = useState<string[]>([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [connectionsConfirmed, setConnectionsConfirmed] = useState(false);
  const [connectingAccounts, setConnectingAccounts] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [data, setData] = useState<KnowledgeBase>({
    identity: {},
    work: {},
    preferences: { defaultAutonomyLevel: 'semi-autonomous' },
  });

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
  const missingConnections = ['google-mail', 'google-calendar'].filter(id => !connections.includes(id));
  const hasRequiredConnections = missingConnections.length === 0;

  const loadConnections = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(`/api/nango/connections?lite=1${refresh ? '&refresh=1' : ''}`);
      const body = res.ok ? await res.json() as { connections?: Array<{ integrationId?: string }> } : { connections: [] };
      setConnections((body.connections ?? []).map(connection => connection.integrationId ?? ''));
    } finally {
      setConnectionsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (current.id !== 'connections' || connectionsLoaded) return;
    void loadConnections();
  }, [connectionsLoaded, current.id, loadConnections]);

  const connectMissingAccounts = async () => {
    setConnectingAccounts(true);
    setConnectionError(null);
    try {
      const res = await fetch('/api/nango/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrations: missingConnections }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to start Google connection (${res.status})`);
      }
      const { sessionToken } = await res.json() as { sessionToken: string };
      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: event => {
          if (event.type === 'connect') {
            void loadConnections(true);
            setConnectingAccounts(false);
          }
          if (event.type === 'close') setConnectingAccounts(false);
        },
      });
      connect.setSessionToken(sessionToken);
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Failed to connect Google accounts');
      setConnectingAccounts(false);
    }
  };

  const canContinue = (): boolean => {
    if (current.id === 'name') return Boolean(data.identity?.name?.trim());
    if (current.id === 'role') return Boolean(data.work?.role?.trim() || data.identity?.role?.trim());
    if (current.id === 'connections') return connectionsLoaded && hasRequiredConnections && connectionsConfirmed;
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
                Four quick questions to get you running. You can fill in the full profile later from Context.
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
                <Label hint="Required">Title</Label>
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
                We&apos;ll use these accounts for your first Inbox triage and calendar brief.
              </p>
              <div className="card divide-y divide-border">
                <ConnectionRow label="Gmail inbox" connected={connections.includes('google-mail')} />
                <ConnectionRow label="Google Calendar" connected={connections.includes('google-calendar')} />
              </div>
              {connectionsLoaded && !hasRequiredConnections && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={connectMissingAccounts}
                    disabled={connectingAccounts}
                    className="btn-secondary w-full justify-center"
                  >
                    {connectingAccounts ? 'Connecting…' : 'Connect now'}
                  </button>
                  <p className="text-caption text-foreground-subtle">
                    Connect the missing account{missingConnections.length > 1 ? 's' : ''} before continuing.
                  </p>
                </div>
              )}
              {connectionError && <p role="alert" className="text-caption text-danger">{connectionError}</p>}
              <label className="flex items-start gap-3 text-sm text-foreground-muted">
                <input
                  type="checkbox"
                  checked={connectionsConfirmed}
                  onChange={event => setConnectionsConfirmed(event.target.checked)}
                  className="mt-0.5 accent-[rgb(var(--accent))]"
                />
                <span>I confirm aidea can use these accounts to prepare my first brief.</span>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-caption text-foreground-muted">
                Controls what runs automatically vs. what waits for your approval in Inbox.
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

function ConnectionRow({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-3 text-sm">
      <span className="text-foreground">{label}</span>
      <span className={connected ? 'text-success' : 'text-danger'}>{connected ? 'Connected' : 'Not connected'}</span>
    </div>
  );
}
