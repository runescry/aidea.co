import { describe, expect, it } from 'vitest';
import { calendarPayloadFromAction } from './calendar-display';

describe('calendarPayloadFromAction', () => {
  it('reads attendees from payload.to when attendees is missing', () => {
    const cal = calendarPayloadFromAction({
      summary: 'Calendar: Sync',
      payload: {
        title: 'Sync',
        start: '2026-06-01T14:00:00.000Z',
        durationMinutes: 30,
        to: 'alex@example.com, pat@example.com',
      },
    });
    expect(cal.attendees).toEqual(['alex@example.com', 'pat@example.com']);
  });

  it('prefers attendees over to when both are set', () => {
    const cal = calendarPayloadFromAction({
      summary: 'Calendar: Sync',
      payload: {
        title: 'Sync',
        start: '2026-06-01T14:00:00.000Z',
        durationMinutes: 30,
        attendees: ['from-attendees@example.com'],
        to: 'from-to@example.com',
      },
    });
    expect(cal.attendees).toEqual(['from-attendees@example.com']);
  });
});
