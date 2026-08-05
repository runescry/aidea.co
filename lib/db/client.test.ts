import { afterEach, describe, expect, it } from 'vitest';
import { databasePoolMax, getDatabaseUrl, hasDatabase } from './client';

describe('database client env', () => {
  const originalUrl = process.env.DATABASE_URL;
  const originalPoolMax = process.env.DATABASE_POOL_MAX;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (originalPoolMax === undefined) delete process.env.DATABASE_POOL_MAX;
    else process.env.DATABASE_POOL_MAX = originalPoolMax;
  });

  it('detects configured database urls', () => {
    delete process.env.DATABASE_URL;
    expect(hasDatabase()).toBe(false);
    process.env.DATABASE_URL = 'postgres://example';
    expect(getDatabaseUrl()).toBe('postgres://example');
    expect(hasDatabase()).toBe(true);
  });

  it('uses a small bounded pool for concurrent route reads', () => {
    delete process.env.DATABASE_POOL_MAX;
    expect(databasePoolMax()).toBe(3);
    process.env.DATABASE_POOL_MAX = '7';
    expect(databasePoolMax()).toBe(7);
    process.env.DATABASE_POOL_MAX = '0';
    expect(databasePoolMax()).toBe(1);
    process.env.DATABASE_POOL_MAX = '50';
    expect(databasePoolMax()).toBe(10);
    process.env.DATABASE_POOL_MAX = 'nope';
    expect(databasePoolMax()).toBe(3);
  });
});
