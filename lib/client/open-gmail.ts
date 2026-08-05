import {
  androidGmailIntentUrl,
  gmailMessageUrlFromEmail,
  type GmailLinkEmail,
} from '@/lib/gmail/message-url';

const GMAIL_INTEGRATION_ID = 'google-mail';

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

let cachedGmailAccount: string | null | undefined;

async function resolveGmailAccount(explicit?: string): Promise<string | undefined> {
  if (explicit?.includes('@')) return explicit;
  if (cachedGmailAccount !== undefined) return cachedGmailAccount ?? undefined;
  try {
    const res = await fetch('/api/nango/connections?lite=1');
    if (!res.ok) {
      cachedGmailAccount = null;
      return undefined;
    }
    const data = await res.json() as {
      connections?: Array<{ integrationId?: string; email?: string }>;
    };
    const gmail = data.connections?.find(c => c.integrationId === GMAIL_INTEGRATION_ID);
    cachedGmailAccount = gmail?.email?.includes('@') ? gmail.email : null;
    return cachedGmailAccount ?? undefined;
  } catch {
    cachedGmailAccount = null;
    return undefined;
  }
}

/** Open Gmail on the right surface — mobile web / Gmail app on Pixel, desktop web elsewhere. */
export async function openGmailMessage(email: GmailLinkEmail): Promise<void> {
  const account = await resolveGmailAccount(email.account);
  const target = isMobileDevice() ? 'mobile' : 'desktop';
  const url = gmailMessageUrlFromEmail({ ...email, account }, target);
  if (!url) return;

  if (isAndroid()) {
    window.location.assign(androidGmailIntentUrl(url));
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Test hook — reset cached connected mailbox between tests. */
export function resetGmailAccountCacheForTests(): void {
  cachedGmailAccount = undefined;
}
