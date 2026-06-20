'use client';

import { useEffect, useState } from 'react';
import { useChatConversations } from '@/hooks/useChatConversations';
import ConversationList from './sidebar/ConversationList';
import {
  IconAgents,
  IconContext,
  IconHome,
  IconPanelLeft,
  IconPlus,
  IconSettings,
  IconStudio,
} from './sidebar/icons';

export type MainView = 'home' | 'agents' | 'studio' | 'context' | 'settings';

const STORAGE_KEY = 'aidea-sidebar-expanded';

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
  onOpenStudio?: () => void;
}

export default function AppSidebar({ view, onNavigate, agentsRunning, onOpenStudio }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { createConversation, streaming } = useChatConversations();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setExpanded(stored === 'true');
    } catch {
      // ignore
    }
  }, []);

  const toggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const showConversations = expanded && view === 'home';

  return (
    <aside
      className={`hidden md:flex shrink-0 flex-col h-full border-r border-border bg-surface transition-[width] duration-200 ease-out ${
        expanded ? 'w-60' : 'w-14'
      }`}
    >
      <div className={`shrink-0 flex items-center h-12 border-b border-border ${expanded ? 'px-3 justify-between' : 'justify-center'}`}>
        {expanded ? (
          <span className="text-[15px] font-semibold tracking-tight text-foreground truncate">aidea</span>
        ) : (
          <span className="text-[13px] font-semibold text-foreground" title="aidea">a</span>
        )}
        {expanded && (
          <button
            type="button"
            onClick={toggleExpanded}
            className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <IconPanelLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="shrink-0 p-2 space-y-0.5">
        {NAV.map(({ id, label, Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              title={!expanded ? label : undefined}
              className={`relative w-full flex items-center gap-3 rounded-lg transition-colors ${
                expanded ? 'px-2.5 py-2' : 'p-2.5 justify-center'
              } ${
                active
                  ? 'bg-surface-subtle text-foreground font-medium'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle/70'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {expanded && <span className="text-[13px] truncate">{label}</span>}
              {!expanded && id === 'studio' && agentsRunning && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {showConversations ? (
        <div className="flex-1 min-h-0 flex flex-col border-t border-border mt-1">
          <div className="shrink-0 p-2">
            <button
              type="button"
              onClick={createConversation}
              disabled={streaming}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-foreground-muted hover:text-foreground hover:bg-surface-subtle/70 border border-dashed border-border disabled:opacity-50 transition-colors"
            >
              <IconPlus />
              <span>New chat</span>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
            <p className="px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-foreground-subtle">
              Recents
            </p>
            <ConversationList />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0" />
      )}

      <div className={`shrink-0 border-t border-border p-2 ${expanded ? '' : 'flex justify-center'}`}>
        {!expanded && (
          <button
            type="button"
            onClick={toggleExpanded}
            className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-subtle transition-colors"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <IconPanelLeft className="w-5 h-5 scale-x-[-1]" />
          </button>
        )}
        {expanded && agentsRunning && view !== 'studio' && (
          <button
            type="button"
            onClick={onOpenStudio}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-accent hover:bg-surface-subtle transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
            <span className="truncate">Agents running</span>
          </button>
        )}
      </div>
    </aside>
  );
}
