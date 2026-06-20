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

describe('mergeChatStores', () => {
  it('does not resurrect conversations in deletedConversationIds', () => {
    const remote: ChatStore = {
      conversations: [conv('a', '2026-01-02'), conv('b', '2026-01-01')],
      activeId: 'a',
    };
    const local: ChatStore = {
      conversations: [conv('a', '2026-01-02')],
      activeId: 'a',
      deletedConversationIds: ['b'],
    };

    const merged = mergeChatStores(local, remote);
    expect(merged.conversations.map(c => c.id)).toEqual(['a']);
    expect(merged.deletedConversationIds).toContain('b');
  });
});

describe('applyChatStoreUpdate', () => {
  it('treats conversations missing from client payload as deleted', () => {
    const server: ChatStore = {
      conversations: [conv('keep', '2026-01-02'), conv('gone', '2026-01-01')],
      activeId: 'keep',
    };
    const client: ChatStore = {
      conversations: [conv('keep', '2026-01-02')],
      activeId: 'keep',
      deletedConversationIds: ['gone'],
    };

    const applied = applyChatStoreUpdate(client, server);
    expect(applied.conversations.map(c => c.id)).toEqual(['keep']);
    expect(applied.deletedConversationIds).toContain('gone');
  });
});
