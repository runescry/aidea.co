'use client';

import { useEffect } from 'react';
import { useChatConversations } from '@/hooks/useChatConversations';
import ConversationList from './ConversationList';
import { IconPlus } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ConversationDrawer({ open, onClose }: Props) {
  const { createConversation, streaming } = useChatConversations();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="md:hidden fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px]"
        aria-label="Close conversations"
        onClick={onClose}
      />
      <aside
        className="md:hidden fixed inset-y-0 left-0 z-50 w-[min(88vw,300px)] flex flex-col bg-surface border-r border-border shadow-xl"
        aria-label="Conversations"
      >
        <div className="shrink-0 flex items-center justify-between h-12 px-4 border-b border-border">
          <span className="text-[15px] font-semibold text-foreground">Chats</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-subtle"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 p-3">
          <button
            type="button"
            onClick={() => {
              createConversation();
              onClose();
            }}
            disabled={streaming}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium text-foreground bg-surface-subtle border border-border disabled:opacity-50"
          >
            <IconPlus />
            New chat
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-4">
          <p className="px-1 pb-2 text-[10px] font-medium uppercase tracking-wider text-foreground-subtle">
            Recents
          </p>
          <div
            onClick={e => {
              const target = e.target as HTMLElement;
              if (target.closest('button')) onClose();
            }}
          >
            <ConversationList />
          </div>
        </div>
      </aside>
    </>
  );
}
