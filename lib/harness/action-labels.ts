import type { ActionType } from './queue-types';

export const ACTION_TYPE_LABELS: Record<string, string> = {
  email_reply: 'Email reply',
  email_send: 'Email send',
  calendar_event: 'Calendar event',
  task: 'Task',
  reminder: 'Reminder',
  message: 'Message',
  alert: 'Alert',
  kb_update: 'Profile update',
  generic: 'Action',
};

export function queueApproveLabel(type: ActionType): string {
  switch (type) {
    case 'kb_update':
      return 'Apply update';
    case 'calendar_event':
      return 'Add to calendar';
    default:
      return 'Approve & send';
  }
}

export function queueExecutedFeedback(type: ActionType): string {
  switch (type) {
    case 'kb_update':
      return 'Profile updated';
    case 'calendar_event':
      return 'Added to calendar';
    default:
      return 'Sent';
  }
}

export function queueApprovedFeedback(type: ActionType): string {
  switch (type) {
    case 'kb_update':
      return 'Update approved';
    case 'calendar_event':
      return 'Event approved';
    default:
      return 'Approved';
  }
}

export function auditStatusLabel(status: string, actionType?: string): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'executed':
      if (actionType === 'calendar_event') return 'Added to calendar';
      if (actionType === 'kb_update') return 'Profile updated';
      return 'Sent';
    case 'saved':
      return 'Saved to drafts';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}
