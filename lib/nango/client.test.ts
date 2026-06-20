import { afterEach, describe, expect, it } from 'vitest';
import { nangoConfigured, nangoMisconfigMessage } from './client';

describe('nango client env', () => {
  const original = process.env.NANGO_SECRET_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.NANGO_SECRET_KEY;
    else process.env.NANGO_SECRET_KEY = original;
  });

  it('treats missing key as not configured', () => {
    delete process.env.NANGO_SECRET_KEY;
    expect(nangoConfigured()).toBe(false);
    expect(nangoMisconfigMessage()).toContain('not configured');
  });

  it('treats empty and whitespace-only keys as not configured', () => {
    process.env.NANGO_SECRET_KEY = '';
    expect(nangoConfigured()).toBe(false);
    expect(nangoMisconfigMessage()).toContain('empty');

    process.env.NANGO_SECRET_KEY = '   ';
    expect(nangoConfigured()).toBe(false);
    expect(nangoMisconfigMessage()).toContain('empty');
  });

  it('accepts a non-empty trimmed key', () => {
    process.env.NANGO_SECRET_KEY = '  sk-test-key  ';
    expect(nangoConfigured()).toBe(true);
  });
});
