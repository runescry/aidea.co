'use client';

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import { useHarnessSession } from '@/hooks/useHarnessSession';
import { ChatProvider, useChatConversations } from '@/hooks/useChatConversations';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { WorkFeedProvider, useWorkFeed } from '@/hooks/useWorkFeed';
import { readOnboardingCache, writeOnboardingCache, fetchOnboardingComplete, fetchSessionAuthenticated } from '@/lib/client/onboarding-cache';
import AppSidebar, { type MainView } from './AppSidebar';
import MobileBottomNav from './MobileBottomNav';
import ConversationDrawer from './sidebar/ConversationDrawer';
import HomeScreen from './home/HomeScreen';
import TaskFeed from './home/TaskFeed';
import RunStudio from './RunStudio';
import ProfilePage from './ProfilePage';
import SettingsPanel from './SettingsPanel';
import AgentLibrary from './AgentLibrary';
import OnboardingWizard from './onboarding/OnboardingWizard';
import QuickStartOnboarding from './onboarding/QuickStartOnboarding';
import HumanInputOverlay from './HumanInputOverlay';
import { useBuilderNav } from '@/hooks/useBuilderNav';
import { isBuilderView } from '@/lib/client/builder-nav';
import WelcomeScreen from './WelcomeScreen';
import type { SchoolFeed } from '@/types/knowledge-base';

interface HarnessDashboardProps {
  /** Server-streamed school feed for Home (PPR dynamic segment). */
  initialSchoolFeed?: SchoolFeed | null;
  /** True while the PPR Suspense boundary for school feed is unresolved. */
  homeFeedPending?: boolean;
}

export default function HarnessDashboard({
  initialSchoolFeed = null,
  homeFeedPending = false,
}: HarnessDashboardProps) {
  // Both start matching the server render (no localStorage there) — corrected from the cache
  // synchronously on mount, before the /api/onboarding fetch resolves. A returning visitor
  // (any non-null cache) would otherwise mismatch the server's WelcomeScreen render.
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingMode, setOnboardingMode] = useState<'quick' | 'full'>('quick');

  useEffect(() => {
    const cached = readOnboardingCache();
    if (cached !== null) {
      setShowWelcome(false);
      setShowOnboarding(cached === false);
    }

    void (async () => {
      const authenticated = await fetchSessionAuthenticated();
      // No session and no cache → stay on Welcome (first visit or after logout).
      if (readOnboardingCache() === null && !authenticated) return;

      const complete = await fetchOnboardingComplete();
      if (complete === null) {
        if (authenticated && readOnboardingCache() === null) {
          setShowWelcome(false);
          setShowOnboarding(false);
        }
        return;
      }

      writeOnboardingCache(complete);
      setShowWelcome(false);
      setShowOnboarding(!complete);
    })();
  }, []);

  const handleGoogleConnected = useCallback(async () => {
    setShowWelcome(false);
    const complete = await fetchOnboardingComplete();
    if (complete === null) {
      setShowOnboarding(true);
      return;
    }
    writeOnboardingCache(complete);
    setShowOnboarding(!complete);
  }, []);

  if (showWelcome) {
    return (
      <WelcomeScreen
        onGoogleConnected={handleGoogleConnected}
        onDemoReady={() => {
          setShowWelcome(false);
          setShowOnboarding(false);
        }}
      />
    );
  }

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
    <ConfirmProvider>
      <ChatProvider>
        <DashboardBody
          setShowOnboarding={setShowOnboarding}
          setOnboardingMode={setOnboardingMode}
          initialSchoolFeed={initialSchoolFeed}
          homeFeedPending={homeFeedPending}
        />
      </ChatProvider>
    </ConfirmProvider>
  );
}

function DashboardBody({
  setShowOnboarding,
  setOnboardingMode,
  initialSchoolFeed,
  homeFeedPending,
}: {
  setShowOnboarding: (v: boolean) => void;
  setOnboardingMode: (m: 'quick' | 'full') => void;
  initialSchoolFeed: SchoolFeed | null;
  homeFeedPending: boolean;
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
      inboxActive={view === 'inbox'}
      profileActive={view === 'profile'}
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
        initialSchoolFeed={initialSchoolFeed}
        homeFeedPending={homeFeedPending}
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
  initialSchoolFeed,
  homeFeedPending,
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
  initialSchoolFeed: SchoolFeed | null;
  homeFeedPending: boolean;
}) {
  const { needsYou, refresh: refreshWorkFeed } = useWorkFeed();
  const { builderNav } = useBuilderNav();
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [homeChatPrefill, setHomeChatPrefill] = useState<string | null>(null);

  const activeAgents = Object.values(state.agents).filter(a => a.status === 'running').length;
  const agentsRunning = state.status === 'running' || state.status === 'starting';
  const humanInputPending = chatPendingInput ?? state.pendingInput;

  const bumpWorkFeed = useCallback(() => {
    setTaskRefreshKey(k => k + 1);
    void refreshWorkFeed();
  }, [refreshWorkFeed, setTaskRefreshKey]);

  const navigate = (next: MainView) => {
    if (!builderNav && isBuilderView(next)) return;
    setView(next);
    setChatDrawerOpen(false);
    if (next === 'profile') setTaskRefreshKey(k => k + 1);
  };

  useEffect(() => {
    if (!builderNav && isBuilderView(view)) {
      setView('home');
    }
  }, [builderNav, view, setView]);

  const openChatWithDraft = useCallback((draft: string) => {
    setHomeChatPrefill(draft);
    setView('home');
    setChatDrawerOpen(false);
  }, [setView]);

  const inboxInitialFilter = needsYou > 0 ? 'approval' as const : 'all' as const;

  const taskFeedProps = {
    session: {
      status: state.status,
      entityType: state.entityType,
      entityId: state.entityId,
      activeAgents,
    },
    onOpenStudio: builderNav ? () => setView('studio') : undefined,
    onDiscussInChat: openChatWithDraft,
    onTasksChanged: bumpWorkFeed,
    humanInputPending,
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
        onOpenStudio={builderNav ? () => setView('studio') : undefined}
        workPendingCount={needsYou}
      />

      <ConversationDrawer
        open={chatDrawerOpen && view === 'home'}
        onClose={() => setChatDrawerOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 min-h-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {view === 'home' && (
          <HomeScreen
            initialFeed={initialSchoolFeed}
            feedPending={homeFeedPending}
            onOpenSettings={() => setView('settings')}
            onOpenChats={() => setChatDrawerOpen(true)}
            onOpenInbox={() => setView('inbox')}
            onStartRun={builderNav ? (entityType, input) => {
              startSession(entityType, input);
              bumpWorkFeed();
            } : undefined}
            runInProgress={agentsRunning}
            onTaskRefresh={bumpWorkFeed}
            chatPrefill={homeChatPrefill}
            onChatPrefillApplied={() => setHomeChatPrefill(null)}
          />
        )}

        {view === 'inbox' && (
          <TaskFeed
            key={`inbox-${inboxInitialFilter}`}
            {...taskFeedProps}
            initialFilter={inboxInitialFilter}
          />
        )}

        {view === 'agents' && builderNav && <AgentLibrary />}

        {view === 'studio' && builderNav && (
          <RunStudio state={state} startSession={startSession} reset={reset} />
        )}

        {view === 'profile' && (
          <ProfilePage
            refreshKey={taskRefreshKey}
            onOpenChat={openChatWithDraft}
            onRestartOnboarding={() => {
              setOnboardingMode('full');
              setShowOnboarding(true);
            }}
          />
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
