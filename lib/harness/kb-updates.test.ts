import { describe, expect, it } from 'vitest';
import {
  describeKbUpdate,
  kbPatchInputFromPayload,
  normalizeKbPatchInput,
  sanitizeQueueSummary,
  formatKbPatchSummary,
} from './kb-update-display';

const LEAKED_SUMMARY =
  'Vercel SA role — interview scheduling in progress", <parameter name="jobApplication">{ "company": "Vercel", "status": "In progress — interview scheduling", "nextAction": "Confirm availability with Cassidy and Camden", "priority": 2 }';

describe('normalizeKbPatchInput', () => {
  it('extracts jobApplication from XML parameter leaks in summary', () => {
    const normalized = normalizeKbPatchInput({ summary: LEAKED_SUMMARY });
    expect(normalized.jobApplication).toMatchObject({
      company: 'Vercel',
      status: 'In progress — interview scheduling',
      nextAction: 'Confirm availability with Cassidy and Camden',
    });
  });
});

describe('sanitizeQueueSummary', () => {
  it('returns a readable title from malformed agent summary', () => {
    expect(sanitizeQueueSummary(LEAKED_SUMMARY)).toBe(
      'Vercel → In progress — interview scheduling (Confirm availability with Cassidy and Camden)',
    );
  });

  it('strips trailing JSON from plain summaries', () => {
    expect(sanitizeQueueSummary('Update role", { "company": "Acme" }')).toBe('Acme');
  });
});

describe('kbPatchInputFromPayload', () => {
  it('prefers structured input over legacy full-profile patch blobs', () => {
    const input = kbPatchInputFromPayload({
      input: { jobApplication: { company: 'Vercel', status: 'Interviewing' } },
      patch: { work: { role: 'Founder', currentProjects: { jobApplications: [] } } },
    });
    expect(input?.jobApplication?.company).toBe('Vercel');
  });
});

describe('describeKbUpdate', () => {
  it('describes the profile change in plain language', () => {
    const text = describeKbUpdate({
      summary: LEAKED_SUMMARY,
      detail: 'Cassidy requesting interview availability',
      payload: {
        input: {
          jobApplication: {
            company: 'Vercel',
            status: 'In progress — interview scheduling',
            nextAction: 'Confirm availability with Cassidy and Camden',
          },
        },
      },
    });

    expect(text).toContain('Company: Vercel');
    expect(text).toContain('Confirm availability with Cassidy and Camden');
    expect(text).not.toContain('<parameter');
  });
});

describe('formatKbPatchSummary', () => {
  it('formats structured job application patches', () => {
    expect(formatKbPatchSummary({
      jobApplication: { company: 'Vercel', status: 'Offer received' },
    })).toBe('Vercel → Offer received');
  });
});
