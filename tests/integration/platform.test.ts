import { describe, it, expect, afterAll } from 'vitest';
import { enqueueAction } from '@/lib/harness/queue';
import {
  isIntegrationRun,
  runChatScenarios,
  getAgents,
  postAgent,
  getTasks,
  patchQueue,
  postMessage,
  findAgentInGroups,
  assertHarnessCompleted,
} from './helpers';

const RUN = isIntegrationRun();
const TEST_AGENT = 'dispatcher';

describe.skipIf(!RUN)('platform integration', () => {
  describe('agent library', () => {
    const displayName = `QA-${Date.now()}`;

    afterAll(async () => {
      await postAgent({ agentId: TEST_AGENT, reset: true });
    });

    it('loads groups and tool catalog', async () => {
      const res = await getAgents();
      expect(res.status).toBe(200);

      const body = await res.json() as {
        groups: Array<{ id: string; agents: Array<{ id: string; displayName: string; hasCustomization: boolean }> }>;
        toolCatalog: Record<string, unknown>;
      };

      expect(body.groups.length).toBeGreaterThan(0);
      expect(Object.keys(body.toolCatalog).length).toBeGreaterThan(0);
      expect(findAgentInGroups(body, TEST_AGENT)).toBeDefined();
    });

    it('persists display name override round-trip', async () => {
      const save = await postAgent({ agentId: TEST_AGENT, displayName });
      expect(save.status).toBe(200);

      const saved = await save.json() as { ok: boolean; agent: { displayName: string } };
      expect(saved.ok).toBe(true);
      expect(saved.agent.displayName).toBe(displayName);

      const list = await getAgents();
      const body = await list.json() as {
        groups: Array<{ agents: Array<{ id: string; displayName: string; hasCustomization: boolean }> }>;
      };
      const agent = findAgentInGroups(body, TEST_AGENT);

      expect(agent?.displayName).toBe(displayName);
      expect(agent?.hasCustomization).toBe(true);
    });
  });

  describe('work feed & queue', () => {
    it('returns tasks with needsYou count', async () => {
      const res = await getTasks();
      expect(res.status).toBe(200);

      const body = await res.json() as { tasks: unknown[]; needsYou: number };
      expect(Array.isArray(body.tasks)).toBe(true);
      expect(typeof body.needsYou).toBe('number');
    });

    it('surfaces enqueued action and accepts reject PATCH', async () => {
      const action = await enqueueAction({
        type: 'generic',
        summary: '[integration] test action',
        agentRole: 'dispatcher',
        tool: 'queue_action',
        payload: {},
        priority: 'normal',
      });

      const before = await getTasks();
      const beforeBody = await before.json() as { tasks: Array<{ id: string }> };
      expect(beforeBody.tasks.some(t => t.id === `queue-${action.id}`)).toBe(true);

      const patch = await patchQueue({ id: action.id, status: 'rejected' });
      expect(patch.status).toBe(200);

      const patched = await patch.json() as { ok: boolean; action: { status: string } };
      expect(patched.ok).toBe(true);
      expect(patched.action.status).toBe('rejected');
    });
  });

  describe.skipIf(!runChatScenarios())('chat dispatch', () => {
    it('completes a short command without entity_error', async () => {
      const { res, events } = await postMessage('Reply with exactly the word OK and nothing else.');

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      expect(events.some(e => e.type === 'entity_started')).toBe(true);
      assertHarnessCompleted(events);
    }, 120_000);
  });
});
