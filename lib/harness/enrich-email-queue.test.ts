import { describe, expect, it, vi } from 'vitest';
import {
  enrichEmailQueuePayload,
  isNotificationRelayAddress,
  parseEmailAddress,
  validateEmailQueueEnqueue,
} from './enrich-email-queue';

vi.mock('./knowledge-base', () => ({
  readAllKB: vi.fn(async () => ({ identity: { phone: '+61 400 000 000' } })),
}));

describe('parseEmailAddress', () => {
  it('extracts angle-bracket address', () => {
    expect(parseEmailAddress('Cassidy <cassidy@vercel.com>')).toBe('cassidy@vercel.com');
  });
});

describe('isNotificationRelayAddress', () => {
  it('flags guide.co relays', () => {
    expect(isNotificationRelayAddress('notifications@mail3.guide.co')).toBe(true);
    expect(isNotificationRelayAddress('cassidy@vercel.com')).toBe(false);
  });
});

describe('validateEmailQueueEnqueue', () => {
  it('rejects empty body', () => {
    const result = validateEmailQueueEnqueue({
      type: 'email_reply',
      payload: { replyToMessageId: 'msg-1' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects placeholders', () => {
    const result = validateEmailQueueEnqueue({
      type: 'email_reply',
      payload: { replyToMessageId: 'msg-1', body: 'Call me at [your phone number]' },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects notification relay to', () => {
    const result = validateEmailQueueEnqueue({
      type: 'email_reply',
      payload: {
        replyToMessageId: 'msg-1',
        to: 'notifications@mail3.guide.co',
        body: 'Thanks',
      },
    });
    expect(result.ok).toBe(false);
  });

  it('accepts reply with message id and body', () => {
    const result = validateEmailQueueEnqueue({
      type: 'email_reply',
      payload: { replyToMessageId: 'msg-1', body: 'Thanks — confirmed.' },
    });
    expect(result.ok).toBe(true);
  });
});

describe('enrichEmailQueuePayload', () => {
  it('fills to/subject/thread from gmail cache and substitutes phone', async () => {
    const state = {
      _gmailById: {
        'msg-1': {
          id: 'msg-1',
          from: 'Leonie <leonie@gateley.com>',
          subject: 'Telephone confirmation',
          snippet: 'Please call',
          threadId: 'thread-abc',
          connectionId: 'conn-1',
          replyTo: 'Leonie <leonie@gateley.com>',
        },
      },
    };
    const payload = await enrichEmailQueuePayload(
      state,
      { replyToMessageId: 'msg-1', body: 'My number is [your phone number].' },
      'Reply to Gateley: phone',
    );
    expect(payload.to).toBe('leonie@gateley.com');
    expect(payload.subject).toBe('Re: Telephone confirmation');
    expect(payload.threadId).toBe('thread-abc');
    expect(payload.body).toContain('+61 400 000 000');
  });

  it('replaces notification relay to with sender', async () => {
    const state = {
      _gmailById: {
        'msg-2': {
          id: 'msg-2',
          from: 'Cassidy <cassidy@vercel.com>',
          subject: 'Interview',
          snippet: 'times',
          threadId: 'thread-vercel',
          connectionId: 'conn-1',
        },
      },
    };
    const payload = await enrichEmailQueuePayload(state, {
      replyToMessageId: 'msg-2',
      to: 'notifications@mail3.guide.co',
      body: 'Confirmed',
    });
    expect(payload.to).toBe('cassidy@vercel.com');
  });
});
