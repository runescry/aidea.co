'use client';

import { useEffect, useState } from 'react';
import Nango from '@nangohq/frontend';

interface Props {
  onConnected: () => void | Promise<void>;
}

async function finishGoogleConnect(onConnected: () => void | Promise<void>) {
  const completeRes = await fetch('/api/auth/google/complete', { method: 'POST' });
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Unable to finish Google account setup');
  }
  await onConnected();
}

export default function GoogleConnectScreen({ onConnected }: Props) {
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch('/api/nango/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? `Failed to start Google connection (${res.status})`);
        }

        const { sessionToken } = await res.json() as { sessionToken: string };
        const nango = new Nango();
        const connect = nango.openConnectUI({
          onEvent: async event => {
            if (event.type === 'connect') {
              try {
                if (!cancelled) setConnecting(false);
                await finishGoogleConnect(onConnected);
              } catch (err) {
                if (!cancelled) {
                  setError(err instanceof Error ? err.message : 'Unable to finish Google account setup');
                  setConnecting(false);
                }
              }
            }
            if (event.type === 'close' && !cancelled) setConnecting(false);
          },
        });
        connect.setSessionToken(sessionToken);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to start Google connection');
          setConnecting(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [onConnected]);

  return (
    <main className="min-h-[100dvh] bg-surface-muted px-6 py-10 text-foreground flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <div className="mb-6">
          <div className="text-display text-foreground">aidea</div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Connect Gmail & Calendar</h1>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">
            Your Google account is signed in. Link Gmail and Calendar once for this account — you won&apos;t need to repeat this on other devices.
          </p>
        </div>

        {connecting && (
          <p className="text-sm text-foreground-muted">Opening Google connection…</p>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </section>
    </main>
  );
}
