'use client';

import { useState } from 'react';

interface Props {
  onSignedIn: () => void | Promise<void>;
  initialError?: string | null;
}

export default function WelcomeScreen({ onSignedIn, initialError = null }: Props) {
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const connectGoogle = () => {
    setError(null);
    window.location.assign('/api/auth/google/authorize');
  };

  const useDemo = async () => {
    setLoadingDemo(true);
    setError(null);
    try {
      const authRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'demo' }),
      });
      if (!authRes.ok) throw new Error('Failed to start demo session');

      const res = await fetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeProfile: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to load demo (${res.status})`);
      }
      await onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-surface-muted px-6 py-10 text-foreground flex items-center justify-center">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-sm">
        <div className="mb-8">
          <div className="text-display text-foreground">aidea</div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Log in or sign up</h1>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">
            Sign in with Google. If this account already has Gmail and Calendar linked, you&apos;ll go straight in — on any device.
          </p>
        </div>

        <button type="button" className="btn-primary w-full justify-center" onClick={connectGoogle} disabled={loadingDemo}>
          <span className="mr-2 font-semibold" aria-hidden="true">G</span>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-foreground-subtle">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <button type="button" className="btn-secondary w-full justify-center" onClick={useDemo} disabled={loadingDemo}>
          {loadingDemo ? 'Loading demo…' : 'Use Demo Login'}
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-foreground-subtle">
          Loads a sample profile, Inbox approvals, and a morning brief. No Google account is connected.
        </p>

        {error && <p role="alert" className="mt-5 text-sm text-danger">{error}</p>}
      </section>
    </main>
  );
}
