export interface GmailLinkOptions {
  /** Connected mailbox — opens the right account when using authuser. */
  account?: string;
  /** Legacy / primary index when account email is unknown. */
  accountIndex?: number;
  /** Prefer thread id — Gmail web redirects reliably from #all/{threadId}. */
  threadId?: string;
}

/** Open a Gmail message in the web UI (ids from Gmail API). */
export function gmailMessageUrl(
  messageId: string,
  options?: GmailLinkOptions | number,
): string {
  let opts: GmailLinkOptions = {};
  if (typeof options === 'number') opts = { accountIndex: options };
  else if (options) opts = options;

  const openId = (opts.threadId ?? messageId).trim();
  if (!openId) return '';

  if (opts.account?.includes('@')) {
    const params = new URLSearchParams({ authuser: opts.account });
    return `https://mail.google.com/mail/?${params.toString()}#all/${openId}`;
  }

  const index = opts.accountIndex ?? 0;
  return `https://mail.google.com/mail/u/${index}/#all/${openId}`;
}

export function gmailMessageUrlFromEmail(email: {
  id: string;
  threadId?: string;
  account?: string;
}): string {
  return gmailMessageUrl(email.id, { threadId: email.threadId, account: email.account });
}
