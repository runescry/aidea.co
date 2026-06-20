/** Client-safe queue types — no server/storage imports. */

export type ActionType =
  | 'email_reply'
  | 'email_send'
  | 'calendar_event'
  | 'task'
  | 'reminder'
  | 'message'
  | 'alert'
  | 'kb_update'
  | 'generic';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'saved';

/** User intent from Inbox: send, save to Gmail drafts, or dismiss. */
export type QueueIntent = 'approve' | 'save' | 'reject';

/** Live edits from Inbox preview before approve/save. */
export interface QueueEditOverrides {
  body?: string;
  subject?: string;
  to?: string;
  cc?: string;
}

export interface QueuedAction {
  id: string;
  type: ActionType;
  summary: string;
  detail?: string;
  agentRole: string;
  entityId?: string;
  tool: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
  resolvedAt?: string;
}
