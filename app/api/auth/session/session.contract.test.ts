import { describe, expect, it } from 'vitest';
import { DELETE, GET, POST } from './route';

describe('/api/auth/session', () => {
  it('returns the fallback session shape when no request cookie is available', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json() as { userId: string; mode: string; authenticated: boolean };
    expect(body).toEqual({
      userId: process.env.DEFAULT_USER_ID ?? 'default',
      mode: 'default',
      authenticated: false,
    });
  });

  it('clears the session when logging out', async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('rejects unsupported session modes', async () => {
    const res = await POST(new Request('http://localhost/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ mode: 'github' }),
    }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'mode must be google or demo' });
  });
});
