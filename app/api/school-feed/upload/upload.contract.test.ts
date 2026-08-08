import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  readAllKB: vi.fn(),
  resolveUserTimezone: vi.fn(),
  userDateYmd: vi.fn(),
  loadSchoolProfiles: vi.fn(),
  matchSchoolCalendarChild: vi.fn(),
  extractEventsFromUpload: vi.fn(),
  isSupportedEventUpload: vi.fn(),
  createCalendarEvent: vi.fn(),
  hasCalendarConnection: vi.fn(),
  syncSchoolCalendar: vi.fn(),
  nangoConfigured: vi.fn(),
  resolveEndUserId: vi.fn(),
  isDemoUserId: vi.fn(),
}));

vi.mock('@/lib/harness/knowledge-base', () => ({ readAllKB: mocks.readAllKB }));
vi.mock('@/lib/calendar/user-time', () => ({
  resolveUserTimezone: mocks.resolveUserTimezone,
  userDateYmd: mocks.userDateYmd,
}));
vi.mock('@/lib/harness/school-config', () => ({ loadSchoolProfiles: mocks.loadSchoolProfiles }));
vi.mock('@/lib/harness/school-calendar-classify', () => ({ matchSchoolCalendarChild: mocks.matchSchoolCalendarChild }));
vi.mock('@/lib/documents/extract-event', () => ({
  extractEventsFromUpload: mocks.extractEventsFromUpload,
  isSupportedEventUpload: mocks.isSupportedEventUpload,
}));
vi.mock('@/lib/nango/calendar', () => ({ createCalendarEvent: mocks.createCalendarEvent }));
vi.mock('@/lib/nango/connections', () => ({ hasCalendarConnection: mocks.hasCalendarConnection }));
vi.mock('@/lib/harness/school-calendar-sync', () => ({ syncSchoolCalendar: mocks.syncSchoolCalendar }));
vi.mock('@/lib/nango/client', () => ({
  nangoConfigured: mocks.nangoConfigured,
  resolveEndUserId: mocks.resolveEndUserId,
}));
vi.mock('@/lib/auth/session', () => ({ isDemoUserId: mocks.isDemoUserId }));

import { POST } from './route';

function uploadRequest(file: File | null): NextRequest {
  const form = new FormData();
  if (file) form.append('file', file);
  return new NextRequest('https://aidea.test/api/school-feed/upload', { method: 'POST', body: form });
}

const CARNIVAL = { title: 'Sports carnival', date: '2026-09-05', time: '09:00', location: 'The oval' };
const LATE_START = { title: 'Late start', date: '2026-08-11', time: '09:35' };

