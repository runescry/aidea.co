import type { QueuedAction } from './queue';

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
