'use client';

import { useBuilderNav } from '@/hooks/useBuilderNav';
import { navItemsForMode, type MainView } from '@/lib/client/builder-nav';
import {
  IconAgents,
  IconBriefcase,
  IconContext,
  IconHome,
  IconSettings,
  IconStudio,
} from './sidebar/icons';

const NAV_META: Record<MainView, { label: string; Icon: typeof IconHome }> = {
  home: { label: 'Home', Icon: IconHome },
  inbox: { label: 'Inbox', Icon: IconBriefcase },
  agents: { label: 'Agents', Icon: IconAgents },
  studio: { label: 'Studio', Icon: IconStudio },
  profile: { label: 'Profile', Icon: IconContext },
  settings: { label: 'Settings', Icon: IconSettings },
};

interface Props {
  view: MainView;
  onNavigate: (view: MainView) => void;
  agentsRunning?: boolean;
  workPendingCount?: number;
}

export default function MobileBottomNav({ view, onNavigate, agentsRunning, workPendingCount = 0 }: Props) {
  const { builderNav } = useBuilderNav();
  const navIds = navItemsForMode(builderNav);

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-14">
        {navIds.map(id => {
          const { label, Icon } = NAV_META[id];
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0 px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/25 ${
                active ? 'text-foreground' : 'text-foreground-muted'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium truncate max-w-full">{label}</span>
              {id === 'inbox' && workPendingCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-20px)] flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-[9px] font-semibold text-surface tabular-nums">
                  {workPendingCount > 9 ? '9+' : workPendingCount}
                </span>
              )}
              {id === 'studio' && builderNav && agentsRunning && (
                <span className="absolute top-2 right-[calc(50%-18px)] w-2 h-2 rounded-full bg-accent animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
