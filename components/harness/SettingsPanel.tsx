'use client';

import { useState, useEffect, useCallback } from 'react';
import Nango from '@nangohq/frontend';
import type { SettingStatus } from '@/lib/settings';
import { Label, TextField, StatusDot } from './forms';
import { useSaveFeedback } from '@/hooks/useSaveFeedback';

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
  const [status, setStatus] = useState<Record<SettingKey, SettingStatus> | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [values, setValues] = useState<Partial<Record<SettingKey, string>>>({});
  const { saving, saved, runSave } = useSaveFeedback();

  const [nangoConfigured, setNangoConfigured] = useState(false);
  const [connections, setConnections] = useState<NangoConnection[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

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
  }, [loadConnections]);

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
    if (!confirm(`Disconnect ${connectionTitle(conn)}?`)) return;
    await fetch(
      `/api/nango/connections?connectionId=${encodeURIComponent(conn.connectionId)}&integrationId=${encodeURIComponent(conn.integrationId)}`,
      { method: 'DELETE' },
    );
    await loadConnections();
  };

  const configuredCount = status
    ? Object.values(status).filter(s => s.configured).length
    : 0;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-foreground-muted mt-1">
            {readOnly
              ? 'Production deployment — keys are managed via Vercel Environment Variables. Status shown below is read-only.'
              : <>API keys are stored locally on your machine and never sent to the browser after saving.
                Environment variables in <code className="text-xs bg-surface-subtle px-1 rounded">.env.local</code> are used as fallback.</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-foreground-subtle">{configuredCount}/{SETTING_FIELDS.length} configured</div>
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={saving || Object.keys(values).length === 0}
              className="btn-primary mt-2 text-xs py-1.5"
            >
              {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save keys'}
            </button>
          )}
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
                  <span className="text-[11px] font-mono text-foreground-subtle ml-auto">
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
        <div className="flex items-start justify-between gap-4">
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
            className="btn-primary text-xs py-1.5 shrink-0"
          >
            {connecting ? 'Connecting…' : 'Connect Google'}
          </button>
        </div>

        {!nangoConfigured && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            NANGO_SECRET_KEY is not set — add it in Vercel env vars (or .env.local for dev).
          </p>
        )}

        {connectError && (
          <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {connectError}
          </p>
        )}

        {nangoConfigured && (
          <p className="text-[11px] text-foreground-subtle font-mono">
            Nango integrations: google-mail, google-calendar. Gmail drafts/send need scope{' '}
            <span className="text-foreground-muted">gmail.compose</span> — add in Nango, then reconnect.
          </p>
        )}

        {connections.length > 0 ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {connections.map(conn => (
              <li key={conn.connectionId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <StatusDot configured />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{connectionTitle(conn)}</div>
                  <div className="text-[11px] text-foreground-subtle">{connectionSubtitle(conn)}</div>
                </div>
                <button
                  onClick={() => handleDisconnect(conn)}
                  className="text-xs text-foreground-muted hover:text-red-500"
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
    </div>
  );
}
