import { describe, expect, it } from 'vitest';
import { sanitizeInboxTriage, sanitizeTriageItem } from './inbox-sanitize';

const cache = new Map([
  ['msg-gen', {
    id: 'msg-gen',
    from: 'Genazzano FCJ College <office@genazzano.vic.edu.au>',
    subject: 'Home learning satchels — reminder',
    snippet: 'Reminder for Ivy families about home learning satchels collection next week.',
  }],
  ['msg-vercel', {
    id: 'msg-vercel',
    from: 'Vercel (Camden/Cassidy)',
    subject: 'Interview availability request – Solutions Architect Track B',
    snippet: 'Please share your availability for the next interview round.',
  }],
]);

describe('sanitizeTriageItem', () => {
  it('keeps accurate summaries tied to messageId', () => {
    const item = sanitizeTriageItem({
      messageId: 'msg-vercel',
      from: 'Vercel',
      subject: 'Interview availability request – Solutions Architect Track B',
      reason: 'Tracked job application; needs availability reply',
      action: 'Reply with times',
    }, cache);

    expect(item.from).toContain('Vercel');
    expect(item.reason).toContain('Tracked job');
    expect(item.attributionWarning).toBeUndefined();
  });

  it('resets reason when child names are hallucinated onto wrong school email', () => {
    const item = sanitizeTriageItem({
      messageId: 'msg-gen',
      from: 'Genazzano FCJ College',
      subject: 'Home learning satchels — reminder',
      reason: 'Sebastian and Xavier need satchels packed for PE this week',
      action: 'Pack satchels tonight',
    }, cache);

    expect(item.reason).toContain('Ivy');
    expect(item.attributionWarning).toBeTruthy();
    expect(String(item.reason)).not.toMatch(/sebastian/i);
  });

  it('matches by subject when messageId missing', () => {
    const item = sanitizeTriageItem({
      subject: 'Home learning satchels — reminder',
      reason: 'Wrong child names Sebastian',
      action: 'Do something',
    }, cache);

    expect(item.messageId).toBe('msg-gen');
    expect(item.snippet).toContain('Ivy');
  });

  it('uses bodyText for attribution when present', () => {
    const bodyCache = new Map([
      ['msg-body', {
        id: 'msg-body',
        from: 'Broker <broker@example.com>',
        subject: 'Finance approval',
        snippet: 'See attached.',
        bodyText: 'Your finance approval is confirmed for settlement on 15 July.',
      }],
    ]);

    const item = sanitizeTriageItem({
      messageId: 'msg-body',
      reason: 'Finance approval confirmed for 15 July settlement',
      action: 'Confirm settlement date',
    }, bodyCache);

    expect(item.attributionWarning).toBeUndefined();
  });

  it('includes attachment excerpt in attribution checks', () => {
    const emailCache = new Map([
      ['msg-att', {
        id: 'msg-att',
        from: 'Broker',
        subject: 'Documents attached',
        snippet: 'Please review.',
      }],
    ]);
    const attachmentCache = new Map([
      ['msg-att', { text: 'Settlement date: 15 July. Amount: $1.2M', filenames: ['stmt.pdf'] }],
    ]);

    const item = sanitizeTriageItem({
      messageId: 'msg-att',
      reason: 'Settlement on 15 July per attached statement',
      action: 'Review',
    }, emailCache, attachmentCache);

    expect(item.attributionWarning).toBeUndefined();
  });
});

describe('sanitizeInboxTriage', () => {
  it('sanitizes all lists', () => {
    const out = sanitizeInboxTriage({
      actionRequired: [{
        messageId: 'msg-gen',
        reason: 'Sebastian satchel notice',
        action: 'Pack bag',
      }],
    }, cache);

    expect(out.actionRequired?.[0]).toMatchObject({
      messageId: 'msg-gen',
      attributionWarning: expect.any(String),
    });
  });

  it('sanitize keeps triage rows; must-do filter is applied at brief assembly', () => {
    const recentCache = new Map([
      ['recent-1', {
        id: 'recent-1',
        from: 'Zoe <z@example.com>',
        subject: 'Fwd: company setup',
        snippet: 'See below',
        date: 'Mon, 22 Jun 2026 09:00:00 +1000',
        bodyText: 'Begin forwarded message:\nDate: 29 June 2020 at 22:21:57 SGT\nSubject: Re: set up of company',
      }],
    ]);

    const out = sanitizeInboxTriage({
      urgent: [
        { messageId: 'recent-1', reason: 'Begin forwarded message: Date: 29 June 2020', action: 'Reply' },
        { subject: 'Invented row with no id', action: 'Do something' },
      ],
    }, recentCache);

    expect(out.urgent).toHaveLength(2);
  });
});
