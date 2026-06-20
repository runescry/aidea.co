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
});
