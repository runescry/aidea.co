import type { QueuedAction } from './queue';
import { sendGmailMessage } from '@/lib/nango/gmail';
import { createCalendarEvent } from '@/lib/nango/calendar';

export async function executeQueuedAction(action: QueuedAction): Promise<unknown> {
  const payload = action.payload ?? {};

  switch (action.tool) {
    case 'gmail_send': {
      const { to, subject, body, connectionId } = payload as {
        to: string; subject: string; body: string; connectionId?: string;
      };
      if (!to || !subject || !body) throw new Error('Email action missing to, subject, or body');
      return sendGmailMessage({ to, subject, body, connectionId });
    }
    case 'calendar_create': {
      const { title, start, durationMinutes, description, attendees, connectionId } = payload as {
        title: string;
        start: string;
        durationMinutes: number;
        description?: string;
        attendees?: string[];
        connectionId?: string;
      };
      if (!title || !start || !durationMinutes) {
        throw new Error('Calendar action missing title, start, or durationMinutes');
      }
      return createCalendarEvent({ title, start, durationMinutes, description, attendees, connectionId });
    }
    default:
      throw new Error(`No executor for tool: ${action.tool}`);
  }
}
