import { describe, expect, it } from 'vitest';
import { financeSubscriptionNudges } from './subscription-nudges';
import { readPlaidStub, plaidConfigured } from './plaid-stub';

describe('financeSubscriptionNudges', () => {
  it('surfaces renewals within 7 days', () => {
    const tasks = financeSubscriptionNudges({
      finance: {
        subscriptions: [{
          name: 'Notion',
          amount: 10,
          cadence: 'monthly',
          renewsOn: '2026-06-25',
        }],
      },
    }, new Date('2026-06-21T12:00:00.000Z'));
    expect(tasks[0]?.title).toContain('Notion');
    expect(tasks[0]?.title).toContain('4 day');
  });

  it('surfaces review notes', () => {
    const tasks = financeSubscriptionNudges({
      finance: { subscriptions: [{ name: 'Spotify', notes: 'Review — rarely used' }] },
    });
    expect(tasks[0]?.title).toContain('Review');
  });
});

describe('readPlaidStub', () => {
  it('reports stub when env missing', () => {
    expect(readPlaidStub().configured).toBe(plaidConfigured());
  });
});
