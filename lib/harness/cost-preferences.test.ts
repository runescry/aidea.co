import { describe, expect, it } from 'vitest';
import {
  isTokenBudgetEnforced,
  resolveHarnessCostConfig,
  shouldApplyUserCostPrefs,
} from './cost-preferences';
import { dailyEntityConfig, inboxLiteEntityConfig } from '@/lib/entities/daily';
import { createCostTracker } from './cost';

describe('resolveHarnessCostConfig', () => {
  it('defaults interactive runs to unlimited when budget toggle is off', () => {
    const cfg = resolveHarnessCostConfig(dailyEntityConfig.costConfig, {}, true);
    expect(cfg.enforceRunBudget).toBe(false);
    expect(cfg.enforcePerAgentCaps).toBe(false);
  });

  it('does not enforce per-agent caps in standard mode', () => {
    const cfg = resolveHarnessCostConfig(
      dailyEntityConfig.costConfig,
      { enforceTokenBudget: true, costMode: 'standard' },
      true,
    );
    expect(cfg.enforceRunBudget).toBe(true);
    expect(cfg.enforcePerAgentCaps).toBe(false);
    expect(cfg.maxAgentTokensByRole).toBeUndefined();
  });

  it('applies strict role caps when user opts in', () => {
    const cfg = resolveHarnessCostConfig(
      dailyEntityConfig.costConfig,
      { enforceTokenBudget: true, costMode: 'strict' },
      true,
    );
    expect(cfg.enforcePerAgentCaps).toBe(true);
    expect(cfg.maxAgentTokensByRole?.['inbox-triage']).toBe(35_000);
  });

  it('skips user prefs for inbox cron lite', () => {
    expect(shouldApplyUserCostPrefs(inboxLiteEntityConfig, {})).toBe(false);
    const cfg = resolveHarnessCostConfig(
      inboxLiteEntityConfig.costConfig,
      { enforceTokenBudget: true, maxTokensPerRun: 200_000 },
      false,
    );
    expect(cfg.maxTokensPerRun).toBe(22_000);
    expect(cfg.enforceRunBudget).toBe(true);
    expect(cfg.enforcePerAgentCaps).toBe(false);
  });
});

describe('isTokenBudgetEnforced', () => {
  it('is false unless explicitly enabled', () => {
    expect(isTokenBudgetEnforced({})).toBe(false);
    expect(isTokenBudgetEnforced({ enforceTokenBudget: false })).toBe(false);
    expect(isTokenBudgetEnforced({ enforceTokenBudget: true })).toBe(true);
  });
});

describe('createCostTracker budget enforcement', () => {
  it('allows unlimited usage when run budget is disabled', () => {
    const cost = createCostTracker({
      maxTokensPerRun: 5_000,
      enforceRunBudget: false,
      enforcePerAgentCaps: false,
      maxAgentTokensByRole: { 'inbox-triage': 1_000 },
    });
    cost.recordUsage(100_000, 50_000, {
      agentId: 'a1',
      agentRole: 'inbox-triage',
      model: 'claude-haiku-4-5-20251001',
    });
    expect(cost.isOverBudget('a1', 'inbox-triage')).toBe(false);
  });

  it('allows one agent to exceed role cap when per-agent enforcement is off', () => {
    const cost = createCostTracker({
      maxTokensPerRun: 80_000,
      enforceRunBudget: true,
      enforcePerAgentCaps: false,
      maxAgentTokensByRole: { 'inbox-triage': 5_000 },
    });
    cost.recordUsage(20_000, 5_000, {
      agentId: 'a1',
      agentRole: 'inbox-triage',
      model: 'claude-haiku-4-5-20251001',
    });
    expect(cost.isOverBudget('a1', 'inbox-triage')).toBe(false);
  });
});
