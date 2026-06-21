import { describe, expect, it, beforeAll } from 'vitest';
import { enqueueAction, listActions } from '@/lib/harness/queue';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { readCalendarEvents } from '@/lib/nango/calendar';
import { runInboxTriageHarness } from '@/lib/harness/inbox-triage-harness';
import type { QueuedAction } from '@/lib/harness/queue-types';
import { hasValidLlmKey } from './helpers';
import { patchQueue } from './helpers';
import {
  buildE2eEmailBody,
  e2ePrerequisiteReason,
  generateE2eSubject,
  hasCalendarConnection,
  isE2eRun,
  sendE2eTestEmail,
  triageMissionForSubject,
  waitForE2eEmail,
} from './e2e-gmail';
import type { KnowledgeBase } from '@/types/knowledge-base';
import { nangoConfigured } from '@/lib/nango/client';

const RUN = isE2eRun();

describe.skipIf(!RUN || !hasValidLlmKey() || !nangoConfigured())('inbox approve e2e', () => {
  describe.sequential('inbox approve e2e steps', () => {
  let skipReason: string | undefined;
  let subject: string;
  let gmailMessageId: string;
  let gmailConnectionId: string;
  let gmailTo: string;
  let replyAction: QueuedAction | undefined;

  beforeAll(async () => {
    skipReason = await e2ePrerequisiteReason();
  });

  it('sends a test email to the connected Gmail account', async () => {
    if (skipReason) return console.warn(`[e2e skip] ${skipReason}`);

    subject = generateE2eSubject();
    const body = buildE2eEmailBody(subject);
    const sent = await sendE2eTestEmail(subject, body);

    expect(sent.messageId).toBeTruthy();
    expect(sent.to).toMatch(/@/);
    gmailMessageId = sent.messageId;
    gmailConnectionId = sent.connectionId;
    gmailTo = sent.to;
  }, 60_000);

  it('waits for delivery and runs inbox triage on the test email', async () => {
    if (skipReason) return;

    const delivered = await waitForE2eEmail(subject, {
      knownMessageId: gmailMessageId,
      connectionId: gmailConnectionId,
    });
    expect(delivered.id).toBeTruthy();
    gmailMessageId = delivered.id;
    gmailConnectionId = delivered.connectionId;

    const result = await runInboxTriageHarness({
      realWorldMode: 'auto',
      mission: triageMissionForSubject(subject, gmailMessageId, gmailConnectionId, gmailTo),
    });

    expect(result.events.some(e => e.type === 'entity_complete')).toBe(true);

    const pending = await listActions({ status: 'pending' });
    replyAction = pending.find(action => {
      if (action.type !== 'email_reply') return false;
      const payload = action.payload ?? {};
      const replyId = String(payload.replyToMessageId ?? payload.messageId ?? '');
      return replyId === gmailMessageId;
    });

    if (!replyAction) {
      replyAction = pending.find(
        a => a.type === 'email_reply' && a.summary.toLowerCase().includes('e2e'),
      );
    }

    expect(
      replyAction,
      `Expected email_reply queue item for message ${gmailMessageId}. Pending: ${pending.map(a => `${a.type}:${a.summary}`).join('; ') || '(none)'}`,
    ).toBeDefined();
  }, 360_000);

  it('approves email_reply and executes Gmail send', async () => {
    if (skipReason) return;
    expect(replyAction?.id).toBeTruthy();

    const res = await patchQueue({ id: replyAction!.id, intent: 'approve' });
    expect(res.status).toBe(200);

    const body = await res.json() as { ok: boolean; action: QueuedAction };
    expect(body.ok).toBe(true);
    expect(body.action.status).toBe('executed');
    expect(body.action.type).toBe('email_reply');
  }, 120_000);

  it('approves seeded calendar_event against Google Calendar', async () => {
    if (skipReason) return;
    if (!(await hasCalendarConnection())) {
      return console.warn('[e2e skip] Google Calendar not connected — skipping calendar approve execute');
    }

    const calTitle = `aidea-e2e-cal-${Date.now()}`;
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);

    const seeded = await enqueueAction({
      type: 'calendar_event',
      summary: `Calendar: ${calTitle}`,
      agentRole: 'integration-e2e',
      tool: 'calendar_create',
      payload: {
        title: calTitle,
        start: start.toISOString(),
        durationMinutes: 30,
        description: 'aidea integration e2e — safe to delete',
      },
      priority: 'normal',
    });

    const res = await patchQueue({ id: seeded.id, intent: 'approve' });
    expect(res.status).toBe(200);

    const body = await res.json() as { ok: boolean; action: QueuedAction };
    expect(body.ok).toBe(true);
    expect(body.action.status).toBe('executed');

    const dateYmd = start.toISOString().slice(0, 10);
    const calendar = await readCalendarEvents({ date: dateYmd, daysAhead: 2, maxResults: 50 });
    expect(calendar.events.some(e => e.title === calTitle)).toBe(true);
  }, 120_000);

  it('approves seeded kb_update into profile', async () => {
    if (skipReason) return;

    const company = `AideaE2E-${Date.now()}`;
    const seeded = await enqueueAction({
      type: 'kb_update',
      summary: `${company} → Interviewing`,
      agentRole: 'integration-e2e',
      tool: 'update_kb',
      payload: {
        input: {
          jobApplication: {
            company,
            status: 'Interviewing',
            nextAction: 'E2E verify approve execute',
          },
        },
      },
      priority: 'normal',
    });

    const res = await patchQueue({ id: seeded.id, intent: 'approve' });
    expect(res.status).toBe(200);

    const body = await res.json() as { ok: boolean; action: QueuedAction };
    expect(body.ok).toBe(true);
    expect(body.action.status).toBe('executed');

    const kb = await readAllKB() as KnowledgeBase;
    const projects = kb.work?.currentProjects;
    const jobs = projects && !Array.isArray(projects) ? projects.jobApplications ?? [] : [];
    const match = jobs.find((j: { company?: string; status?: string }) => j.company === company);
    expect(match?.status).toBe('Interviewing');
  }, 60_000);
  });
});
