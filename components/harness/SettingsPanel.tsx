'use client';

import { useState, useEffect, useCallback } from 'react';
import Nango from '@nangohq/frontend';
import type { SettingStatus } from '@/lib/settings';
import { Label, TextField, StatusDot } from './forms';
import AuditTrailPanel from './AuditTrailPanel';
import DomainAutonomyPanel from './DomainAutonomyPanel';
import HarnessCostPanel from './HarnessCostPanel';
import { useSaveFeedback } from '@/hooks/useSaveFeedback';
import { useConfirm } from '@/hooks/useConfirm';
import { clearCachedWorkFeed, useWorkFeed } from '@/hooks/useWorkFeed';
import { useChatConversations } from '@/hooks/useChatConversations';
import { clearOnboardingCache } from '@/lib/client/onboarding-cache';

type SettingKey = 'anthropicApiKey' | 'braveSearchApiKey';

interface NangoConnection {
  connectionId: string;
  integrationId: string;
  email?: string;
  displayName?: string;
  createdAt?: string;
}

const INTEGRATION_LABELS: Record<string, string> = {
  'google-mail': 'Gmail',
  'google-calendar': 'Calendar',
};

function connectionTitle(conn: NangoConnection): string {
  if (conn.email) return conn.email;
  if (conn.displayName) return conn.displayName;
  return conn.connectionId;
}

function connectionSubtitle(conn: NangoConnection): string {
  const label = INTEGRATION_LABELS[conn.integrationId] ?? conn.integrationId;
  if (conn.displayName && conn.email) return `${label} · ${conn.displayName}`;
  return label;
}

interface SettingField {
  key: SettingKey;
  label: string;
  description: string;
  placeholder: string;
  type?: string;
  link?: string;
}

const SETTING_FIELDS: SettingField[] = [
  {
    key: 'anthropicApiKey',
    label: 'Anthropic API key',
    description: 'Required for all agent runs and chat. Get one at console.anthropic.com.',
    placeholder: 'sk-ant-…',
    type: 'password',
    link: 'https://console.anthropic.com/settings/keys',
  },
  {
    key: 'braveSearchApiKey',
    label: 'Brave Search API key',
    description: 'Enables web search and news curation tools.',
    placeholder: 'BSA…',
    type: 'password',
    link: 'https://brave.com/search/api/',
  },
];

