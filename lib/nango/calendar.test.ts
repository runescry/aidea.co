import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  resolveCalendarConnections: vi.fn(),
}));

vi.mock('./client', () => ({ getNango: () => ({ post: mocks.post }) }));
vi.mock('./connections', () => ({ resolveCalendarConnections: mocks.resolveCalendarConnections }));

import { createCalendarEvent } from './calendar';

describe('createCalendarEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveCalendarConnections.mockResolvedValue([{ connectionId: 'conn-1', integrationId: 'google-calendar' }]);
    mocks.post.mockResolvedValue({ data: { id: 'evt-1' } });
  });

  it('forwards a naive local time with the given timeZone instead of converting to UTC', async () => {
    await createCalendarEvent({
      title: 'Sports carnival',
      start: '2026-09-05T09:00:00',
      durationMinutes: 60,
      timeZone: 'Australia/Melbourne',
    });

    const [call] = mocks.post.mock.calls[0] as [{ data: { start: unknown; end: unknown } }];
    expect(call.data.start).toEqual({ dateTime: '2026-09-05T09:00:00', timeZone: 'Australia/Melbourne' });
    expect(call.data.end).toEqual({ dateTime: '2026-09-05T10:00:00', timeZone: 'Australia/Melbourne' });
  });

  it('rolls the end time over to the next day without shifting the zone', async () => {
    await createCalendarEvent({
      title: 'Late event',
      start: '2026-09-05T23:30:00',
      durationMinutes: 90,
      timeZone: 'Australia/Melbourne',
    });

    const [call] = mocks.post.mock.calls[0] as [{ data: { end: { dateTime: string } } }];
    expect(call.data.end).toEqual({ dateTime: '2026-09-06T01:00:00', timeZone: 'Australia/Melbourne' });
  });

  it('falls back to a UTC instant when no timeZone is given', async () => {
    await createCalendarEvent({
      title: 'Legacy caller',
      start: '2026-09-05T09:00:00.000Z',
      durationMinutes: 30,
    });

    const [call] = mocks.post.mock.calls[0] as [{ data: { start: { dateTime: string }; end: { dateTime: string } } }];
    expect(call.data.start).toEqual({ dateTime: '2026-09-05T09:00:00.000Z' });
    expect(call.data.end).toEqual({ dateTime: '2026-09-05T09:30:00.000Z' });
  });

  it('returns the created event id and echoes the input start', async () => {
    const result = await createCalendarEvent({
      title: 'Sports carnival',
      start: '2026-09-05T09:00:00',
      durationMinutes: 60,
      timeZone: 'Australia/Melbourne',
    });

    expect(result).toEqual({
      eventId: 'evt-1',
      title: 'Sports carnival',
      start: '2026-09-05T09:00:00',
      connectionId: 'conn-1',
    });
  });
});
