import { NextRequest, NextResponse } from 'next/server';
import {
  addSnoozeDays,
  dismissProactiveTask,
  hygieneToProfileUpdates,
  readProactiveHygiene,
  snoozeProactiveTask,
} from '@/lib/harness/proactive-tasks';
import { invalidateDevTasksCache } from '@/lib/harness/tasks-cache';
import { mergeProfile, readProfile } from '@/lib/storage';

export const runtime = 'nodejs';

const SNOOZE_DAYS = new Set([1, 7, 30]);

export async function PATCH(req: NextRequest) {
  let body: { id?: string; action?: string; days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id.startsWith('proactive-')) {
    return NextResponse.json({ error: 'Only proactive suggestion IDs are supported' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'dismiss' && action !== 'snooze') {
    return NextResponse.json({ error: 'action must be dismiss or snooze' }, { status: 400 });
  }

  const profile = await readProfile();
  let hygiene = readProactiveHygiene(profile);

  if (action === 'dismiss') {
    hygiene = dismissProactiveTask(hygiene, id);
  } else {
    const days = typeof body.days === 'number' && SNOOZE_DAYS.has(body.days) ? body.days : 7;
    hygiene = snoozeProactiveTask(hygiene, id, addSnoozeDays(new Date(), days));
  }

  await mergeProfile(hygieneToProfileUpdates(hygiene));
  invalidateDevTasksCache();

  return NextResponse.json({ ok: true, id, action });
}
