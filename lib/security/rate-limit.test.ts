import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { enforceRateLimit, resetMemoryRateLimitsForTests } from './rate-limit';

describe('enforceRateLimit', () => {
  afterEach(() => resetMemoryRateLimitsForTests());

  it('allows requests through the limit and then returns 429', async () => {
    const request = () => new NextRequest('https://aidea.test/api/message', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    const options = { scope: 'test', limit: 2, windowMs: 60_000 };

    await expect(enforceRateLimit(request(), options)).resolves.toBeNull();
    await expect(enforceRateLimit(request(), options)).resolves.toBeNull();
    const blocked = await enforceRateLimit(request(), options);

    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('keeps callers isolated by address', async () => {
    const options = { scope: 'test-isolation', limit: 1, windowMs: 60_000 };
    const request = (address: string) => new NextRequest('https://aidea.test/api/message', {
      headers: { 'x-forwarded-for': address },
    });

    await expect(enforceRateLimit(request('203.0.113.10'), options)).resolves.toBeNull();
    await expect(enforceRateLimit(request('203.0.113.11'), options)).resolves.toBeNull();
  });
});

