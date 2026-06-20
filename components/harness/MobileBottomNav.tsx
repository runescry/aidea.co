'use client';

import type { MainView } from './AppSidebar';
import {
  IconAgents,
  IconContext,
  IconHome,
  IconSettings,
  IconStudio,
} from './sidebar/icons';

const NAV: Array<{
  id: MainView;
  label: string;
  Icon: typeof IconHome;
}> = [
  { id: 'home', label: 'Home', Icon: IconHome },
  { id: 'agents', label: 'Agents', Icon: IconAgents },
  { id: 'studio', label: 'Studio', Icon: IconStudio },
  { id: 'context', label: 'Context', Icon: IconContext },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
];

interface Props {
  view: MainView;
  onNavigate: (view: MainView) => void;
  agentsRunning?: boolean;
  workPendingCount?: number;
}

export default function MobileBottomNav({ view, onNavigate, agentsRunning, workPendingCount = 0 }: Props) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-14">
        {NAV.map(({ id, label, Icon }) => {
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
              {id === 'home' && workPendingCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-20px)] flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-[9px] font-semibold text-surface tabular-nums">
                  {workPendingCount > 9 ? '9+' : workPendingCount}
                </span>
              )}
              {id === 'studio' && agentsRunning && (
                <span className="absolute top-2 right-[calc(50%-18px)] w-2 h-2 rounded-full bg-accent animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
