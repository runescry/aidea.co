'use client';

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import { useHarnessSession } from '@/hooks/useHarnessSession';
import { ChatProvider, useChatConversations } from '@/hooks/useChatConversations';
import { WorkFeedProvider, useWorkFeed } from '@/hooks/useWorkFeed';
import { readOnboardingCache, writeOnboardingCache } from '@/lib/client/onboarding-cache';
import AppSidebar, { type MainView } from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import ConversationDrawer from './sidebar/ConversationDrawer';
import HomeScreen from './home/HomeScreen';
import RunStudio from './RunStudio';
import KnowledgeBaseEditor from './KnowledgeBaseEditor';
import SettingsPanel from './SettingsPanel';
import AgentLibrary from './AgentLibrary';
import OnboardingWizard from './onboarding/OnboardingWizard';
import QuickStartOnboarding from './onboarding/QuickStartOnboarding';
import HumanInputOverlay from './HumanInputOverlay';

export default function HarnessDashboard() {
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    const cached = readOnboardingCache();
    return cached === false;
  });
  const [onboardingMode, setOnboardingMode] = useState<'quick' | 'full'>('quick');

  useEffect(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(d => {
        writeOnboardingCache(Boolean(d.complete));
        setShowOnboarding(!d.complete);
      })
      .catch(() => {
        if (readOnboardingCache() === null) {
          writeOnboardingCache(true);
          setShowOnboarding(false);
        }
      });
  }, []);

  if (showOnboarding) {
    if (onboardingMode === 'full') {
      return (
        <OnboardingWizard
          onComplete={() => {
            writeOnboardingCache(true);
            setShowOnboarding(false);
            setOnboardingMode('quick');
          }}
        />
      );
    }
    return (
      <QuickStartOnboarding
        onComplete={() => {
          writeOnboardingCache(true);
          setShowOnboarding(false);
        }}
        onFullProfile={() => setOnboardingMode('full')}
      />
    );
  }

  return (
    <ChatProvider>
      <DashboardBody
        setShowOnboarding={setShowOnboarding}
        setOnboardingMode={setOnboardingMode}
      />
    </ChatProvider>
  );
}

function DashboardBody({
  setShowOnboarding,
  setOnboardingMode,
}: {
  setShowOnboarding: (v: boolean) => void;
  setOnboardingMode: (m: 'quick' | 'full') => void;
}) {
  const { state, startSession, reset, clearPendingInput } = useHarnessSession();
  const {
    streaming: chatStreaming,
    pendingInput: chatPendingInput,
    clearPendingInput: clearChatPendingInput,
  } = useChatConversations();
  const [view, setView] = useState<MainView>('home');
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  const agentsRunning = state.status === 'running' || state.status === 'starting';

  return (
    <WorkFeedProvider
      homeActive={view === 'home'}
      agentsRunning={agentsRunning}
      chatStreaming={chatStreaming}
      refreshKey={taskRefreshKey}
    >
      <DashboardChrome
        view={view}
        setView={setView}
        taskRefreshKey={taskRefreshKey}
        setTaskRefreshKey={setTaskRefreshKey}
        state={state}
        startSession={startSession}
        reset={reset}
        clearPendingInput={clearPendingInput}
        chatPendingInput={chatPendingInput}
        clearChatPendingInput={clearChatPendingInput}
        setShowOnboarding={setShowOnboarding}
        setOnboardingMode={setOnboardingMode}
      />
    </WorkFeedProvider>
  );
}

function DashboardChrome({
  view,
  setView,
  taskRefreshKey,
  setTaskRefreshKey,
  state,
  startSession,
  reset,
  clearPendingInput,
  chatPendingInput,
  clearChatPendingInput,
  setShowOnboarding,
  setOnboardingMode,
}: {
  view: MainView;
  setView: (v: MainView) => void;
  taskRefreshKey: number;
  setTaskRefreshKey: Dispatch<SetStateAction<number>>;
  state: ReturnType<typeof useHarnessSession>['state'];
  startSession: ReturnType<typeof useHarnessSession>['startSession'];
  reset: ReturnType<typeof useHarnessSession>['reset'];
  clearPendingInput: ReturnType<typeof useHarnessSession>['clearPendingInput'];
  chatPendingInput: ReturnType<typeof useChatConversations>['pendingInput'];
  clearChatPendingInput: ReturnType<typeof useChatConversations>['clearPendingInput'];
  setShowOnboarding: (v: boolean) => void;
  setOnboardingMode: (m: 'quick' | 'full') => void;
}) {
  const { needsYou, refresh: refreshWorkFeed } = useWorkFeed();
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

  const activeAgents = Object.values(state.agents).filter(a => a.status === 'running').length;
  const agentsRunning = state.status === 'running' || state.status === 'starting';
  const humanInputPending = chatPendingInput ?? state.pendingInput;

  const bumpWorkFeed = useCallback(() => {
    setTaskRefreshKey(k => k + 1);
    void refreshWorkFeed();
  }, [refreshWorkFeed, setTaskRefreshKey]);

  const navigate = (next: MainView) => {
    setView(next);
    setChatDrawerOpen(false);
    if (next === 'context') setTaskRefreshKey(k => k + 1);
  };

  return (
    <div className="h-[100dvh] bg-surface-muted text-foreground flex overflow-hidden">
      <HumanInputOverlay
        pending={humanInputPending}
        onSubmit={() => {
          clearPendingInput();
          clearChatPendingInput();
          bumpWorkFeed();
        }}
      />

      <AppSidebar
        view={view}
        onNavigate={navigate}
        agentsRunning={agentsRunning}
        onOpenStudio={() => setView('studio')}
        workPendingCount={needsYou}
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
              entityId: state.entityId,
              activeAgents,
            }}
            onOpenStudio={() => setView('studio')}
            onOpenSettings={() => setView('settings')}
            onOpenChats={() => setChatDrawerOpen(true)}
            onStartRun={(entityType, input) => {
              startSession(entityType, input);
              bumpWorkFeed();
            }}
            runInProgress={agentsRunning}
            onTaskRefresh={bumpWorkFeed}
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
              onRestartOnboarding={() => {
                setOnboardingMode('full');
                setShowOnboarding(true);
              }}
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
        workPendingCount={needsYou}
      />
    </div>
  );
}
