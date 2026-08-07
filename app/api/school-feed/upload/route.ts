import { NextRequest, NextResponse } from 'next/server';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { resolveUserTimezone, userDateYmd } from '@/lib/calendar/user-time';
import { loadSchoolProfiles } from '@/lib/harness/school-config';
import { matchSchoolCalendarChild } from '@/lib/harness/school-calendar-classify';
import { extractEventFromUpload, isSupportedEventUpload } from '@/lib/documents/extract-event';
import { createCalendarEvent } from '@/lib/nango/calendar';
import { syncSchoolCalendar } from '@/lib/harness/school-calendar-sync';
import { nangoConfigured, resolveEndUserId } from '@/lib/nango/client';
import { isDemoUserId } from '@/lib/auth/session';
import type { KnowledgeBase } from '@/types/knowledge-base';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_TIME = '09:00';

function notConnected() {
  return NextResponse.json(
    { error: 'Google Calendar not connected — use Settings → Connect Calendar' },
    { status: 503 },
  );
}

/** Upload a flyer/form/notice, extract its event, and add it to Google Calendar. */
export async function POST(req: NextRequest) {
  if (isDemoUserId(await resolveEndUserId())) {
    return NextResponse.json({ error: 'Uploads are not available in demo mode' }, { status: 503 });
  }
  if (!nangoConfigured()) return notConnected();

  let file: File;
  try {
    const form = await req.formData();
    const value = form.get('file');
    if (!(value instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    file = value;
  } catch {
    return NextResponse.json({ error: 'Could not read upload' }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File is too large — 8MB max' }, { status: 400 });
  }
  if (!isSupportedEventUpload(file.type, file.name)) {
    return NextResponse.json(
      { error: 'Unsupported file type — upload a PDF or image (JPG/PNG/WEBP/GIF)' },
      { status: 400 },
    );
  }

  const kb = await readAllKB() as KnowledgeBase;
  const timeZone = resolveUserTimezone(kb);
  const bytes = Buffer.from(await file.arrayBuffer());

  let extracted;
  try {
    extracted = await extractEventFromUpload({
      bytes,
      mimeType: file.type,
      filename: file.name,
      referenceDate: userDateYmd(new Date(), timeZone),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not read the document: ${message}` }, { status: 502 });
  }

  if (!extracted) {
    return NextResponse.json(
      {
        error:
          "Couldn't find a dated event in that document — check it's a flyer, form, or notice with a clear date.",
      },
      { status: 422 },
    );
  }

  const profiles = loadSchoolProfiles(kb);
  // Match against the whole extraction, not just the (often generic) title — "Sports carnival"
  // won't name a child or school on its own, but the location/description often does.
  const matchText = [extracted.title, extracted.description, extracted.location].filter(Boolean).join(' ');
  const matchedChild = matchSchoolCalendarChild(matchText, profiles);
  // Embed the child's name so the school feed's own title-only matcher recognizes this event
  // once school-calendar-sync reads it back from Google Calendar.
  const title =
    matchedChild && !extracted.title.toLowerCase().includes(matchedChild.child.toLowerCase())
      ? `${matchedChild.child}: ${extracted.title}`
      : extracted.title;

  const time = extracted.time ?? DEFAULT_TIME;
  const start = `${extracted.date}T${time}:00`;

  try {
    const event = await createCalendarEvent({
      title,
      start,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      description: extracted.description,
      location: extracted.location,
      timeZone,
    });

    // Best-effort — pull the new event straight into the school feed instead of waiting for the
    // next hourly cron. A sync failure here doesn't undo the calendar write, so it's swallowed.
    await syncSchoolCalendar().catch(() => undefined);

    return NextResponse.json({
      ok: true,
      event: {
        title,
        date: extracted.date,
        time: extracted.time,
        location: extracted.location,
        assumedTime: !extracted.time,
      },
      calendarEventId: event.eventId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
