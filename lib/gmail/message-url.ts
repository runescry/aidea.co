export interface GmailLinkOptions {
  /** Connected mailbox — opens the right account when using authuser. */
  account?: string;
  /** Legacy / primary index when account email is unknown. */
  accountIndex?: number;
  /** RFC 822 Message-ID header (without angle brackets). Most reliable deep link. */
  internetMessageId?: string;
  /** Fallback search when Message-ID is unavailable. */
  subject?: string;
  from?: string;
  threadId?: string;
}

function parseSenderAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

function normalizeInternetMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, '');
}

function gmailSearchUrl(query: string, account?: string, accountIndex = 0): string {
  const hash = encodeURIComponent(query).replace(/%20/g, '+');
  if (account?.includes('@')) {
    const params = new URLSearchParams({ authuser: account });
    return `https://mail.google.com/mail/?${params.toString()}#search/${hash}`;
  }
  return `https://mail.google.com/mail/u/${accountIndex}/#search/${hash}`;
}

function subjectSearchQuery(from: string, subject: string): string {
  const sender = parseSenderAddress(from);
  const cleanSubject = subject.replace(/"/g, '').trim();
  if (sender && cleanSubject) {
    return `in:anywhere from:${sender} subject:"${cleanSubject}"`;
  }
  if (cleanSubject) return `in:anywhere subject:"${cleanSubject}"`;
  if (sender) return `in:anywhere from:${sender}`;
  return '';
}

/** Open a Gmail message in the web UI. API hex ids in #all/ often land on inbox only — prefer search. */
export function gmailMessageUrl(
  messageId: string,
  options?: GmailLinkOptions | number,
): string {
  let opts: GmailLinkOptions = {};
  if (typeof options === 'number') opts = { accountIndex: options };
  else if (options) opts = options;

  const accountIndex = opts.accountIndex ?? 0;
  const internetMessageId = opts.internetMessageId?.trim();
  if (internetMessageId) {
    return gmailSearchUrl(
      `rfc822msgid:${normalizeInternetMessageId(internetMessageId)}`,
      opts.account,
      accountIndex,
    );
  }

  const subjectQuery = opts.from && opts.subject
    ? subjectSearchQuery(opts.from, opts.subject)
    : '';
  if (subjectQuery) {
    return gmailSearchUrl(subjectQuery, opts.account, accountIndex);
  }

  const openId = (opts.threadId ?? messageId).trim();
  if (!openId) return '';

  if (opts.account?.includes('@')) {
    const params = new URLSearchParams({ authuser: opts.account });
    return `https://mail.google.com/mail/?${params.toString()}#all/${openId}`;
  }

  return `https://mail.google.com/mail/u/${accountIndex}/#all/${openId}`;
}

export function gmailMessageUrlFromEmail(email: {
  id: string;
  threadId?: string;
  account?: string;
  internetMessageId?: string;
  subject?: string;
  from?: string;
}): string {
  return gmailMessageUrl(email.id, {
    threadId: email.threadId,
    account: email.account,
    internetMessageId: email.internetMessageId,
    subject: email.subject,
    from: email.from,
  });
}
