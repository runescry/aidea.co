import { describe, expect, it } from 'vitest';
import { compactToolResultForLlm } from './tool-result-truncate';

describe('compactToolResultForLlm', () => {
  it('truncates gmail bodies and limits email count', () => {
    const emails = Array.from({ length: 20 }, (_, i) => ({
      id: `m${i}`,
      from: 'a@b.com',
      subject: `Sub ${i}`,
      snippet: 'x'.repeat(500),
      bodyText: 'y'.repeat(2_000),
    }));

    const out = compactToolResultForLlm('gmail_read', { emails, query: 'is:unread' }) as {
      emails: Array<{ bodyPreview?: string; snippet: string }>;
    };

    expect(out.emails).toHaveLength(12);
    expect(out.emails[0].snippet.length).toBeLessThan(300);
    expect(out.emails[0].bodyPreview).toContain('truncated');
  });

  it('truncates attachment text', () => {
    const out = compactToolResultForLlm('gmail_attachment_read', {
      messageId: 'm1',
      attachments: [{ filename: 'a.pdf', text: 'z'.repeat(5_000) }],
    }) as { attachments: Array<{ text: string }> };

    expect(out.attachments[0].text).toContain('truncated');
    expect(out.attachments[0].text.length).toBeLessThan(2_500);
  });

  it('passes through errors unchanged', () => {
    const err = { error: 'nope' };
    expect(compactToolResultForLlm('gmail_read', err)).toEqual(err);
  });
});
