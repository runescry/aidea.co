'use client';

import { useMemo } from 'react';
import { useChatConversations } from '@/hooks/useChatConversations';

export default function ConversationList() {
  const {
    conversations,
    activeId,
    streaming,
    switchConversation,
    closeConversation,
  } = useChatConversations();

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [conversations],
  );

  return (
    <ul className="space-y-0.5">
      {sorted.map(conv => {
        const active = conv.id === activeId;
        return (
          <li key={conv.id} className="group relative">
            <button
              type="button"
              onClick={() => switchConversation(conv.id)}
              disabled={streaming && !active}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] truncate transition-colors ${
                active
                  ? 'bg-surface-subtle text-foreground font-medium'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle/70'
              } disabled:opacity-50`}
              title={conv.title}
            >
              {conv.title}
            </button>
            {conversations.length > 1 && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  closeConversation(conv.id);
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-foreground-subtle opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-surface-subtle transition-opacity"
                aria-label={`Close ${conv.title}`}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
