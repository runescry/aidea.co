import { describe, expect, it } from 'vitest';
import { applyGmailMetadataToMustDo } from './morning-brief-enrich';
import { looksLikeBadHeadline, mustDoHeadline } from './morning-brief-must-do';

describe('morning-brief-enrich', () => {
  it('fills subject from Gmail metadata', () => {
    const out = applyGmailMetadataToMustDo(
      [{
        messageId: 'm1',
        action: 'Kind regards Leonie Spragg Office Manager',
        detail: 'Hi Marcus Thank you – can you provide your telephone number',
      }],
      [{
        id: 'm1',
        subject: 'Gateley — confirm your phone number',
        from: 'Leonie Spragg <office@gateley.com>',
        snippet: 'Hi Marcus Thank you',
        threadId: 't1',
        account: 'marcus@example.com',
      }],
    );
    expect(out[0]?.subject).toBe('Gateley — confirm your phone number');
    expect(mustDoHeadline(out[0]!)).toBe('Gateley — confirm your phone number');
  });
});

describe('looksLikeBadHeadline', () => {
  it('rejects signatures and body fragments', () => {
    expect(looksLikeBadHeadline('Kind regards Leonie Spragg Office Manager for Gateley')).toBe(true);
    expect(looksLikeBadHeadline('Great news, we are keen to make you an offer')).toBe(true);
    expect(looksLikeBadHeadline('Just tried to process again the $59.99 subscription')).toBe(true);
    expect(looksLikeBadHeadline('Gateley — confirm your phone number')).toBe(false);
  });
});
