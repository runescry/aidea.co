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

/** Prefer headline bullets from structured dispatch output over a generic summary line. */
export function formatDispatchChatSummary(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? value.trim() : '';
  }
  const headlines = formatHeadlinesFromStructured(value as Record<string, unknown>);
  if (headlines) return headlines;
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === 'string' ? summary.trim() : '';
}
