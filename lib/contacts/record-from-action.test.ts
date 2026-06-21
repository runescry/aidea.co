import { describe, expect, it, vi, beforeEach } from 'vitest';
import { recordEmailSent, recordCalendarCreated } from './record-from-action';

vi.mock('./interaction-graph-persist', () => ({
  recordContactInteraction: vi.fn(async () => ({ ok: true, entry: {} })),
}));

import { recordContactInteraction } from './interaction-graph-persist';

describe('recordEmailSent', () => {
  beforeEach(() => {
    vi.mocked(recordContactInteraction).mockClear();
  });

  it('records parsed recipients', async () => {
    await recordEmailSent({ to: 'Sarah <s@x.com>', subject: 'Hello' });
    expect(recordContactInteraction).toHaveBeenCalledWith({
      name: 'Sarah',
      email: 's@x.com',
      channel: 'email',
      summary: 'Sent: Hello',
    });
  });
});

describe('recordCalendarCreated', () => {
  beforeEach(() => {
    vi.mocked(recordContactInteraction).mockClear();
  });

  it('records attendees', async () => {
    await recordCalendarCreated({ title: 'Sync', attendees: ['Alex <a@x.com>'] });
    expect(recordContactInteraction).toHaveBeenCalledWith({
      name: 'Alex',
      email: 'a@x.com',
      channel: 'calendar',
      summary: 'Calendar: Sync',
    });
  });
});
