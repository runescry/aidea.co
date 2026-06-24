import type { AgentUsageSnapshot, CostConfig, CostSnapshot, CostTracker, RecordUsageOptions } from './types';
import { DEFAULT_COST_CONFIG as DEFAULTS } from './types';

// Approximate pricing per million tokens (USD)
const PRICING = {
  'claude-opus-4-8':              { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-sonnet-4-6':            { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-4-5-20251001':    { input: 0.25,  output: 1.25,  cacheWrite: 0.31,  cacheRead: 0.025 },
} as const;

type ModelKey = keyof typeof PRICING;

function priceFor(model: string): (typeof PRICING)[ModelKey] {
  return PRICING[model as ModelKey] ?? PRICING['claude-haiku-4-5-20251001'];
}

function estimateUsd(
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
  model: string,
): number {
  const p = priceFor(model);
  return (
    (inputTokens * p.input +
      outputTokens * p.output +
      cacheReadTokens * p.cacheRead +
      cacheWriteTokens * p.cacheWrite) / 1_000_000
  );
}

export function createCostTracker(config?: Partial<CostConfig>): CostTracker {
  const cfg: CostConfig = { ...DEFAULTS, ...config };

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let agentCount = 0;
  let toolCallCount = 0;

  const agentUsage = new Map<string, {
    agentRole: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }>();

  function agentCap(agentRole?: string): number {
    if (agentRole && cfg.maxAgentTokensByRole?.[agentRole] != null) {
      return cfg.maxAgentTokensByRole[agentRole]!;
    }
    return cfg.maxTokensPerAgent ?? cfg.maxTokensPerRun;
  }

  function agentTotals(agentId: string): { input: number; output: number } {
    const row = agentUsage.get(agentId);
    return { input: row?.inputTokens ?? 0, output: row?.outputTokens ?? 0 };
  }

  return {
    config: cfg,

    snapshot(): CostSnapshot {
      const agentBreakdown: Record<string, AgentUsageSnapshot> = {};
      for (const [agentId, row] of agentUsage) {
        agentBreakdown[agentId] = {
          agentRole: row.agentRole,
          model: row.model,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          totalTokens: row.inputTokens + row.outputTokens,
          estimatedUSD: estimateUsd(row.inputTokens, row.outputTokens, 0, 0, row.model),
        };
      }

      let estimatedUSD = 0;
      for (const row of agentUsage.values()) {
        estimatedUSD += estimateUsd(row.inputTokens, row.outputTokens, 0, 0, row.model);
      }
      if (estimatedUSD === 0) {
        estimatedUSD = estimateUsd(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, 'claude-haiku-4-5-20251001');
      }

      return {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        estimatedUSD,
        agentCount,
        toolCallCount,
        agentUsage: Object.keys(agentBreakdown).length > 0 ? agentBreakdown : undefined,
      };
    },

    recordUsage(inp: number, out: number, options: RecordUsageOptions = {}): void {
      const cacheRead = options.cacheRead ?? 0;
      const cacheWrite = options.cacheWrite ?? 0;
      inputTokens += inp;
      outputTokens += out;
      cacheReadTokens += cacheRead;
      cacheWriteTokens += cacheWrite;

      if (options.agentId) {
        const existing = agentUsage.get(options.agentId);
        const model = options.model ?? existing?.model ?? 'claude-haiku-4-5-20251001';
        const role = options.agentRole ?? existing?.agentRole ?? 'unknown';
        agentUsage.set(options.agentId, {
          agentRole: role,
          model,
          inputTokens: (existing?.inputTokens ?? 0) + inp,
          outputTokens: (existing?.outputTokens ?? 0) + out,
        });
      }
    },

    recordAgent(): void {
      agentCount++;
    },

    recordToolCall(): void {
      toolCallCount++;
    },

    isOverBudget(agentId?: string, agentRole?: string): boolean {
      if (inputTokens + outputTokens >= cfg.maxTokensPerRun) return true;
      if (!agentId) return false;
      const { input, output } = agentTotals(agentId);
      return input + output >= agentCap(agentRole);
    },

    isNearBudget(agentId?: string, agentRole?: string): boolean {
      const runTotal = inputTokens + outputTokens;
      if (runTotal >= cfg.maxTokensPerRun * cfg.warnAtPercent) return true;
      if (!agentId) return false;
      const { input, output } = agentTotals(agentId);
      return input + output >= agentCap(agentRole) * cfg.warnAtPercent;
    },

    estimatedUSD(): number {
      let total = 0;
      for (const row of agentUsage.values()) {
        total += estimateUsd(row.inputTokens, row.outputTokens, 0, 0, row.model);
      }
      if (total > 0) return total;
      return estimateUsd(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, 'claude-haiku-4-5-20251001');
    },

    canSpawnAgent(): boolean {
      return agentCount < cfg.maxAgentsPerRun;
    },

    canSpawnAtTier(tier: number): boolean {
      return tier <= cfg.maxTierDepth;
    },
  };
}
