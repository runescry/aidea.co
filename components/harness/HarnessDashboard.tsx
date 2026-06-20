'use client';

import { useState, useEffect } from 'react';
import { useHarnessSession } from '@/hooks/useHarnessSession';
import { ChatProvider } from '@/hooks/useChatConversations';
import AppSidebar, { type MainView } from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import ConversationDrawer from './sidebar/ConversationDrawer';
import HomeScreen from './home/HomeScreen';
import RunStudio from './RunStudio';
import KnowledgeBaseEditor from './KnowledgeBaseEditor';
import SettingsPanel from './SettingsPanel';
import AgentLibrary from './AgentLibrary';
import OnboardingWizard from './onboarding/OnboardingWizard';
import HumanInputOverlay from './HumanInputOverlay';

export default function HarnessDashboard() {
  const { state, startSession, reset, clearPendingInput } = useHarnessSession();
  const [view, setView] = useState<MainView>('home');
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(d => setShowOnboarding(!d.complete))
      .catch(() => setShowOnboarding(false));
  }, []);

  const activeAgents = Object.values(state.agents).filter(a => a.status === 'running').length;
  const agentsRunning = state.status === 'running';

  const navigate = (next: MainView) => {
    setView(next);
    setChatDrawerOpen(false);
    if (next === 'context') setTaskRefreshKey(k => k + 1);
  };

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
    <ChatProvider>
      <div className="h-[100dvh] bg-surface-muted text-foreground flex overflow-hidden">
        <HumanInputOverlay
          pending={state.pendingInput ?? null}
          onSubmit={(_requestId, _answer) => {
            clearPendingInput();
            setTaskRefreshKey(k => k + 1);
          }}
        />

        <AppSidebar
          view={view}
          onNavigate={navigate}
          agentsRunning={agentsRunning}
          onOpenStudio={() => setView('studio')}
        />

        <ConversationDrawer
          open={chatDrawerOpen && view === 'home'}
          onClose={() => setChatDrawerOpen(false)}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {view === 'home' && (
            <HomeScreen
              session={{
                status: state.status,
                entityType: state.entityType,
                activeAgents,
              }}
              onOpenStudio={() => setView('studio')}
              onOpenChats={() => setChatDrawerOpen(true)}
              taskRefreshKey={taskRefreshKey}
              onTaskRefresh={() => setTaskRefreshKey(k => k + 1)}
            />
          )}

          {view === 'agents' && <AgentLibrary />}

          {view === 'studio' && (
            <RunStudio state={state} startSession={startSession} reset={reset} />
          )}

          {view === 'context' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <KnowledgeBaseEditor
                refreshKey={taskRefreshKey}
                onRestartOnboarding={() => setShowOnboarding(true)}
              />
            </div>
          )}

          {view === 'settings' && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <SettingsPanel />
            </div>
          )}
        </main>

        <MobileBottomNav
          view={view}
          onNavigate={navigate}
          agentsRunning={agentsRunning}
        />
      </div>
    </ChatProvider>
  );
}
