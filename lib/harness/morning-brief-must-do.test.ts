import { describe, expect, it } from 'vitest';
import {
  finalizeMustDoList,
  inferHeadlineFromSnippet,
  mustDoHeadline,
  normalizeMorningBrief,
  normalizeMustDoItem,
} from './morning-brief-must-do';

describe('morning-brief-must-do', () => {
  it('prefers subject over body snippet for headline', () => {
    expect(mustDoHeadline({
      subject: 'Confirm your phone number',
      action: 'Hi Marcus Thank you – can you provide your telephone number',
      snippet: 'Hi Marcus Thank you – can you provide your telephone number',
    })).toBe('Confirm your phone number');
  });

  it('strips greeting when subject is missing', () => {
    expect(inferHeadlineFromSnippet(
      'Hey Marcus, Great news, we are keen to make you an offer to join us in Australia!',
    )).toContain('Great news');
  });

  it('extracts school notification title from snippet', () => {
    expect(inferHeadlineFromSnippet(
      'Hi Marcus, Genazzano FCJ College posted Save the date for the Music Event of the Year | Biennial Music Concert',
    )).toContain('Save the date');
  });

  it('adds school context from sender', () => {
    const item = normalizeMustDoItem({
      subject: 'Save the date for the Music Event',
      from: 'Genazzano FCJ College',
      messageId: 'g1',
      threadId: 't1',
      account: 'parent@gmail.com',
    });
    expect(item.context).toBe('Genazzano · Ivy');
    expect(String(item.gmailUrl)).toContain('authuser=parent%40gmail.com');
    expect(String(item.gmailUrl)).toContain('#all/t1');
  });

  it('drops vague summaries when linked emails exist', () => {
    const out = finalizeMustDoList([
      {
        action: 'One school event notification — save-the-date for August 10 concert',
        source: 'email',
        priority: 1,
      },
      {
        subject: 'Save the date for the Music Event',
        action: '',
        detail: 'Genazzano FCJ College posted Save the date for the Music Event',
        messageId: 'g1',
        threadId: 't1',
        from: 'Genazzano FCJ College',
        priority: 2,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.action).toContain('Save the date');
  });

  it('normalizes stored brief mustDo with inferred headline', () => {
    const brief = normalizeMorningBrief({
      date: '2026-06-25',
      mustDo: [
        {
          action: '',
          snippet: 'Please confirm your phone number',
          subject: 'Gateley — phone confirmation',
          messageId: 'a1',
          gmailUrl: 'https://mail.google.com/mail/u/0/#inbox/a1',
        },
      ],
    });
    expect((brief.mustDo as Array<{ action: string }>)[0]?.action).toBe('Gateley — phone confirmation');
  });
});
