import { describe, expect, it } from 'vitest';
import { runAgentHarness } from '@/lib/eval/run-agent-harness';
import { isIntegrationRun, hasValidLlmKey } from './helpers';

const RUN = isIntegrationRun();
const KB_FIXTURE = {
  identity: { name: 'Eval User', timezone: 'America/Los_Angeles' },
  life_context: {
    name: 'Eval User',
    currentFocus: 'Building eval harness',
    constraints: ['Limited time'],
  },
};

describe.skipIf(!RUN || !hasValidLlmKey())('agent harness eval (dry-run)', () => {
  it('inbox-triage completes with tools and validation', async () => {
    const result = await runAgentHarness({
      agentId: 'inbox-triage',
      mission: 'Triage unread inbox and surface urgent items.',
      realWorldMode: 'dry-run',
      kbFixture: KB_FIXTURE,
    });

    expect(result.response.length).toBeGreaterThan(0);
    expect(result.toolsCalled).toContain('gmail_read');
    expect(result.toolsCalled).toContain('write_state');
    expect(result.validation.ok, result.validation.errors.join('; ')).toBe(true);
    expect(result.toolCalls.some(t => t.name === 'gmail_read')).toBe(true);
  }, 180_000);

  it('finance-director completes with write_state output', async () => {
    const result = await runAgentHarness({
      agentId: 'finance-director',
      mission: 'Analyse financial situation and produce a 12-month money plan.',
      realWorldMode: 'dry-run',
      kbFixture: KB_FIXTURE,
    });

    expect(result.response.length).toBeGreaterThan(0);
    expect(result.toolsCalled).toContain('write_state');
    expect(result.validation.ok, result.validation.errors.join('; ')).toBe(true);
    expect(result.structured).toBeTruthy();
  }, 180_000);

  it('mental-health-director completes with write_state output', async () => {
    const result = await runAgentHarness({
      agentId: 'mental-health-director',
      mission: 'Audit stress levels and define psychological non-negotiables.',
      realWorldMode: 'dry-run',
      kbFixture: KB_FIXTURE,
    });

    expect(result.response.length).toBeGreaterThan(0);
    expect(result.toolsCalled).toContain('write_state');
    expect(result.validation.ok, result.validation.errors.join('; ')).toBe(true);
    expect(result.structured).toBeTruthy();
  }, 180_000);
});
