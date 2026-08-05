import { describe, expect, it } from 'vitest';
import {
  fallbackHeadlineFromSnippet,
  finalizeMustDoList,
  inferHeadlineFromSnippet,
  mustDoCardLines,
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

  it('uses permissive fallback when subject is missing', () => {
    expect(fallbackHeadlineFromSnippet(
      'Hey Marcus, Great news, we are keen to make you an offer to join us in Australia!',
    )).toContain('Great news');
    expect(fallbackHeadlineFromSnippet(
      'Hi Marcus Thank you – can you provide your telephone number please. Kind regards Leonie Spragg Office Manager',
    )).toContain('telephone number');
  });

  it('splits subject/sender from action subline for card display', () => {
    const lines = mustDoCardLines({
      subject: 'RE: Phone confirmation',
      from: 'Leonie Spragg <office@gateley.com>',
      snippet: 'Hi Marcus Thank you – can you provide your telephone number please.',
    });
    expect(lines.title).toBe('RE: Phone confirmation');
    expect(lines.sender).toContain('Leonie Spragg');
    expect(lines.subline).toContain('telephone number');
  });

  it('uses sender as title when subject is missing', () => {
    const lines = mustDoCardLines({
      from: 'Recruiter <jobs@example.com>',
      snippet: 'Hey Marcus, Great news, we are keen to make you an offer to join us in Australia!',
    });
    expect(lines.title).toContain('Recruiter');
    expect(lines.subline).toContain('Great news');
  });

  it('extracts school notification title from snippet', () => {
    expect(inferHeadlineFromSnippet(
      'Hi Marcus, Genazzano FCJ College posted Save the date for the Music Event of the Year | Biennial Music Concert',
    )).toContain('Save the date');
  });

  it('adds school context from sender domain', () => {
    const item = normalizeMustDoItem({
      subject: 'Save the date for the Music Event',
      from: 'Genazzano FCJ College <office@genazzano.vic.edu.au>',
      messageId: 'g1',
      threadId: 't1',
      account: 'parent@gmail.com',
    });
    expect(item.context).toBe('Genazzano FCJ College · Ivy');
    expect(String(item.gmailUrl)).toContain('/mail/u/parent%40gmail.com/');
    expect(String(item.gmailUrl)).toContain('#search/');
    expect(String(item.gmailUrl)).toContain('Save+the+date');
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

  it('normalizes stored brief mustDo with subject and action subline', () => {
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
    const row = (brief.mustDo as Array<{ action: string; subject?: string }>)[0];
    expect(row?.subject).toBe('Gateley — phone confirmation');
    expect(row?.action).toBe('Please confirm your phone number');
  });
});
