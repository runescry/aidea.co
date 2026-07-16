import { describe, expect, it } from 'vitest';
import { gmailMessageUrl, gmailMessageUrlFromEmail } from './message-url';

describe('gmailMessageUrl', () => {
  it('opens thread in #all with authuser when account is known', () => {
    expect(
      gmailMessageUrl('msg-abc', { threadId: 'thread-xyz', account: 'me@gmail.com' }),
    ).toBe('https://mail.google.com/mail/?authuser=me%40gmail.com#all/thread-xyz');
  });

  it('falls back to message id and account index', () => {
    expect(gmailMessageUrl('19eda6f5b270bb31', { accountIndex: 0 })).toBe(
      'https://mail.google.com/mail/u/0/#all/19eda6f5b270bb31',
    );
  });

  it('builds from cached email row', () => {
    expect(
      gmailMessageUrlFromEmail({
        id: 'msg-1',
        threadId: 'thread-1',
        account: 'z@example.com',
      }),
    ).toContain('authuser=z%40example.com');
    expect(gmailMessageUrlFromEmail({
      id: 'msg-1',
      threadId: 'thread-1',
      account: 'z@example.com',
    })).toContain('#all/thread-1');
  });
});
