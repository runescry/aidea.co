type NewsStory = { headline?: string; title?: string; category?: string; topic?: string; source?: string; context?: string };
type Headline = { title?: string; topic?: string; whyRelevant?: string };

function formatHeadlinesFromStructured(obj: Record<string, unknown>): string | null {
  const newsSummary = obj.news_summary as { top_stories?: NewsStory[] } | undefined;
  if (newsSummary?.top_stories?.length) {
    const lines = newsSummary.top_stories
      .map(s => {
        const title = (s.headline ?? s.title)?.trim();
        if (!title) return null;
        const meta = [s.category ?? s.topic, s.source].filter(Boolean).join(' · ');
        const context = s.context?.trim();
        if (context) return `- **${title}** — ${context}`;
        return meta ? `- **${title}** _(${meta})_` : `- **${title}**`;
      })
      .filter((line): line is string => Boolean(line));
    if (lines.length > 0) return lines.join('\n');
  }

  const headlines = obj.headlines as Headline[] | undefined;
  if (headlines?.length) {
    const lines = headlines
      .map(h => {
        const title = h.title?.trim();
        if (!title) return null;
        const why = h.whyRelevant?.trim();
        return why ? `- **${title}** — ${why}` : `- **${title}**`;
      })
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
