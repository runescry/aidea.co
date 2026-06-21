import { describe, it, expect } from 'vitest';
import { shouldUseFastChat } from './fast-chat';

describe('shouldUseFastChat', () => {
  it('allows greetings and general chat', () => {
    expect(shouldUseFastChat('Hello')).toBe(true);
    expect(shouldUseFastChat('What can you help me with?')).toBe(true);
    expect(shouldUseFastChat('How should I prioritise my morning?')).toBe(true);
  });

  it('requires full path for tool-heavy requests', () => {
    expect(shouldUseFastChat('What is in my inbox?')).toBe(false);
    expect(shouldUseFastChat('Draft a reply to Sarah about the budget')).toBe(false);
    expect(shouldUseFastChat('Research Acme Corp before my meeting')).toBe(false);
    expect(shouldUseFastChat('Update my profile — brief at 7am')).toBe(false);
    expect(shouldUseFastChat('What needs my attention right now?')).toBe(false);
  });

  it('requires full path for news and current-events queries', () => {
    expect(shouldUseFastChat("what's happening in the news")).toBe(false);
    expect(shouldUseFastChat('whats happening with the strait of hormuz at the moment')).toBe(false);
    expect(shouldUseFastChat("What's in the news today?")).toBe(false);
    expect(shouldUseFastChat('Give me the headlines')).toBe(false);
    expect(shouldUseFastChat('Any current events I should know about?')).toBe(false);
    expect(shouldUseFastChat('Breaking news about AI')).toBe(false);
    expect(shouldUseFastChat('Any breaking developments in Gaza?')).toBe(false);
    expect(shouldUseFastChat('Latest on the Ukraine conflict')).toBe(false);
    expect(shouldUseFastChat('Give me an update on Iran sanctions')).toBe(false);
  });

  it('requires full path for follow-ups on prior tool results', () => {
    const history = [{ role: 'assistant' as const, content: 'Here are your emails…', timestamp: '' }];
    expect(shouldUseFastChat('Reply to the second one', history)).toBe(false);
  });

  it('rejects very long commands', () => {
    expect(shouldUseFastChat('a'.repeat(400))).toBe(false);
  });
});
