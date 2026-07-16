import { describe, expect, it } from 'vitest';
import type { CachedGmail } from './inbox-sanitize';
import {
  appendInboxWindowToGmailQuery,
  defaultInboxTriageGmailQuery,
  filterTriageListForMustDo,
  isEmailClearlyOutsideInboxWindow,
  isEmailWithinInboxWindow,
  INBOX_LOOKBACK_DAYS,
  textReferencesStaleForward,
  triageRowEligibleForMustDo,
} from './inbox-window';

describe('inbox-window', () => {
  it('defaults to fortnight window without unread filter', () => {
    expect(defaultInboxTriageGmailQuery()).toBe(`newer_than:${INBOX_LOOKBACK_DAYS}d`);
  });

  it('appends newer_than when missing', () => {
    expect(appendInboxWindowToGmailQuery('from:boss@co.com')).toBe(`from:boss@co.com newer_than:${INBOX_LOOKBACK_DAYS}d`);
    expect(appendInboxWindowToGmailQuery('from:boss@co.com newer_than:7d')).toBe('from:boss@co.com newer_than:7d');
  });

  it('treats unparseable dates as in-window for cache retention', () => {
    const now = new Date('2026-06-24T12:00:00Z');
    expect(isEmailClearlyOutsideInboxWindow('', now)).toBe(false);
    expect(isEmailClearlyOutsideInboxWindow('not-a-date', now)).toBe(false);
  });

  it('excludes clearly old email dates', () => {
    const now = new Date('2026-06-24T12:00:00Z');
    expect(isEmailClearlyOutsideInboxWindow('29 June 2020 at 22:21:57 SGT', now)).toBe(true);
    expect(isEmailWithinInboxWindow('2026-06-20T10:00:00Z', now)).toBe(true);
  });

  it('detects stale content when the agent summary cites an old forward', () => {
    const forward = 'Begin forwarded message: Date: 29 June 2020 at 22:21:57 SGT';
    expect(textReferencesStaleForward(forward, new Date('2026-06-24T12:00:00Z'))).toBe(true);
    expect(textReferencesStaleForward('Please reply about the invoice due Friday', new Date('2026-06-24T12:00:00Z'))).toBe(false);
  });

  it('keeps recent rows even when the body contains an old forward quote', () => {
    const now = new Date('2026-06-24T12:00:00Z');
    const cache = new Map<string, CachedGmail>([
      ['m1', {
        id: 'm1',
        from: 'Zoe <z@example.com>',
        subject: 'Fwd: company setup',
        snippet: 'See below',
        date: 'Mon, 22 Jun 2026 09:00:00 +1000',
        bodyText: 'Begin forwarded message:\nDate: 29 June 2020 at 22:21:57 SGT',
      }],
    ]);
    expect(triageRowEligibleForMustDo({
      messageId: 'm1',
      subject: 'Fwd: company setup',
      action: 'Review the new reply',
    }, cache, now)).toBe(true);
  });

  it('drops rows when the agent summary cites the stale forward', () => {
    const cache = new Map<string, CachedGmail>([[
      'm1',
      { id: 'm1', from: 'a@x.com', subject: 'Fwd', snippet: 'x', date: 'Mon, 22 Jun 2026 09:00:00 +1000' },
    ]]);
    expect(triageRowEligibleForMustDo({
      messageId: 'm1',
      reason: 'Begin forwarded message: Date: 29 June 2020',
    }, cache, new Date('2026-06-24T12:00:00Z'))).toBe(false);
  });

  it('filters urgent/action lists', () => {
    const cache = new Map<string, CachedGmail>([
      ['m1', { id: 'm1', from: 'a@x.com', subject: 'Invoice', snippet: 'Due Friday', date: 'Mon, 20 Jun 2026 10:00:00 +1000' }],
    ]);
    const out = filterTriageListForMustDo([
      { messageId: 'm1', subject: 'OK' },
      { subject: 'hallucinated' },
    ], cache, new Date('2026-06-24T12:00:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0].messageId).toBe('m1');
  });

  it('matches triage rows by subject when messageId is missing or wrong', () => {
    const cache = new Map<string, CachedGmail>([
      ['real-id', {
        id: 'real-id',
        from: 'Xavier College',
        subject: 'PE kit reminder',
        snippet: 'Sports day Friday',
        date: 'Mon, 22 Jun 2026 09:00:00 +1000',
      }],
    ]);
    expect(triageRowEligibleForMustDo({
      messageId: 'wrong-id',
      subject: 'PE kit reminder',
      action: 'Pack sports kit',
    }, cache, new Date('2026-06-24T12:00:00Z'))).toBe(true);
    expect(triageRowEligibleForMustDo({
      subject: 'PE kit reminder',
      from: 'Xavier College',
      action: 'Pack sports kit',
    }, cache, new Date('2026-06-24T12:00:00Z'))).toBe(true);
  });
});
