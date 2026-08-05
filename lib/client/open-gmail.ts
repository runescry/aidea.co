import {
  androidGmailIntentUrl,
  gmailMessageUrlFromEmail,
  type GmailLinkEmail,
} from '@/lib/gmail/message-url';

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/** Open Gmail on the right surface — mobile web / Gmail app on Pixel, desktop web elsewhere. */
export function openGmailMessage(email: GmailLinkEmail): void {
  const target = isMobileDevice() ? 'mobile' : 'desktop';
  const url = gmailMessageUrlFromEmail(email, target);
  if (!url) return;

  if (isAndroid()) {
    window.location.assign(androidGmailIntentUrl(url));
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
