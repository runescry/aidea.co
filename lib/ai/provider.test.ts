import { describe, expect, it } from 'vitest';
import { formatLlmError, isLlmUnavailableError } from './provider';

describe('isLlmUnavailableError', () => {
  it('detects exhausted credits', () => {
    expect(isLlmUnavailableError(new Error('Your credit balance is too low to access the Anthropic API'))).toBe(true);
  });

  it('detects missing configuration', () => {
    expect(isLlmUnavailableError(new Error('LLM not configured — set AI_GATEWAY_API_KEY'))).toBe(true);
  });

  it('ignores unrelated agent failures', () => {
    expect(isLlmUnavailableError(new Error('Agent inbox-triage exceeded max iterations'))).toBe(false);
  });
});

describe('formatLlmError', () => {
  it('explains exhausted credits plainly', () => {
    expect(formatLlmError(new Error('Your credit balance is too low to access the Anthropic API')))
      .toContain('LLM credits exhausted');
  });
});
