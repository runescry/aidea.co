'use client';

export interface NewsStoryItem {
  headline?: string;
  title?: string;
  category?: string;
  topic?: string;
  source?: string;
  context?: string;
  url?: string;
  whyRelevant?: string;
}

export interface DispatchNewsStructured {
  summary?: string;
  news_summary?: {
    top_stories?: NewsStoryItem[];
  };
  headlines?: NewsStoryItem[];
}

function normalizeStories(data: DispatchNewsStructured): NewsStoryItem[] {
  const fromTopStories = data.news_summary?.top_stories ?? [];
  if (fromTopStories.length > 0) return fromTopStories;
  return data.headlines ?? [];
}

function storyTitle(item: NewsStoryItem): string {
  return (item.headline ?? item.title ?? '').trim();
}

function storyTopic(item: NewsStoryItem): string | undefined {
  const topic = (item.category ?? item.topic)?.trim();
  return topic || undefined;
}

function storyContext(item: NewsStoryItem): string | undefined {
  const context = (item.context ?? item.whyRelevant)?.trim();
  return context || undefined;
}

function HeadlineRow({ item }: { item: NewsStoryItem }) {
  const title = storyTitle(item);
  if (!title) return null;

  const topic = storyTopic(item);
  const context = storyContext(item);
  const source = item.source?.trim();
  const url = item.url?.trim();

  return (
    <li className="border-l-2 border-border pl-3 py-2 space-y-0.5">
      <div className="flex items-start gap-2 flex-wrap">
        {topic ? (
          <span className="text-[10px] font-mono bg-surface-subtle text-foreground-subtle px-1.5 py-0.5 rounded shrink-0">
            {topic}
          </span>
        ) : null}
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-accent hover:underline leading-snug transition-colors"
          >
            {title}
          </a>
        ) : (
          <span className="text-[13px] font-medium text-foreground leading-snug">{title}</span>
        )}
      </div>
      {context ? (
        <p className="text-[12px] text-foreground-muted leading-relaxed">{context}</p>
      ) : null}
      {source ? (
        <p className="text-[11px] text-foreground-subtle">{source}</p>
      ) : null}
    </li>
  );
}

interface Props {
  data: DispatchNewsStructured;
}

export default function NewsHeadlinesCard({ data }: Props) {
  const stories = normalizeStories(data);
  if (stories.length === 0) return null;

  return (
    <div className="space-y-3">
      {data.summary ? (
        <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>
      ) : null}
      <ul className="space-y-1 rounded-lg border border-border/60 bg-surface/50 px-3 py-1">
        {stories.map((item, i) => (
          <HeadlineRow key={`${storyTitle(item)}-${i}`} item={item} />
        ))}
      </ul>
    </div>
  );
}

export function isNewsStructured(data: unknown): data is DispatchNewsStructured {
  if (!data || typeof data !== 'object') return false;
  const obj = data as DispatchNewsStructured;
  const topStories = obj.news_summary?.top_stories;
  if (Array.isArray(topStories) && topStories.length > 0) return true;
  const headlines = obj.headlines;
  return Array.isArray(headlines) && headlines.length > 0;
}