describe('POST /api/school-feed/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nangoConfigured.mockReturnValue(true);
    mocks.resolveEndUserId.mockResolvedValue('google:abc');
    mocks.isDemoUserId.mockReturnValue(false);
    mocks.readAllKB.mockResolvedValue({ family: { children: [] } });
    mocks.resolveUserTimezone.mockReturnValue('Australia/Melbourne');
    mocks.userDateYmd.mockReturnValue('2026-08-07');
    mocks.loadSchoolProfiles.mockReturnValue([]);
    mocks.matchSchoolCalendarChild.mockReturnValue(null);
    mocks.isSupportedEventUpload.mockReturnValue(true);
    mocks.hasCalendarConnection.mockResolvedValue(true);
    mocks.extractEventsFromUpload.mockResolvedValue([CARNIVAL]);
    mocks.createCalendarEvent.mockImplementation(async ({ title, start }: { title: string; start: string }) => ({
      eventId: `evt-${title}`, title, start, connectionId: 'conn-1',
    }));
    mocks.syncSchoolCalendar.mockResolvedValue({ ok: true, eventCount: 1, weekStart: '2026-09-01', weekEnd: '2026-09-07' });
  });

  it('returns 503 when Nango is not configured', async () => {
    mocks.nangoConfigured.mockReturnValue(false);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(503);
  });

  it('returns 503 for demo sessions without touching the calendar', async () => {
    mocks.isDemoUserId.mockReturnValue(true);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(503);
    expect(mocks.createCalendarEvent).not.toHaveBeenCalled();
  });

  it('returns 503 up front when no calendar is connected, without calling extraction', async () => {
    mocks.hasCalendarConnection.mockResolvedValue(false);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(503);
    expect(mocks.extractEventsFromUpload).not.toHaveBeenCalled();
  });

  it('returns a structured 502 instead of throwing when the calendar preflight check itself fails', async () => {
    mocks.hasCalendarConnection.mockRejectedValue(new Error('Nango timeout'));
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('Nango timeout') });
    expect(mocks.extractEventsFromUpload).not.toHaveBeenCalled();
  });

  it('returns 400 when no file is provided', async () => {
    const res = await POST(uploadRequest(null));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an empty file', async () => {
    const file = new File([], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('empty') });
  });

  it('returns 400 for an unsupported file type', async () => {
    mocks.isSupportedEventUpload.mockReturnValue(false);
    const file = new File(['x'], 'flyer.docx', { type: 'application/msword' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(400);
    expect(mocks.extractEventsFromUpload).not.toHaveBeenCalled();
  });

  it('returns 422 when no events can be extracted', async () => {
    mocks.extractEventsFromUpload.mockResolvedValue([]);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(422);
    expect(mocks.createCalendarEvent).not.toHaveBeenCalled();
  });

  it('returns 502 when extraction throws', async () => {
    mocks.extractEventsFromUpload.mockRejectedValue(new Error('Model unavailable'));
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(502);
  });

  it('returns 502 when the calendar write fails', async () => {
    mocks.createCalendarEvent.mockRejectedValue(new Error('Google API error'));
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ ok: false, events: [{ ok: false, error: 'Google API error' }] });
  });

  it('creates the event with the extracted date/time and the user timezone', async () => {
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));

    expect(res.status).toBe(200);
    expect(mocks.createCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Sports carnival',
      start: '2026-09-05T09:00:00',
      timeZone: 'Australia/Melbourne',
    }));
    expect(mocks.syncSchoolCalendar).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      events: [{ ok: true, title: 'Sports carnival', date: '2026-09-05', time: '09:00' }],
    });
  });

  it('assumes 9am and flags it when no time was extracted', async () => {
    mocks.extractEventsFromUpload.mockResolvedValue([{ title: 'Excursion', date: '2026-09-10' }]);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));

    expect(mocks.createCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ start: '2026-09-10T09:00:00' }));
    await expect(res.json()).resolves.toMatchObject({ events: [{ assumedTime: true }] });
  });

  it('processes every extracted event from a multi-event document', async () => {
    mocks.extractEventsFromUpload.mockResolvedValue([CARNIVAL, LATE_START]);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));

    expect(res.status).toBe(200);
    expect(mocks.createCalendarEvent).toHaveBeenCalledTimes(2);
    expect(mocks.createCalendarEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: 'Sports carnival' }));
    expect(mocks.createCalendarEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'Late start' }));
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      events: [
        { ok: true, title: 'Sports carnival' },
        { ok: true, title: 'Late start' },
      ],
    });
  });

  it('reports a partial failure without dropping the events that succeeded', async () => {
    mocks.extractEventsFromUpload.mockResolvedValue([CARNIVAL, LATE_START]);
    mocks.createCalendarEvent.mockImplementation(async ({ title }: { title: string }) => {
      if (title === 'Late start') throw new Error('Conflict');
      return { eventId: 'evt-1', title, start: '2026-09-05T09:00:00', connectionId: 'conn-1' };
    });
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));

    // At least one event succeeded, so this is still a 200 with a mixed-result array — not an
    // all-or-nothing failure that would silently drop the carnival event too.
    expect(res.status).toBe(200);
    expect(mocks.syncSchoolCalendar).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      events: [
        { ok: true, title: 'Sports carnival' },
        { ok: false, title: 'Late start', error: 'Conflict' },
      ],
    });
  });

  it('matches a child named only in the location/description, not the generic title', async () => {
    mocks.matchSchoolCalendarChild.mockImplementation((text: string) =>
      text.includes('Genazzano') ? { child: 'Ivy', school: 'Genazzano FCJ College' } : null,
    );
    mocks.extractEventsFromUpload.mockResolvedValue([{
      title: 'Sports carnival',
      date: '2026-09-05',
      time: '09:00',
      location: 'Genazzano FCJ College oval',
    }]);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    await POST(uploadRequest(file));

    expect(mocks.createCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ivy: Sports carnival' }));
  });

  it('passes the extracted location through to the calendar write', async () => {
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    await POST(uploadRequest(file));

    expect(mocks.createCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ location: 'The oval' }));
  });

  it("resolves relative dates against the user's local date, not the server's", async () => {
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    await POST(uploadRequest(file));

    expect(mocks.extractEventsFromUpload).toHaveBeenCalledWith(expect.objectContaining({ referenceDate: '2026-08-07' }));
    expect(mocks.userDateYmd).toHaveBeenCalledWith(expect.any(Date), 'Australia/Melbourne');
  });

  it('does not double-prefix when the extracted title already names the matched child', async () => {
    mocks.matchSchoolCalendarChild.mockReturnValue({ child: 'Ivy', school: 'Genazzano FCJ College' });
    mocks.extractEventsFromUpload.mockResolvedValue([{ title: 'Ivy sports carnival', date: '2026-09-05', time: '09:00' }]);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    await POST(uploadRequest(file));

    expect(mocks.createCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ivy sports carnival' }));
  });

  it('still reports success if the post-upload sync fails', async () => {
    mocks.syncSchoolCalendar.mockRejectedValue(new Error('Calendar read failed'));
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true });
  });

  it('does not run the post-upload sync when every event fails', async () => {
    mocks.createCalendarEvent.mockRejectedValue(new Error('Google API error'));
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    await POST(uploadRequest(file));

    expect(mocks.syncSchoolCalendar).not.toHaveBeenCalled();
  });
});
