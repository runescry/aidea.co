import { describe, expect, it } from 'vitest';
import { gmailMessageUrl, gmailMessageUrlFromEmail } from './message-url';

describe('gmailMessageUrl', () => {
  it('uses rfc822msgid search when Message-ID header is known', () => {
    expect(
      gmailMessageUrl('api-msg-id', {
        internetMessageId: 'abc123@mail.gmail.com',
        account: 'me@gmail.com',
      }),
    ).toBe(
      'https://mail.google.com/mail/?authuser=me%40gmail.com#search/rfc822msgid%3Aabc123%40mail.gmail.com',
    );
  });

  it('strips angle brackets from Message-ID header', () => {
    expect(
      gmailMessageUrl('api-msg-id', {
        internetMessageId: '<abc123@mail.gmail.com>',
        account: 'me@gmail.com',
      }),
    ).toContain('rfc822msgid%3Aabc123%40mail.gmail.com');
  });

  it('falls back to from+subject search when Message-ID is missing', () => {
    const url = gmailMessageUrl('19eda6f5b270bb31', {
      from: 'Consent2Go <noreply@xavier.vic.edu.au>',
      subject: 'Invitation for Sebastian',
      account: 'parent@gmail.com',
    });
    expect(url).toContain('authuser=parent%40gmail.com');
    expect(url).toContain('#search/');
    expect(url).toContain('from%3Anoreply%40xavier.vic.edu.au');
    expect(url).toContain('Invitation');
    expect(url).not.toContain('#all/');
  });

  it('falls back to account index when only api id is available', () => {
    expect(gmailMessageUrl('19eda6f5b270bb31', { accountIndex: 0 })).toBe(
      'https://mail.google.com/mail/u/0/#all/19eda6f5b270bb31',
    );
  });

  it('builds from cached email row with subject fallback', () => {
    const url = gmailMessageUrlFromEmail({
      id: 'msg-1',
      threadId: 'thread-1',
      account: 'z@example.com',
      subject: 'Year 1 Strings',
      from: 'school@genazzano.vic.edu.au',
    });
    expect(url).toContain('authuser=z%40example.com');
    expect(url).toContain('#search/');
    expect(url).toContain('Year+1+Strings');
  });
});
