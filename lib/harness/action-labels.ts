export const ACTION_TYPE_LABELS: Record<string, string> = {
  email_reply: 'Email reply',
  email_send: 'Email send',
  calendar_event: 'Calendar',
  task: 'Task',
  reminder: 'Reminder',
  message: 'Message',
  alert: 'Alert',
  kb_update: 'Profile update',
  generic: 'Action',
};

export function auditStatusLabel(status: string): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'executed':
      return 'Sent';
    case 'saved':
      return 'Saved to drafts';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}
