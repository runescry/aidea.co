import type { QueuedAction } from './queue-types';
import { sendGmailMessage, createGmailDraft } from '@/lib/nango/gmail';
import { createCalendarEvent } from '@/lib/nango/calendar';
import { canExecuteEmailAction, canSaveEmailDraft, normalizeEmailQueueAction } from './normalize-queue-action';

export async function executeQueuedAction(action: QueuedAction): Promise<unknown> {
  const normalized = { ...action, ...normalizeEmailQueueAction(action) };
  const payload = normalized.payload ?? {};

  switch (normalized.tool) {
    case 'gmail_send': {
      const { to, cc, subject, body, connectionId } = payload as {
        to: string; cc?: string; subject: string; body: string; connectionId?: string;
      };
      if (!to || !subject || !body) throw new Error('Email action missing to, subject, or body');
      return sendGmailMessage({ to, cc, subject, body, connectionId });
    }
    case 'calendar_create': {
      const { title, start, durationMinutes, description, attendees, connectionId } = payload as {
        title: string; start: string; durationMinutes: number; description?: string; attendees?: string[];
        connectionId?: string;
      };
      if (!title || !start || !durationMinutes) {
        throw new Error('Calendar action missing title, start, or durationMinutes');
      }
      return createCalendarEvent({ title, start, durationMinutes, description, attendees, connectionId });
    }
    default:
      throw new Error(`No executor for tool: ${normalized.tool}`);
  }
}

export async function saveQueuedEmailDraft(action: QueuedAction): Promise<unknown> {
  const normalized = { ...action, ...normalizeEmailQueueAction(action) };
  if (!canSaveEmailDraft(normalized)) {
    throw new Error('Draft missing body text');
  }
  const payload = normalized.payload ?? {};
  const { to, cc, subject, body, connectionId } = payload as {
    to?: string;
    cc?: string;
    subject?: string;
    body: string;
    replyToMessageId?: string;
    messageId?: string;
    connectionId?: string;
  };
  const replyToMessageId = String(
    payload.replyToMessageId ?? payload.messageId ?? '',
  ) || undefined;
  return createGmailDraft({ to, cc, subject, body, replyToMessageId, connectionId });
}

export async function approveQueuedAction(action: QueuedAction): Promise<QueuedAction> {
  if (action.type === 'kb_update') {
    const { applyKbPatch, kbPatchInputFromPayload } = await import('./kb-updates');
    const patchInput = kbPatchInputFromPayload({
      ...action.payload,
      summary: action.summary,
    });
    if (!patchInput) throw new Error('Profile update had no changes to apply');
    await applyKbPatch(patchInput);
    return { ...action, status: 'executed' };
  }

  if (action.type === 'email_reply' || action.type === 'email_send') {
    const normalized = { ...action, ...normalizeEmailQueueAction(action) };
    if (!canExecuteEmailAction(normalized)) {
      throw new Error('Email missing recipient — use Save to add to Gmail drafts instead');
    }
    await executeQueuedAction(normalized);
    return { ...normalized, status: 'executed' };
  }

  if (action.tool === 'gmail_send' || action.tool === 'calendar_create') {
    await executeQueuedAction(action);
    return { ...action, status: 'executed' };
  }

  return { ...action, status: 'approved' };
}
