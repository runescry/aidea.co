'use client';

import { useChatConversations } from '@/hooks/useChatConversations';

export default function ConversationTabs() {
  const {
    conversations,
    activeId,
    streaming,
    switchConversation,
    createConversation,
    closeConversation,
  } = useChatConversations();

  return (
    <div className="shrink-0 flex items-center gap-1 border-b border-border pb-2 -mx-1 overflow-x-auto">
      {conversations.map(conv => {
        const active = conv.id === activeId;
        return (
          <div key={conv.id} className="flex items-center shrink-0 group">
            <button
              type="button"
              onClick={() => switchConversation(conv.id)}
              disabled={streaming && !active}
              className={`max-w-[160px] truncate px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                active
                  ? 'bg-surface-subtle text-foreground font-medium border border-border'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle/60'
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
                className="ml-0.5 p-1 rounded text-foreground-subtle opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-surface-subtle/80 transition-opacity"
                aria-label={`Close ${conv.title}`}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={createConversation}
        disabled={streaming}
        className="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] text-foreground-muted hover:text-foreground hover:bg-surface-subtle/60 border border-dashed border-border disabled:opacity-50"
        title="New conversation"
      >
        +
      </button>
    </div>
  );
}
