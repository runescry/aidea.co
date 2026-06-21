import type { QueuedAction, QueueEditOverrides } from './queue-types';
import { calendarPayloadFromAction } from './calendar-display';

export type { QueueEditOverrides };

/** Normalize agent-queued email actions so approve can execute or save cleanly. */
export function normalizeEmailQueueAction(
  action: Pick<QueuedAction, 'type' | 'summary' | 'detail' | 'tool' | 'payload'>,
): Pick<QueuedAction, 'tool' | 'payload' | 'detail'> {
  if (action.type !== 'email_reply' && action.type !== 'email_send') {
    return { tool: action.tool, payload: action.payload ?? {}, detail: action.detail };
  }

  const payload: Record<string, unknown> = { ...(action.payload ?? {}) };
  const detail = action.detail?.trim() ?? '';

  const suggested =
    (typeof payload.suggestedReply === 'string' ? payload.suggestedReply : undefined)
    ?? (typeof payload.body === 'string' ? payload.body : undefined);

  if (!payload.body && suggested) payload.body = suggested;
  if (!payload.body && detail) payload.body = detail;
  if (!detail && typeof payload.body === 'string') {
    return { tool: action.tool || 'gmail_send', payload, detail: payload.body };
  }

  if (!payload.subject && action.summary) {
    const reMatch = action.summary.match(/^Reply to .+?:\s*(.+)$/i);
    if (reMatch) payload.subject = `Re: ${reMatch[1].trim()}`;
  }

  return { tool: action.tool || 'gmail_send', payload, detail: detail || String(payload.body ?? '') };
}

export function canExecuteEmailAction(action: QueuedAction): boolean {
  const { payload } = normalizeEmailQueueAction(action);
  const body = payload.body;
  const to = payload.to;
  return typeof body === 'string' && body.length > 0 && typeof to === 'string' && to.length > 0;
}

export function canSaveEmailDraft(action: QueuedAction): boolean {
  if (action.type !== 'email_reply' && action.type !== 'email_send') return false;
  const { payload } = normalizeEmailQueueAction(action);
  const body = payload.body;
  return typeof body === 'string' && body.trim().length > 0;
}

export function isEmailQueueAction(action: QueuedAction): boolean {
  return action.type === 'email_reply' || action.type === 'email_send';
}

export function isCalendarQueueAction(action: QueuedAction): boolean {
  return action.type === 'calendar_event';
}

/** Normalize calendar queue actions for execute + Inbox display. */
export function normalizeCalendarQueueAction(
  action: Pick<QueuedAction, 'type' | 'summary' | 'detail' | 'tool' | 'payload'>,
): Pick<QueuedAction, 'tool' | 'payload' | 'detail'> {
  if (action.type !== 'calendar_event') {
    return { tool: action.tool, payload: action.payload ?? {}, detail: action.detail };
  }
  const cal = calendarPayloadFromAction(action);
  const payload: Record<string, unknown> = {
    ...(action.payload ?? {}),
    title: cal.title,
    start: cal.start,
    durationMinutes: cal.durationMinutes,
  };
  if (cal.description) payload.description = cal.description;
  if (cal.attendees?.length) payload.attendees = cal.attendees;
  const detail = cal.description ?? action.detail ?? describeCalendarDetail(cal);
  return { tool: action.tool || 'calendar_create', payload, detail };
}

function describeCalendarDetail(cal: ReturnType<typeof calendarPayloadFromAction>): string {
  const parts = [cal.title];
  if (cal.start) parts.push(cal.start);
  return parts.join(' · ');
}

export function canExecuteCalendarAction(action: QueuedAction): boolean {
  if (action.type !== 'calendar_event') return false;
  const { payload } = normalizeCalendarQueueAction(action);
  return typeof payload.title === 'string'
    && payload.title.length > 0
    && typeof payload.start === 'string'
    && payload.start.length > 0
    && typeof payload.durationMinutes === 'number'
    && payload.durationMinutes > 0;
}

/** Apply user edits from Inbox preview before approve/save. */
export function applyQueueEdits(
  action: QueuedAction,
  edits?: QueueEditOverrides,
): QueuedAction {
  if (!edits) return action;

  if (isCalendarQueueAction(action)) {
    const next: QueuedAction = {
      ...action,
      payload: { ...(action.payload ?? {}) },
    };
    if (typeof edits.title === 'string') next.payload.title = edits.title.trim();
    if (typeof edits.start === 'string') next.payload.start = edits.start.trim();
    if (typeof edits.durationMinutes === 'number' && edits.durationMinutes > 0) {
      next.payload.durationMinutes = edits.durationMinutes;
    }
    if (typeof edits.description === 'string') {
      next.payload.description = edits.description;
      next.detail = edits.description;
    }
    const recipientEdit = typeof edits.to === 'string' ? edits.to : edits.attendees;
    if (typeof recipientEdit === 'string') {
      const list = recipientEdit.split(',').map(s => s.trim()).filter(Boolean);
      if (list.length > 0) next.payload.attendees = list;
      else delete next.payload.attendees;
      delete next.payload.to;
    }
    return next;
  }

  if (!isEmailQueueAction(action)) return action;

  const next: QueuedAction = {
    ...action,
    payload: { ...(action.payload ?? {}) },
  };

  if (typeof edits.body === 'string') {
    next.payload.body = edits.body;
    next.detail = edits.body;
  }
  if (typeof edits.subject === 'string') {
    next.payload.subject = edits.subject;
  }
  if (typeof edits.to === 'string') {
    next.payload.to = edits.to.trim();
  }
  if (typeof edits.cc === 'string') {
    const cc = edits.cc.trim();
    if (cc) next.payload.cc = cc;
    else delete next.payload.cc;
  }

  return next;
}
