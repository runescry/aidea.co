import { describe, expect, it } from 'vitest';
import { gmailMessageMetadataEndpoint } from './gmail';

describe('gmailMessageMetadataEndpoint', () => {
  it('repeats metadataHeaders in the query string for Gmail', () => {
    const url = gmailMessageMetadataEndpoint('abc123');
    expect(url).toContain('format=metadata');
    expect(url).toContain('metadataHeaders=From');
    expect(url).toContain('metadataHeaders=Subject');
    expect(url).toContain('/gmail/v1/users/me/messages/abc123?');
  });

  it('appends extra headers without duplicates', () => {
    const url = gmailMessageMetadataEndpoint('x', ['Message-ID', 'Subject']);
    expect(url.match(/metadataHeaders=Subject/g)?.length).toBe(1);
    expect(url).toContain('metadataHeaders=Message-ID');
  });
});
