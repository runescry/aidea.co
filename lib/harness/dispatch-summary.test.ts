import { describe, it, expect } from 'vitest';
import { formatDispatchChatSummary } from './dispatch-summary';

describe('formatDispatchChatSummary', () => {
  it('formats news_summary.top_stories as markdown bullets', () => {
    const text = formatDispatchChatSummary({
      summary: 'Retrieved current news headlines and breaking stories',
      news_summary: {
        top_stories: [
          { headline: 'Pentagon requests $80B', category: 'Defense', source: 'Reuters' },
          { headline: 'Red Flag warning in effect', category: 'Weather' },
        ],
      },
    });
    expect(text).toContain('**Pentagon requests $80B**');
    expect(text).toContain('(Defense · Reuters)');
    expect(text).toContain('**Red Flag warning in effect**');
    expect(text).not.toContain('Retrieved current news');
  });

  it('formats headlines array from news-curator shape', () => {
    const text = formatDispatchChatSummary({
      headlines: [
        { title: 'OpenAI raises $2B', whyRelevant: 'Competitor pricing moves' },
        { title: 'UK election called' },
      ],
    });
    expect(text).toContain('**OpenAI raises $2B** — Competitor pricing moves');
    expect(text).toContain('**UK election called**');
  });

  it('formats top_stories with title and context fields', () => {
    const text = formatDispatchChatSummary({
      summary: 'Retrieved latest headlines',
      news_summary: {
        top_stories: [
          { title: 'Microsoft CEO warns AI industry', topic: 'AI industry', context: 'Satya Nadella on concentration risk' },
        ],
      },
    });
    expect(text).toContain('**Microsoft CEO warns AI industry** — Satya Nadella on concentration risk');
    expect(text).not.toContain('Retrieved latest headlines');
  });

  it('falls back to summary string', () => {
    expect(formatDispatchChatSummary({ summary: 'Queued a reply to Natalie.' }))
      .toBe('Queued a reply to Natalie.');
  });
});
