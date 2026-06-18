import type { CostConfig, CostSnapshot, CostTracker, DEFAULT_COST_CONFIG } from './types';
import { DEFAULT_COST_CONFIG as DEFAULTS } from './types';

// Approximate pricing per million tokens (USD)
const PRICING = {
  'claude-opus-4-8':              { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  'claude-sonnet-4-6':            { input: 3.00,  output: 15.00, cacheWrite: 3.75,  cacheRead: 0.30 },
  'claude-haiku-4-5-20251001':    { input: 0.25,  output: 1.25,  cacheWrite: 0.31,  cacheRead: 0.025 },
} as const;

type ModelKey = keyof typeof PRICING;

function priceFor(model: string): (typeof PRICING)[ModelKey] {
  return PRICING[model as ModelKey] ?? PRICING['claude-sonnet-4-6'];
}

export function createCostTracker(config?: Partial<CostConfig>, defaultModel?: string): CostTracker {
  const cfg: CostConfig = { ...DEFAULTS, ...config };
  const model = defaultModel ?? 'claude-sonnet-4-6';

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let agentCount = 0;
  let toolCallCount = 0;

  function estimatedUSD(): number {
    const p = priceFor(model);
    return (
      (inputTokens * p.input +
       outputTokens * p.output +
       cacheReadTokens * p.cacheRead +
       cacheWriteTokens * p.cacheWrite) / 1_000_000
    );
  }

  function totalTokens(): number {
    return inputTokens + outputTokens;
  }

  return {
    config: cfg,

    snapshot(): CostSnapshot {
      return {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        estimatedUSD: estimatedUSD(),
        agentCount,
        toolCallCount,
      };
    },

    recordUsage(inp: number, out: number, cacheRead = 0, cacheWrite = 0): void {
      inputTokens += inp;
      outputTokens += out;
      cacheReadTokens += cacheRead;
      cacheWriteTokens += cacheWrite;
    },

    recordAgent(): void {
      agentCount++;
    },

    recordToolCall(): void {
      toolCallCount++;
    },

    isOverBudget(): boolean {
      return totalTokens() >= cfg.maxTokensPerRun;
    },

    isNearBudget(): boolean {
      return totalTokens() >= cfg.maxTokensPerRun * cfg.warnAtPercent;
    },

    estimatedUSD,

    canSpawnAgent(): boolean {
      return agentCount < cfg.maxAgentsPerRun;
    },

    canSpawnAtTier(tier: number): boolean {
      return tier <= cfg.maxTierDepth;
    },
  };
}
