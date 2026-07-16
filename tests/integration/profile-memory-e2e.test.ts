import { describe, it, expect } from 'vitest';
import { buildVisibleContactGraph } from '@/lib/contacts/interaction-graph';
import { recordContactInteraction } from '@/lib/contacts/interaction-graph-persist';
import { enqueueAction } from '@/lib/harness/queue';
import { filterDismissedPulse } from '@/lib/profile/memory-hygiene';
import { findPersonByKey } from '@/lib/profile/people';
import type { KnowledgeBase } from '@/types/knowledge-base';
import {
  appendMemoryHygieneDismiss,
  e2ePersonEmail,
  findE2ePerson,
  getKbJson,
  isE2ePersonBlocked,
  readKbState,
  seedE2ePerson,
  setE2ePersonStatus,
} from './profile-e2e-helpers';
import { getKb, isIntegrationRun, patchQueue } from './helpers';

const RUN = isIntegrationRun();

describe.skipIf(!RUN)('profile memory e2e', () => {
  describe.sequential('people store + queue hygiene', () => {
    const runId = Date.now();
    let personId: string;

    it('GET /api/kb returns profile with relationships', async () => {
      const res = await getKb();
      expect(res.status).toBe(200);
      const kb = await res.json() as KnowledgeBase;
      expect(kb).toBeTypeOf('object');
      expect(kb.relationships).toBeDefined();
    });

    it('seeds an active person into relationships.people', async () => {
      const person = await seedE2ePerson(runId);
      personId = person.id;
      expect(person.status).toBe('active');
      expect(person.email).toBe(e2ePersonEmail(runId));

      const kb = await getKbJson();
      const found = findE2ePerson(kb, runId);
      expect(found?.id).toBe(personId);
      expect(found?.status).toBe('active');
    });

    it('archives and restores the person', async () => {
      await setE2ePersonStatus(personId, 'archived');
      let kb = await readKbState();
      expect(findE2ePerson(kb, runId)?.status).toBe('archived');
      expect(buildVisibleContactGraph(kb).some(e => e.id === personId)).toBe(false);

      await setE2ePersonStatus(personId, 'active');
      kb = await readKbState();
      expect(findE2ePerson(kb, runId)?.status).toBe('active');
      expect(buildVisibleContactGraph(kb).some(e => e.id === personId)).toBe(true);
    });

    it('removes person and blocks sync re-ingest', async () => {
      await setE2ePersonStatus(personId, 'removed');
      const kb = await readKbState();
      expect(findE2ePerson(kb, runId)?.status).toBe('removed');
      expect(isE2ePersonBlocked(kb, runId)).toBe(true);
      expect(kb.relationships?.removedKeys).toContain(e2ePersonEmail(runId));

      const blocked = await recordContactInteraction({
        name: `E2E Person ${runId}`,
        email: e2ePersonEmail(runId),
        channel: 'email',
        summary: 'Should be blocked',
      });
      expect(blocked).toEqual({ ok: false, blocked: true });
    });

    it('approves kb_update person patch from queue (round-trip payload)', async () => {
      await seedE2ePerson(`${runId}-approve`);
      const email = e2ePersonEmail(`${runId}-approve`);
      const name = `E2E Person ${runId}-approve`;

      const action = await enqueueAction({
        type: 'kb_update',
        summary: `${name} → removed`,
        agentRole: 'integration-e2e',
        tool: 'update_kb',
        payload: {
          input: { person: { name, email, status: 'removed' as const } },
        },
        priority: 'normal',
      });

      const patch = await patchQueue({ id: action.id, intent: 'approve' });
      expect(patch.status).toBe(200);
      const body = await patch.json() as { ok: boolean; action: { status: string } };
      expect(body.ok).toBe(true);
      expect(body.action.status).toBe('executed');

      const kb = await readKbState();
      expect(findPersonByKey(kb, e2ePersonEmail(`${runId}-approve`))?.status).toBe('removed');
    });

    it('rejects kb_update and records rejectedKbPatches', async () => {
      const action = await enqueueAction({
        type: 'kb_update',
        summary: 'Add fake mentor Bob',
        agentRole: 'dispatcher',
        tool: 'update_kb',
        payload: {
          input: { person: { name: 'Bob Fake', email: `bob-${runId}@test.local`, relationship: 'mentor' } },
        },
        priority: 'normal',
      });

      const patch = await patchQueue({ id: action.id, intent: 'reject' });
      expect(patch.status).toBe(200);

      const kb = await readKbState();
      const rejected = kb.preferences?.memoryHygiene?.rejectedKbPatches ?? [];
      expect(rejected.some(r => r.summary === 'Add fake mentor Bob')).toBe(true);
    });

    it('persists pulse dismiss and filters pulse band', async () => {
      const pulseId = `e2e-pulse-${runId}`;
      await appendMemoryHygieneDismiss(pulseId);

      const kb = await getKbJson();
      expect(kb.preferences?.memoryHygiene?.dismissedPulseIds).toContain(pulseId);

      const filtered = filterDismissedPulse(
        [{ id: pulseId, kind: 'change', at: new Date().toISOString(), title: 'Hidden' }],
        kb,
      );
      expect(filtered).toHaveLength(0);
    });
  });
});
