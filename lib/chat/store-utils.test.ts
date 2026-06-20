import { describe, it, expect } from 'vitest';
import { applyChatStoreUpdate, mergeChatStores } from './store-utils';
import type { ChatConversation, ChatStore } from '@/types/chat';

function conv(id: string, updatedAt: string): ChatConversation {
  return {
    id,
    title: id,
    messages: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('applyChatStoreUpdate', () => {
  it('drops conversations omitted from the client payload', () => {
    const server: ChatStore = {
      conversations: [conv('keep', '2026-01-02'), conv('gone', '2026-01-01')],
      activeId: 'keep',
    };
    const client: ChatStore = {
      conversations: [conv('keep', '2026-01-02')],
      activeId: 'keep',
    };

    const applied = applyChatStoreUpdate(client, server);
    expect(applied.conversations.map(c => c.id)).toEqual(['keep']);
  });
});

describe('mergeChatStores', () => {
  it('prefers the newer updatedAt for the same conversation id', () => {
    const remote: ChatStore = {
      conversations: [conv('a', '2026-01-01')],
      activeId: 'a',
    };
    const local: ChatStore = {
      conversations: [{ ...conv('a', '2026-01-03'), title: 'local wins' }],
      activeId: 'a',
    };

    const merged = mergeChatStores(local, remote);
    expect(merged.conversations[0].title).toBe('local wins');
  });
});
