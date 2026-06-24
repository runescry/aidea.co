const DEFAULT_MAX_CHARS = 6_000;
const GMAIL_BODY_PREVIEW = 400;
const ATTACHMENT_TEXT_PREVIEW = 2_000;

function truncateString(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}… [truncated ${text.length - max} chars for token budget]`;
}

/** Shrink tool results before they are fed back into the agent LLM loop. */
export function compactToolResultForLlm(toolName: string, result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  if ('error' in (result as object)) return result;

  if (toolName === 'gmail_read') {
    const r = result as { emails?: Array<Record<string, unknown>>; query?: string; connections?: string[] };
    return {
      query: r.query,
      connections: r.connections,
      emails: (r.emails ?? []).slice(0, 12).map(email => ({
        id: email.id,
        from: email.from,
        subject: email.subject,
        date: email.date,
        snippet: truncateString(String(email.snippet ?? ''), 220),
        isUnread: email.isUnread,
        connectionId: email.connectionId,
        ...(email.bodyText
          ? { bodyPreview: truncateString(String(email.bodyText), GMAIL_BODY_PREVIEW) }
          : {}),
      })),
    };
  }

  if (toolName === 'gmail_attachment_read') {
    const r = result as {
      messageId?: string;
      attachments?: Array<{ filename?: string; text?: string; error?: string; mimeType?: string }>;
      skipped?: unknown[];
    };
    return {
      messageId: r.messageId,
      attachments: (r.attachments ?? []).map(a => ({
        filename: a.filename,
        mimeType: a.mimeType,
        text: a.text ? truncateString(a.text, ATTACHMENT_TEXT_PREVIEW) : undefined,
        error: a.error,
      })),
      skipped: r.skipped,
    };
  }

  if (toolName === 'news_search' || toolName === 'web_search') {
    const r = result as { results?: unknown[] };
    return {
      ...(result as object),
      results: (r.results ?? []).slice(0, 5),
    };
  }

  const json = JSON.stringify(result);
  if (json.length <= DEFAULT_MAX_CHARS) return result;
  return { preview: truncateString(json, DEFAULT_MAX_CHARS) };
}
