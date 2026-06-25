import { describe, expect, it } from 'vitest';
import { finalizeMustDoList, normalizeMorningBrief, normalizeMustDoItem } from './morning-brief-must-do';

describe('morning-brief-must-do', () => {
  it('uses snippet when action and subject are empty', () => {
    const item = normalizeMustDoItem({
      action: '',
      subject: '',
      snippet: 'Hey Marcus, Great news, we are keen to make you an offer to join us in Australia!',
      from: 'Recruiter <jobs@example.com>',
      messageId: 'm1',
      gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/m1',
    });
    expect(item.action).toContain('Great news');
    expect(item.context).toBe('Recruiter <jobs@example.com>');
  });

  it('adds school context from sender', () => {
    const item = normalizeMustDoItem({
      action: 'Save the date for the Music Event',
      from: 'Genazzano FCJ College',
      messageId: 'g1',
    });
    expect(item.context).toBe('Genazzano · Ivy');
  });

  it('drops vague summaries when linked emails exist', () => {
    const out = finalizeMustDoList([
      {
        action: 'One school event notification — save-the-date for August 10 concert',
        source: 'email',
        priority: 1,
      },
      {
        action: '',
        detail: 'Genazzano FCJ College posted Save the date for the Music Event',
        messageId: 'g1',
        gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/g1',
        from: 'Genazzano FCJ College',
        priority: 2,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.action).toContain('Save the date');
    expect(out[0]?.context).toBe('Genazzano · Ivy');
  });

  it('normalizes stored brief mustDo', () => {
    const brief = normalizeMorningBrief({
      date: '2026-06-25',
      mustDo: [
        { action: '', snippet: 'Please confirm your phone number', messageId: 'a1', gmailUrl: 'https://x/a1' },
      ],
    });
    expect((brief.mustDo as Array<{ action: string }>)[0]?.action).toContain('Please confirm');
  });
});
