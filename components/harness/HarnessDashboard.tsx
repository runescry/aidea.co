'use client';

import { useState, useEffect } from 'react';
import { useHarnessSession } from '@/hooks/useHarnessSession';
import HomeScreen from './home/HomeScreen';
import RunStudio from './RunStudio';
import KnowledgeBaseEditor from './KnowledgeBaseEditor';
import SettingsPanel from './SettingsPanel';
import AgentLibrary from './AgentLibrary';
import OnboardingWizard from './onboarding/OnboardingWizard';
import HumanInputOverlay from './HumanInputOverlay';

type MainView = 'home' | 'agents' | 'studio' | 'context' | 'settings';

const NAV: Array<{ id: MainView; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'agents', label: 'Agents' },
  { id: 'studio', label: 'Studio' },
  { id: 'context', label: 'Context' },
  { id: 'settings', label: 'Settings' },
];

export default function HarnessDashboard() {
  const { state, startSession, reset, clearPendingInput } = useHarnessSession();
  const [view, setView] = useState<MainView>('home');
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(d => setShowOnboarding(!d.complete))
      .catch(() => setShowOnboarding(false));
  }, []);

  const activeAgents = Object.values(state.agents).filter(a => a.status === 'running').length;

  if (showOnboarding === null) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <div className="text-sm text-foreground-muted">Loading…</div>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="h-screen bg-surface-muted text-foreground flex flex-col overflow-hidden">
      <HumanInputOverlay
        pending={state.pendingInput ?? null}
        onSubmit={(_requestId, _answer) => {
          clearPendingInput();
          setTaskRefreshKey(k => k + 1);
        }}
      />

      <header className="shrink-0 border-b border-border bg-surface px-5 h-12 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">aidea</span>
          <nav className="flex items-center gap-1">
            {NAV.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id);
                  if (item.id === 'context') setTaskRefreshKey(k => k + 1);
                }}
                className={`px-3 py-1.5 rounded-md text-[13px] transition-colors ${
                  view === item.id
                    ? 'text-foreground font-medium bg-surface-subtle'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        {state.status === 'running' && view !== 'studio' && (
          <button
            type="button"
            onClick={() => setView('studio')}
            className="flex items-center gap-2 text-[12px] text-accent hover:text-foreground transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Agents running
          </button>
        )}
      </header>

      {view === 'home' && (
        <HomeScreen
          session={{
            status: state.status,
            entityType: state.entityType,
            activeAgents,
          }}
          onOpenStudio={() => setView('studio')}
          taskRefreshKey={taskRefreshKey}
          onTaskRefresh={() => setTaskRefreshKey(k => k + 1)}
        />
      )}

      {view === 'agents' && <AgentLibrary />}

      {view === 'studio' && (
        <RunStudio state={state} startSession={startSession} reset={reset} />
      )}

      {view === 'context' && (
        <div className="flex-1 overflow-y-auto p-6">
          <KnowledgeBaseEditor refreshKey={taskRefreshKey} onRestartOnboarding={() => setShowOnboarding(true)} />
        </div>
      )}

      {view === 'settings' && (
        <div className="flex-1 overflow-y-auto p-6">
          <SettingsPanel />
        </div>
      )}
    </div>
  );
}
