export type GmailLinkTarget = 'desktop' | 'mobile';

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
  target?: GmailLinkTarget;
}

export interface GmailLinkEmail {
  id: string;
  threadId?: string;
  account?: string;
  internetMessageId?: string;
  subject?: string;
  from?: string;
}

function parseSenderAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

function normalizeInternetMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, '');
}

function encodeGmailSearchHash(query: string): string {
  return encodeURIComponent(query).replace(/%20/g, '+');
}

function gmailSearchUrl(
  query: string,
  target: GmailLinkTarget,
  account?: string,
  accountIndex = 0,
): string {
  const hash = encodeGmailSearchHash(query);
  const searchPath = target === 'mobile' ? `#tl/search/${hash}` : `#search/${hash}`;

  if (account?.includes('@')) {
    const params = new URLSearchParams({ authuser: account });
    const base = target === 'mobile'
      ? `https://mail.google.com/mail/mu/mp/0/?${params.toString()}`
      : `https://mail.google.com/mail/?${params.toString()}`;
    return `${base}${searchPath}`;
  }

  const base = target === 'mobile'
    ? 'https://mail.google.com/mail/mu/mp/0/'
    : `https://mail.google.com/mail/u/${accountIndex}/`;
  return `${base}${searchPath}`;
}

function subjectSearchQuery(from: string, subject: string, target: GmailLinkTarget): string {
  const sender = parseSenderAddress(from);
  const cleanSubject = subject.replace(/"/g, '').trim();
  // Mobile Gmail search is pickier — skip quoted subjects that often fail to resolve.
  if (sender && cleanSubject) {
    if (target === 'mobile') {
      return `in:anywhere from:${sender} ${cleanSubject}`;
    }
    return `in:anywhere from:${sender} subject:"${cleanSubject}"`;
  }
  if (cleanSubject) {
    return target === 'mobile'
      ? `in:anywhere ${cleanSubject}`
      : `in:anywhere subject:"${cleanSubject}"`;
  }
  if (sender) return `in:anywhere from:${sender}`;
  return '';
}

function resolveGmailSearchQuery(messageId: string, opts: GmailLinkOptions): string | null {
  const internetMessageId = opts.internetMessageId?.trim();
  if (internetMessageId) {
    return `rfc822msgid:${normalizeInternetMessageId(internetMessageId)}`;
  }
  if (opts.from && opts.subject) {
    const query = subjectSearchQuery(opts.from, opts.subject, opts.target ?? 'desktop');
    return query || null;
  }
  return null;
}

/** Android intent URL — opens Gmail app when installed, falls back to https in browser. */
export function androidGmailIntentUrl(httpsUrl: string): string {
  const withoutScheme = httpsUrl.replace(/^https?:\/\//, '');
  const fallback = encodeURIComponent(httpsUrl);
  return `intent://${withoutScheme}#Intent;scheme=https;package=com.google.android.gm;S.browser_fallback_url=${fallback};end`;
}

/** Open a Gmail message in the web UI. API hex ids in #all/ often land on inbox only — prefer search. */
export function gmailMessageUrl(
  messageId: string,
  options?: GmailLinkOptions | number,
): string {
  let opts: GmailLinkOptions = {};
  if (typeof options === 'number') opts = { accountIndex: options };
  else if (options) opts = options;

  const target = opts.target ?? 'desktop';
  const accountIndex = opts.accountIndex ?? 0;
  const searchQuery = resolveGmailSearchQuery(messageId, { ...opts, target });
  if (searchQuery) {
    return gmailSearchUrl(searchQuery, target, opts.account, accountIndex);
  }

  const openId = (opts.threadId ?? messageId).trim();
  if (!openId) return '';

  if (opts.account?.includes('@')) {
    const params = new URLSearchParams({ authuser: opts.account });
    return `https://mail.google.com/mail/?${params.toString()}#all/${openId}`;
  }

  return `https://mail.google.com/mail/u/${accountIndex}/#all/${openId}`;
}

export function gmailMessageUrlFromEmail(
  email: GmailLinkEmail,
  target: GmailLinkTarget = 'desktop',
): string {
  return gmailMessageUrl(email.id, {
    threadId: email.threadId,
    account: email.account,
    internetMessageId: email.internetMessageId,
    subject: email.subject,
    from: email.from,
    target,
  });
}
