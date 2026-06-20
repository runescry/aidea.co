/** Turn Nango/Gmail API errors into actionable messages. */
export function formatGmailApiError(err: unknown, action: 'read' | 'draft' | 'send'): string {
  const axios = err as {
    response?: { status?: number; data?: { error?: { message?: string; errors?: Array<{ reason?: string }> } } };
    message?: string;
  };
  const status = axios.response?.status;
  const googleMsg = axios.response?.data?.error?.message;
  const reason = axios.response?.data?.error?.errors?.[0]?.reason;
  const base = googleMsg ?? (err instanceof Error ? err.message : String(err));

  if (status === 403 || /forbidden/i.test(base)) {
    if (action === 'draft' || action === 'send') {
      return 'Gmail returned 403 — add scope https://www.googleapis.com/auth/gmail.compose to your Nango google-mail integration, then reconnect Google in Settings';
    }
    return `Gmail returned 403 — ${base}. Try reconnecting the account that received this email in Settings.`;
  }
  if (status === 404 || reason === 'notFound') {
    return 'Email not found on this Gmail account — the draft may reference a message from another connected inbox';
  }
  return base;
}

export function isGmailForbidden(err: unknown): boolean {
  const axios = err as { response?: { status?: number } };
  if (axios.response?.status === 403) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /forbidden|403/i.test(msg);
}
