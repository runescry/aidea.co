import { describe, expect, it } from 'vitest';
import {
  decodeBase64Url,
  extractBodyFromPayload,
  stripHtmlTags,
  type GmailMessagePayload,
} from './gmail-body';

function b64(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

describe('decodeBase64Url', () => {
  it('decodes Gmail-style base64url', () => {
    expect(decodeBase64Url(b64('Hello, inbox!'))).toBe('Hello, inbox!');
  });

  it('handles padding', () => {
    expect(decodeBase64Url('SGVsbG8')).toBe('Hello');
  });
});

describe('stripHtmlTags', () => {
  it('removes tags and collapses whitespace', () => {
    const html = '<p>Hello <b>world</b></p><script>alert(1)</script>';
    expect(stripHtmlTags(html)).toBe('Hello world');
  });
});

describe('extractBodyFromPayload', () => {
  it('prefers text/plain over text/html', () => {
    const payload: GmailMessagePayload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64('Plain body text') } },
        { mimeType: 'text/html', body: { data: b64('<p>HTML body</p>') } },
      ],
    };
    const { text, truncated } = extractBodyFromPayload(payload);
    expect(text).toBe('Plain body text');
    expect(truncated).toBe(false);
  });

  it('falls back to stripped HTML when no plain text', () => {
    const payload: GmailMessagePayload = {
      mimeType: 'text/html',
      body: { data: b64('<div>Only <em>HTML</em> here</div>') },
    };
    expect(extractBodyFromPayload(payload).text).toBe('Only HTML here');
  });

  it('walks nested multipart trees', () => {
    const payload: GmailMessagePayload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64('Nested plain') } },
          ],
        },
        {
          mimeType: 'application/pdf',
          filename: 'report.pdf',
          body: { size: 1024 },
        } as GmailMessagePayload,
      ],
    };
    expect(extractBodyFromPayload(payload).text).toBe('Nested plain');
  });

  it('caps body at 12k chars', () => {
    const long = 'x'.repeat(15_000);
    const payload: GmailMessagePayload = {
      mimeType: 'text/plain',
      body: { data: b64(long) },
    };
    const { text, truncated } = extractBodyFromPayload(payload);
    expect(text.length).toBe(12_000);
    expect(truncated).toBe(true);
  });
});
