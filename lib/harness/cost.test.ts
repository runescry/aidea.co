import { describe, expect, it } from 'vitest';
import { createCostTracker } from './cost';

describe('createCostTracker', () => {
  it('tracks per-agent usage and enforces role caps', () => {
    const cost = createCostTracker({
      maxTokensPerRun: 50_000,
      maxTokensPerAgent: 10_000,
      maxAgentTokensByRole: { 'inbox-triage': 12_000 },
    });

    cost.recordUsage(8_000, 2_000, {
      agentId: 'a1',
      agentRole: 'inbox-triage',
      model: 'claude-haiku-4-5-20251001',
    });

    expect(cost.isOverBudget('a1', 'inbox-triage')).toBe(false);

    cost.recordUsage(2_500, 500, {
      agentId: 'a1',
      agentRole: 'inbox-triage',
      model: 'claude-haiku-4-5-20251001',
    });

    expect(cost.isOverBudget('a1', 'inbox-triage')).toBe(true);
    expect(cost.isOverBudget('a2', 'calendar-reader')).toBe(false);
  });

  it('stops run when shared pool is exhausted', () => {
    const cost = createCostTracker({ maxTokensPerRun: 5_000 });
    cost.recordUsage(4_000, 1_500, { agentId: 'x', agentRole: 'test', model: 'claude-haiku-4-5-20251001' });
    expect(cost.isOverBudget()).toBe(true);
  });

  it('estimates USD from per-agent models', () => {
    const cost = createCostTracker();
    cost.recordUsage(1_000_000, 0, {
      agentId: 'h',
      agentRole: 'health-briefer',
      model: 'claude-haiku-4-5-20251001',
    });
    cost.recordUsage(100_000, 0, {
      agentId: 's',
      agentRole: 'ceo',
      model: 'claude-sonnet-4-6',
    });

    const snap = cost.snapshot();
    expect(snap.agentUsage?.h?.estimatedUSD).toBeCloseTo(0.25, 2);
    expect(snap.agentUsage?.s?.estimatedUSD).toBeCloseTo(0.3, 2);
    expect(snap.estimatedUSD).toBeCloseTo(0.55, 2);
  });
});
