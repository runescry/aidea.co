/** Open a Gmail message in the web UI (message id from Gmail API). */
export function gmailMessageUrl(messageId: string, accountIndex = 0): string {
  const id = messageId.trim();
  if (!id) return '';
  return `https://mail.google.com/mail/u/${accountIndex}/#inbox/${encodeURIComponent(id)}`;
}
