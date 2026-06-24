import { describe, expect, it } from 'vitest';
import {
  dailyEntityConfig,
  dailyLiteEntityConfig,
  inboxLiteEntityConfig,
  isDailyLiteMode,
  resolveDailyEntityConfig,
} from './daily';

describe('isDailyLiteMode', () => {
  it('returns true when mode is lite', () => {
    expect(isDailyLiteMode({ mode: 'lite' })).toBe(true);
  });

  it('returns true when lite flag is set', () => {
    expect(isDailyLiteMode({ lite: true })).toBe(true);
  });

  it('returns false for full or empty input', () => {
    expect(isDailyLiteMode({ mode: 'full' })).toBe(false);
    expect(isDailyLiteMode({})).toBe(false);
  });
});

describe('resolveDailyEntityConfig', () => {
  it('returns full daily config by default', () => {
    const config = resolveDailyEntityConfig({});
    expect(config.rootAgentId).toBe('daily-orchestrator');
    expect(config.agentIds).toHaveLength(6);
  });

  it('returns lite config when mode is lite', () => {
    const config = resolveDailyEntityConfig({ mode: 'lite' });
    expect(config).toBe(dailyLiteEntityConfig);
    expect(config.rootAgentId).toBe('daily-lite-briefer');
    expect(config.agentIds).toEqual(['daily-lite-briefer']);
    expect(config.costConfig?.maxAgentsPerRun).toBe(1);
  });

  it('keeps full orchestrator config when mode is full', () => {
    expect(dailyEntityConfig.rootAgentId).toBe('daily-orchestrator');
    expect(resolveDailyEntityConfig({ mode: 'full' })).toBe(dailyEntityConfig);
  });
});

describe('inboxLiteEntityConfig', () => {
  it('limits tools and token budget for cron triage', () => {
    expect(inboxLiteEntityConfig.inboxTriageMode).toBe('lite');
    expect(inboxLiteEntityConfig.availableTools).not.toContain('queue_action');
    expect(inboxLiteEntityConfig.availableTools).not.toContain('gmail_attachment_read');
    expect(inboxLiteEntityConfig.costConfig?.maxTokensPerRun).toBeLessThanOrEqual(25_000);
  });
});
