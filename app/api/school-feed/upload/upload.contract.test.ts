import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  readAllKB: vi.fn(),
  resolveUserTimezone: vi.fn(),
  userDateYmd: vi.fn(),
  loadSchoolProfiles: vi.fn(),
  matchSchoolCalendarChild: vi.fn(),
  extractEventFromUpload: vi.fn(),
  isSupportedEventUpload: vi.fn(),
  createCalendarEvent: vi.fn(),
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
  extractEventFromUpload: mocks.extractEventFromUpload,
  isSupportedEventUpload: mocks.isSupportedEventUpload,
}));
vi.mock('@/lib/nango/calendar', () => ({ createCalendarEvent: mocks.createCalendarEvent }));
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
    mocks.extractEventFromUpload.mockResolvedValue({
      title: 'Sports carnival', date: '2026-09-05', time: '09:00', location: 'The oval',
    });
    mocks.createCalendarEvent.mockResolvedValue({ eventId: 'evt-1', title: 'Sports carnival', start: '2026-09-05T09:00:00', connectionId: 'conn-1' });
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
    expect(mocks.extractEventFromUpload).not.toHaveBeenCalled();
  });

  it('returns 422 when no event can be extracted', async () => {
    mocks.extractEventFromUpload.mockResolvedValue(null);
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(422);
    expect(mocks.createCalendarEvent).not.toHaveBeenCalled();
  });

  it('returns 502 when extraction throws', async () => {
    mocks.extractEventFromUpload.mockRejectedValue(new Error('Model unavailable'));
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(502);
  });

  it('returns 502 when the calendar write fails, e.g. not connected', async () => {
    mocks.createCalendarEvent.mockRejectedValue(new Error('Google Calendar not connected'));
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ error: 'Google Calendar not connected' });
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
      event: { title: 'Sports carnival', date: '2026-09-05', time: '09:00' },
      calendarEventId: 'evt-1',
    });
  });

  it('assumes 9am and flags it when no time was extracted', async () => {
    mocks.extractEventFromUpload.mockResolvedValue({ title: 'Excursion', date: '2026-09-10' });
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    const res = await POST(uploadRequest(file));

    expect(mocks.createCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ start: '2026-09-10T09:00:00' }));
    await expect(res.json()).resolves.toMatchObject({ event: { assumedTime: true } });
  });

  it('prefixes the matched child so the school feed recognizes the event on re-sync', async () => {
    mocks.matchSchoolCalendarChild.mockReturnValue({ child: 'Ivy', school: 'Genazzano FCJ College' });
    const file = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });
    await POST(uploadRequest(file));

    expect(mocks.createCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ivy: Sports carnival' }));
  });

  it('matches a child named only in the location/description, not the generic title', async () => {
    mocks.matchSchoolCalendarChild.mockImplementation((text: string) =>
      text.includes('Genazzano') ? { child: 'Ivy', school: 'Genazzano FCJ College' } : null,
    );
    mocks.extractEventFromUpload.mockResolvedValue({
      title: 'Sports carnival',
      date: '2026-09-05',
      time: '09:00',
      location: 'Genazzano FCJ College oval',
    });
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

    expect(mocks.extractEventFromUpload).toHaveBeenCalledWith(expect.objectContaining({ referenceDate: '2026-08-07' }));
    expect(mocks.userDateYmd).toHaveBeenCalledWith(expect.any(Date), 'Australia/Melbourne');
  });

  it('does not double-prefix when the extracted title already names the matched child', async () => {
    mocks.matchSchoolCalendarChild.mockReturnValue({ child: 'Ivy', school: 'Genazzano FCJ College' });
    mocks.extractEventFromUpload.mockResolvedValue({ title: 'Ivy sports carnival', date: '2026-09-05', time: '09:00' });
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
});
