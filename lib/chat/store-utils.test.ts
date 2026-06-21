import { describe, it, expect } from 'vitest';
import {
  applyChatStoreUpdate,
  dedupeEphemeralConversations,
  hydrateChatStore,
  mergeChatStores,
} from './store-utils';
import type { ChatConversation, ChatStore } from '@/types/chat';

function conv(id: string, updatedAt: string, title = id): ChatConversation {
  return {
    id,
    title,
    messages: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

function ephemeral(id: string, updatedAt: string): ChatConversation {
  return conv(id, updatedAt, 'New conversation');
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

describe('hydrateChatStore', () => {
  it('returns remote when local is null', () => {
    const remote: ChatStore = {
      conversations: [conv('remote', '2026-01-02')],
      activeId: 'remote',
    };
    const hydrated = hydrateChatStore(null, remote);
    expect(hydrated.conversations.map(c => c.id)).toEqual(['remote']);
  });

  it('returns local when remote is null', () => {
    const local: ChatStore = {
      conversations: [conv('local', '2026-01-02')],
      activeId: 'local',
    };
    const hydrated = hydrateChatStore(local, null);
    expect(hydrated.conversations.map(c => c.id)).toEqual(['local']);
  });

  it('merges when both sides exist', () => {
    const local: ChatStore = {
      conversations: [conv('shared', '2026-01-03')],
      activeId: 'shared',
    };
    const remote: ChatStore = {
      conversations: [conv('remote-only', '2026-01-01')],
      activeId: 'remote-only',
    };
    const hydrated = hydrateChatStore(local, remote);
    expect(hydrated.conversations.map(c => c.id).sort()).toEqual(['remote-only', 'shared']);
  });

  it('creates one empty conversation when both sides are null', () => {
    const hydrated = hydrateChatStore(null, null);
    expect(hydrated.conversations).toHaveLength(1);
    expect(hydrated.conversations[0].title).toBe('New conversation');
  });
});

describe('dedupeEphemeralConversations', () => {
  it('keeps only the most recent empty New conversation shell', () => {
    const conversations = [
      ephemeral('old', '2026-01-01'),
      conv('real', '2026-01-02'),
      ephemeral('new', '2026-01-03'),
    ];
    const deduped = dedupeEphemeralConversations(conversations);
    expect(deduped.map(c => c.id)).toEqual(['real', 'new']);
    expect(deduped.filter(c => c.title === 'New conversation')).toHaveLength(1);
    expect(deduped.find(c => c.title === 'New conversation')?.id).toBe('new');
  });
});
