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

  it('formats top_stories with markdown links when url is present', () => {
    const text = formatDispatchChatSummary({
      news_summary: {
        top_stories: [
          {
            headline: 'OpenAI secures $2B funding',
            url: 'https://example.com/openai-funding',
            topic: 'AI',
            context: 'Competitor pricing moves',
          },
          {
            title: 'UK election called',
            url: 'https://example.com/uk-election',
            source: 'BBC',
          },
        ],
      },
    });
    expect(text).toContain('[**OpenAI secures $2B funding**](https://example.com/openai-funding)');
    expect(text).toContain('Competitor pricing moves');
    expect(text).toContain('[**UK election called**](https://example.com/uk-election)');
    expect(text).toContain('_(BBC)_');
  });

  it('formats headlines array with urls from news-curator shape', () => {
    const text = formatDispatchChatSummary({
      headlines: [
        {
          title: 'Stripe raises Series I',
          url: 'https://example.com/stripe',
          whyRelevant: 'Payments stack for your side project',
        },
      ],
    });
    expect(text).toContain('[**Stripe raises Series I**](https://example.com/stripe)');
    expect(text).toContain('Payments stack for your side project');
  });

  it('falls back to summary string', () => {
    expect(formatDispatchChatSummary({ summary: 'Queued a reply to Natalie.' }))
      .toBe('Queued a reply to Natalie.');
  });

  it('formats inbox_summary as markdown bullets', () => {
    const text = formatDispatchChatSummary({
      summary: 'Two payment failures this week.',
      inbox_summary: [
        { priority: 'HIGH', from: 'Stripe', subject: 'Payment failed', snippet: 'Your card was declined' },
        { from: 'Apple', subject: 'Billing issue' },
      ],
    });
    expect(text).toContain('Two payment failures this week.');
    expect(text).toContain('**[High]** **Stripe**');
    expect(text).toContain('**Apple**');
  });

  it('returns summary when inbox_summary is empty', () => {
    expect(formatDispatchChatSummary({
      summary: 'No failed payment emails in the last week.',
      inbox_summary: [],
    })).toBe('No failed payment emails in the last week.');
  });
});
