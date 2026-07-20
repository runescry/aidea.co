import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, POST } from './route';
import { redactProfileSecrets } from '@/lib/api/redact-profile';
import { readAllKB, writeManyKB } from '@/lib/harness/knowledge-base';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('GET/POST /api/kb', () => {
  let snapshot: KnowledgeBase | null = null;

  beforeEach(async () => {
    snapshot = await readAllKB() as KnowledgeBase;
  });

  afterEach(async () => {
    if (snapshot) {
      await writeManyKB(snapshot as Record<string, unknown>);
    }
  });

  it('GET returns 200 with profile JSON', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as KnowledgeBase;
    expect(body).toBeTypeOf('object');
  });

  it('redacts integration credentials from profile responses', () => {
    expect(redactProfileSecrets({
      integrations: {
        strava: { athleteId: 42, accessToken: 'access-secret', refreshToken: 'refresh-secret' },
      },
    })).toEqual({ integrations: { strava: { athleteId: 42 } } });
  });

  it('POST merges updates and returns ok', async () => {
    const res = await POST(new Request('http://localhost/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: {
          goals: { currentChapter: 'contract-test-chapter' },
        },
      }),
    }) as import('next/server').NextRequest);

    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    const kb = await readAllKB() as KnowledgeBase;
    expect(kb.goals?.currentChapter).toBe('contract-test-chapter');
  });

  it('POST returns 400 when body has neither key nor updates', async () => {
    const res = await POST(new Request('http://localhost/api/kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) as import('next/server').NextRequest);

    expect(res.status).toBe(400);
  });
});
