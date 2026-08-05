import {
  gmailMessageUrlFromEmail,
  type GmailLinkEmail,
} from '@/lib/gmail/message-url';

const GMAIL_INTEGRATION_ID = 'google-mail';

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
}

let cachedGmailAccount: string | null | undefined;

function pickGmailEmail(
  connections: Array<{ integrationId?: string; email?: string }> | undefined,
): string | undefined {
  const gmail = connections?.find(c => c.integrationId === GMAIL_INTEGRATION_ID);
  return gmail?.email?.includes('@') ? gmail.email : undefined;
}

async function fetchConnections(lite: boolean): Promise<Array<{ integrationId?: string; email?: string }>> {
  const res = await fetch(`/api/nango/connections${lite ? '?lite=1' : ''}`);
  if (!res.ok) return [];
  const data = await res.json() as { connections?: Array<{ integrationId?: string; email?: string }> };
  return data.connections ?? [];
}

async function resolveGmailAccount(explicit?: string): Promise<string | undefined> {
  if (explicit?.includes('@')) return explicit;
  if (cachedGmailAccount !== undefined) return cachedGmailAccount ?? undefined;

  try {
    let email = pickGmailEmail(await fetchConnections(true));
    if (!email) {
      email = pickGmailEmail(await fetchConnections(false));
    }
    cachedGmailAccount = email ?? null;
    return email;
  } catch {
    cachedGmailAccount = null;
    return undefined;
  }
}

/** Warm cache on Home so taps stay synchronous (mobile blocks window.open after await). */
export function prefetchConnectedGmailAccount(): void {
  void resolveGmailAccount();
}

function buildGmailUrl(email: GmailLinkEmail, account?: string): string {
  const target = isMobileDevice() ? 'mobile' : 'desktop';
  return gmailMessageUrlFromEmail({ ...email, account }, target);
}

/** Open Gmail in the browser — account-specific /u/{email}/ URLs (not the Android app intent). */
export async function openGmailMessage(
  email: GmailLinkEmail,
  targetWindow?: Window | null,
): Promise<void> {
  const account = await resolveGmailAccount(email.account);
  const url = buildGmailUrl(email, account);
  if (!url) return;

  if (targetWindow && !targetWindow.closed) {
    targetWindow.location.replace(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Test hook — reset cached connected mailbox between tests. */
export function resetGmailAccountCacheForTests(): void {
  cachedGmailAccount = undefined;
}
