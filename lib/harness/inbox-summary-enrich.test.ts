import { describe, it, expect } from 'vitest';
import { enrichInboxSummary, type CachedGmail } from './inbox-sanitize';
import { gmailMessageUrl } from '@/lib/gmail/message-url';

describe('enrichInboxSummary', () => {
  const cache = new Map<string, CachedGmail>([
    ['msg-1', {
      id: 'msg-1',
      from: 'Stripe <billing@stripe.com>',
      subject: 'Payment failed',
      snippet: 'Your card was declined',
    }],
  ]);

  it('matches by subject and adds gmailUrl', () => {
    const rows = enrichInboxSummary(
      [{ priority: 'HIGH', from: 'Stripe', subject: 'Payment failed' }],
      cache,
    );
    expect(rows[0]?.messageId).toBe('msg-1');
    expect(rows[0]?.gmailUrl).toBe(gmailMessageUrl('msg-1'));
    expect(rows[0]?.snippet).toBe('Your card was declined');
  });

  it('preserves messageId when already provided', () => {
    const rows = enrichInboxSummary(
      [{ messageId: 'msg-99', subject: 'Unknown' }],
      cache,
    );
    expect(rows[0]?.gmailUrl).toBe(gmailMessageUrl('msg-99'));
  });
});
