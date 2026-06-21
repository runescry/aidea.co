import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  syncContactSignalsFromEmails,
  syncContactSignalsFromCalendar,
  recordRelationshipMonitorSignals,
} from './sync-signals';

vi.mock('./interaction-graph-persist', () => ({
  recordContactInteraction: vi.fn(async () => ({ ok: true, entry: {} })),
}));

import { recordContactInteraction } from './interaction-graph-persist';

describe('syncContactSignalsFromEmails', () => {
  beforeEach(() => vi.mocked(recordContactInteraction).mockClear());

  it('records senders from gmail messages', async () => {
    const count = await syncContactSignalsFromEmails([{
      id: '1',
      from: 'Sam <sam@x.com>',
      subject: 'Hello',
      date: '2026-06-01',
      snippet: '',
      isUnread: false,
      connectionId: 'c1',
    }]);
    expect(count).toBe(1);
    expect(recordContactInteraction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Sam',
      email: 'sam@x.com',
      channel: 'email',
    }));
  });
});

describe('recordRelationshipMonitorSignals', () => {
  beforeEach(() => vi.mocked(recordContactInteraction).mockClear());

  it('records cooling contacts', async () => {
    await recordRelationshipMonitorSignals([{ name: 'Jordan', email: 'j@x.com', weeksSince: 7 }]);
    expect(recordContactInteraction).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'relationship-monitor',
      summary: 'Cooling — 7 weeks since touch',
    }));
  });
});

describe('syncContactSignalsFromCalendar', () => {
  beforeEach(() => vi.mocked(recordContactInteraction).mockClear());

  it('records attendees', async () => {
    await syncContactSignalsFromCalendar([{
      title: '1:1',
      start: '2026-06-01T10:00:00.000Z',
      end: '2026-06-01T11:00:00.000Z',
      date: '2026-06-01',
      time: '10:00',
      attendees: ['Pat <pat@x.com>'],
      location: '',
      description: '',
      connectionId: 'c1',
    }]);
    expect(recordContactInteraction).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Pat',
      channel: 'calendar',
    }));
  });
});
