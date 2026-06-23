type NewsStory = {
  headline?: string;
  title?: string;
  category?: string;
  topic?: string;
  source?: string;
  context?: string;
  url?: string;
  whyRelevant?: string;
};

function formatTitle(title: string, url?: string): string {
  const trimmedUrl = url?.trim();
  return trimmedUrl ? `[**${title}**](${trimmedUrl})` : `**${title}**`;
}

function formatStoryLine(s: NewsStory): string | null {
  const title = (s.headline ?? s.title)?.trim();
  if (!title) return null;
  const titlePart = formatTitle(title, s.url);
  const meta = [s.category ?? s.topic, s.source].filter(Boolean).join(' · ');
  const context = (s.context ?? s.whyRelevant)?.trim();
  if (context) return `- ${titlePart} — ${context}`;
  return meta ? `- ${titlePart} _(${meta})_` : `- ${titlePart}`;
}

function formatHeadlinesFromStructured(obj: Record<string, unknown>): string | null {
  const newsSummary = obj.news_summary as { top_stories?: NewsStory[] } | undefined;
  if (newsSummary?.top_stories?.length) {
    const lines = newsSummary.top_stories
      .map(formatStoryLine)
      .filter((line): line is string => Boolean(line));
    if (lines.length > 0) return lines.join('\n');
  }

  const headlines = obj.headlines as NewsStory[] | undefined;
  if (headlines?.length) {
    const lines = headlines
      .map(formatStoryLine)
      .filter((line): line is string => Boolean(line));
    if (lines.length > 0) return lines.join('\n');
  }

  return null;
}

type InboxItem = {
  priority?: string;
  from?: string;
  subject?: string;
  snippet?: string;
};

function formatInboxFromStructured(obj: Record<string, unknown>): string | null {
  const items = obj.inbox_summary as InboxItem[] | undefined;
  if (!items?.length) {
    const summaryOnly = (obj.summary as string | undefined)?.trim();
    return summaryOnly || null;
  }
  const lines = items.slice(0, 10).map(item => {
    const from = item.from?.trim() || 'Unknown sender';
    const subject = item.subject?.trim();
    const priority = item.priority?.toUpperCase();
    const prefix = priority === 'HIGH' ? '**[High]** ' : '';
    const snippet = item.snippet?.trim();
    const subjectPart = subject ? ` — ${subject}` : '';
    const snippetPart = snippet ? ` _(${snippet.slice(0, 120)})_` : '';
    return `- ${prefix}**${from}**${subjectPart}${snippetPart}`;
  });
  const header = typeof obj.summary === 'string' && obj.summary.trim()
    ? `${obj.summary.trim()}\n\n`
    : '';
  return `${header}${lines.join('\n')}`.trim();
}

/** Prefer headline bullets from structured dispatch output over a generic summary line. */
export function formatDispatchChatSummary(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? value.trim() : '';
  }
  const obj = value as Record<string, unknown>;
  const headlines = formatHeadlinesFromStructured(obj);
  if (headlines) return headlines;
  const inbox = formatInboxFromStructured(obj);
  if (inbox) return inbox;
  const summary = obj.summary;
  return typeof summary === 'string' ? summary.trim() : '';
}