export default function SettingsPanel() {
  const confirm = useConfirm();
  const [status, setStatus] = useState<Record<SettingKey, SettingStatus> | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [values, setValues] = useState<Partial<Record<SettingKey, string>>>({});
  const { saving, saved, runSave } = useSaveFeedback();
  const { saving: resetting, saved: resetDone, runSave: runReset } = useSaveFeedback();
  const { saving: seeding, saved: seedDone, runSave: runSeed } = useSaveFeedback();
  const { saving: loggingOut, runSave: runLogout } = useSaveFeedback();
  const { refresh: refreshWorkFeed } = useWorkFeed();
  const { resetLocalChatStore } = useChatConversations();

  const [nangoConfigured, setNangoConfigured] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [connections, setConnections] = useState<NangoConnection[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [strava, setStrava] = useState<{
    configured: boolean;
    connected: boolean;
    athleteName?: string;
    lastSyncedAt?: string;
  } | null>(null);
  const [stravaBusy, setStravaBusy] = useState(false);
  const [stravaMessage, setStravaMessage] = useState<string | null>(null);

  const loadStrava = useCallback(async () => {
    const res = await fetch('/api/integrations/strava');
    if (!res.ok) return;
    setStrava(await res.json() as typeof strava);
  }, []);

  const loadConnections = useCallback(async () => {
    const res = await fetch('/api/nango/connections');
    if (!res.ok) return;
    const data = await res.json() as { configured: boolean; connections: NangoConnection[] };
    setNangoConfigured(data.configured);
    setConnections(data.connections ?? []);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json() as { status: Record<SettingKey, SettingStatus>; readOnly?: boolean };
      setStatus(data.status);
      setReadOnly(Boolean(data.readOnly));
    }
    await loadConnections();
    await loadStrava();
  }, [loadConnections, loadStrava]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('settings') !== 'strava') return;
    if (params.get('connected') === '1') setStravaMessage('Strava connected — activities synced to your health profile.');
    const err = params.get('error');
    if (err) setStravaMessage(`Strava connect failed: ${err.replace(/_/g, ' ')}`);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    await runSave(async () => {
      const payload: Partial<Record<SettingKey, string>> = {};
      for (const [key, value] of Object.entries(values) as Array<[SettingKey, string]>) {
        if (value?.trim()) payload[key] = value.trim();
      }
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setValues({});
      await load();
    });
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Log out of aidea?',
      message:
        'This clears the local app session on this browser and returns you to Log in / Sign up. '
        + 'Your saved profile, queue history, and connected Google accounts are not deleted.',
      confirmLabel: 'Log out',
    });
    if (!ok) return;

    await runLogout(async () => {
      await fetch('/api/auth/session', { method: 'DELETE' });
      resetLocalChatStore();
      clearCachedWorkFeed();
      clearOnboardingCache();
      window.location.assign('/');
    }).catch(() => undefined);
  };

  const handleConnectGoogle = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch('/api/nango/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        const message = err.error ?? `Failed to start Google connect (${res.status})`;
        setConnectError(message);
        return;
      }
      const { sessionToken } = await res.json() as { sessionToken: string };
      const nango = new Nango();
      const connect = nango.openConnectUI({
        onEvent: event => {
          if (event.type === 'connect') void loadConnections();
          if (event.type === 'close') setConnecting(false);
        },
      });
      connect.setSessionToken(sessionToken);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to start Google connect');
      setConnecting(false);
    }
  };

  const handleDisconnect = async (conn: NangoConnection) => {
    const ok = await confirm({
      title: `Disconnect ${connectionTitle(conn)}?`,
      message: 'Agents will no longer read or act on this account until you reconnect.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    await fetch(
      `/api/nango/connections?connectionId=${encodeURIComponent(conn.connectionId)}&integrationId=${encodeURIComponent(conn.integrationId)}`,
      { method: 'DELETE' },
    );
    await loadConnections();
  };

  const handleConnectStrava = () => {
    window.location.href = '/api/integrations/strava/authorize';
  };

  const handleDisconnectStrava = async () => {
    const ok = await confirm({
      title: 'Disconnect Strava?',
      message: 'Health activity sync from Strava will stop. Existing profile data is kept.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    setStravaBusy(true);
    setStravaMessage(null);
    await fetch('/api/integrations/strava', { method: 'DELETE' });
    await loadStrava();
    setStravaBusy(false);
  };

  const handleSyncStrava = async () => {
    setStravaBusy(true);
    setStravaMessage(null);
    const res = await fetch('/api/integrations/strava', { method: 'POST' });
    setStravaBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      setStravaMessage(err.error ?? 'Sync failed');
      return;
    }
    setStravaMessage('Activities synced to health profile.');
    await loadStrava();
  };

  const handleResetActivity = async () => {
    const ok = await confirm({
      title: 'Reset all activity history?',
      message:
        'Clears: action queue and approvals, audit trail, harness runs, chat history, and latest brief.\n\n'
        + 'Keeps: profile and knowledge base, API keys, and Google connections.',
      confirmLabel: 'Reset activity',
      destructive: true,
    });
    if (!ok) return;

    setResetError(null);
    await runReset(async () => {
      const res = await fetch('/api/reset', { method: 'POST' });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setResetError(body.error ?? `Reset failed (${res.status})`);
        throw new Error('reset failed');
      }
      resetLocalChatStore();
      clearCachedWorkFeed();
      clearOnboardingCache();
      window.location.assign('/');
    }).catch(() => undefined);
  };

  const handleSeedSampleData = async () => {
    setSeedError(null);
    await runSeed(async () => {
      const res = await fetch('/api/seed', { method: 'POST' });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setSeedError(body.error ?? `Seed failed (${res.status})`);
        throw new Error('seed failed');
      }
      resetLocalChatStore();
      clearCachedWorkFeed();
      await refreshWorkFeed();
    }).catch(() => undefined);
  };

  const configuredCount = status
    ? Object.values(status).filter(s => s.configured).length
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-foreground-muted mt-1">
            {readOnly
              ? 'Production deployment — keys are managed via Vercel Environment Variables. Status shown below is read-only.'
              : <>API keys are stored locally on your machine and never sent to the browser after saving.
                Environment variables in <code className="text-xs bg-surface-subtle px-1 rounded">.env.local</code> are used as fallback.</>}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:block sm:shrink-0 sm:text-right">
          <div className="text-xs text-foreground-subtle">{configuredCount}/{SETTING_FIELDS.length} configured</div>
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={saving || Object.keys(values).length === 0}
              className="btn-primary min-h-11 text-xs sm:mt-2 sm:min-h-0 sm:py-1.5"
            >
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save keys'}
            </button>
          )}
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Account</h3>
            <p className="text-xs text-foreground-muted mt-1">
              Log out on this browser to return to Log in / Sign up. This does not delete profile data
              or disconnect Google.
            </p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="btn-secondary min-h-11 w-full shrink-0 justify-center text-xs sm:min-h-0 sm:w-auto sm:py-1.5"
          >
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </div>

      <div className="card divide-y divide-border">
        {SETTING_FIELDS.map(field => {
          const fieldStatus = status?.[field.key];
          return (
            <div key={field.key} className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <StatusDot configured={fieldStatus?.configured ?? false} />
                <span className="text-sm font-medium text-foreground">{field.label}</span>
                {fieldStatus?.configured && fieldStatus.preview && (
                  <span className="ml-auto max-w-[45%] break-all text-right font-mono text-[11px] text-foreground-subtle">
                    {fieldStatus.preview}
                    {fieldStatus.source === 'env' && ' (env)'}
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-muted">{field.description}</p>
              {field.link && (
                <a
                  href={field.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  Get credentials →
                </a>
              )}
              <Label>{fieldStatus?.configured ? 'Update key' : 'Enter key'}</Label>
              <TextField
                type={field.type ?? 'text'}
                value={values[field.key] ?? ''}
                onChange={v => setValues(prev => ({ ...prev, [field.key]: v }))}
                placeholder={fieldStatus?.configured ? 'Leave blank to keep current' : field.placeholder}
                disabled={readOnly}
              />
            </div>
          );
        })}
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Google (Gmail &amp; Calendar)</h3>
            <p className="text-xs text-foreground-muted mt-1">
              Connect via Nango — the same Google sign-in flow you use for other apps.
              Connect each account separately (personal, work, etc.).
            </p>
          </div>
          <button
            onClick={handleConnectGoogle}
            disabled={connecting || !nangoConfigured}
            className="btn-primary min-h-11 w-full shrink-0 justify-center text-xs sm:min-h-0 sm:w-auto sm:py-1.5"
          >
            {connecting ? 'Connecting…' : 'Connect Google'}
          </button>
        </div>

        {!nangoConfigured && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            NANGO_SECRET_KEY is missing or empty — copy the secret from Nango → Environment Settings,
            add it to .env.local (dev) or Vercel env vars (production), then restart the dev server.
          </p>
        )}

        {connectError && (
          <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {connectError}
          </p>
        )}

        {nangoConfigured && (
          <p className="break-words font-mono text-[11px] text-foreground-subtle">
            Nango integrations: google-mail, google-calendar. Gmail drafts/send need scope{' '}
            <span className="text-foreground-muted">gmail.compose</span> — add in Nango, then reconnect.
          </p>
        )}

        {connections.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {connections.map(conn => (
              <li key={conn.connectionId} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3 text-sm sm:flex sm:py-2">
                <StatusDot configured />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{connectionTitle(conn)}</div>
                  <div className="text-[11px] text-foreground-subtle">{connectionSubtitle(conn)}</div>
                </div>
                <button
                  onClick={() => handleDisconnect(conn)}
                  className="col-start-2 min-h-10 justify-self-start text-xs text-foreground-muted hover:text-red-500 sm:min-h-0 sm:shrink-0"
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        ) : nangoConfigured ? (
          <p className="text-xs text-foreground-muted">No Google accounts connected yet.</p>
        ) : null}
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Strava (health sync)</h3>
            <p className="text-xs text-foreground-muted mt-1">
              Connect Strava to pull recent activities into your health profile for agents and Context.
            </p>
          </div>
          {!strava?.connected && (
            <button
              onClick={handleConnectStrava}
              disabled={stravaBusy || strava?.configured === false}
              className="btn-primary min-h-11 w-full shrink-0 justify-center text-xs sm:min-h-0 sm:w-auto sm:py-1.5"
            >
              Connect Strava
            </button>
          )}
        </div>

        {strava?.configured === false && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET are missing — add them to .env.local (dev) or Vercel env vars.
          </p>
        )}

        {stravaMessage && (
          <p className="text-xs text-foreground-muted whitespace-pre-wrap">{stravaMessage}</p>
        )}

        {strava?.connected ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-md border border-border px-3 py-3 text-sm sm:flex sm:py-2">
            <StatusDot configured />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{strava.athleteName ?? 'Strava athlete'}</div>
              <div className="text-[11px] text-foreground-subtle">
                {strava.lastSyncedAt ? `Last sync ${strava.lastSyncedAt.slice(0, 16).replace('T', ' ')} UTC` : 'Not synced yet'}
              </div>
            </div>
            <button onClick={handleSyncStrava} disabled={stravaBusy} className="col-start-2 min-h-10 justify-self-start text-xs text-accent hover:underline sm:min-h-0 sm:shrink-0">
              {stravaBusy ? 'Syncing…' : 'Sync now'}
            </button>
            <button onClick={handleDisconnectStrava} disabled={stravaBusy} className="col-start-2 min-h-10 justify-self-start text-xs text-foreground-muted hover:text-red-500 sm:min-h-0 sm:shrink-0">
              Disconnect
            </button>
          </div>
        ) : strava?.configured ? (
          <p className="text-xs text-foreground-muted">No Strava account connected yet.</p>
        ) : null}
      </div>

      <DomainAutonomyPanel />

      <HarnessCostPanel />

      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Queue activity</h3>
        <AuditTrailPanel />
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Sample data</h3>
            <p className="text-xs text-foreground-muted mt-1">
              Clear activity and load realistic demo data — useful for demos without live integrations.
            </p>
          </div>
          <button
            onClick={handleSeedSampleData}
            disabled={seeding}
            className="btn-secondary min-h-11 w-full shrink-0 justify-center text-xs sm:min-h-0 sm:w-auto sm:py-1.5"
          >
            {seedDone ? 'Loaded ✓' : seeding ? 'Loading…' : 'Load sample data'}
          </button>
        </div>
        {seedError && (
          <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {seedError}
          </p>
        )}
      </div>

      <div className="card border-danger/30 p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">Danger zone</h3>
            <p className="text-xs text-foreground-muted mt-1">
              Reset activity history clears the action queue and pending approvals, audit trail,
              harness runs, chat history, and latest brief. Your profile, knowledge base, API keys,
              and Google connections are preserved.
            </p>
          </div>
          <button
            onClick={handleResetActivity}
            disabled={resetting}
            className="btn-secondary min-h-11 w-full shrink-0 justify-center border-danger/30 text-xs text-danger hover:text-danger sm:min-h-0 sm:w-auto sm:py-1.5"
          >
            {resetDone ? 'Reset ✓' : resetting ? 'Resetting…' : 'Reset activity history'}
          </button>
        </div>

        {resetError && (
          <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {resetError}
          </p>
        )}
      </div>
    </div>
  );
}
