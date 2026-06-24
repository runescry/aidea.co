import type { CostConfig } from './types';
import { DEFAULT_COST_CONFIG } from './types';
import type { KnowledgeBase } from '@/types/knowledge-base';
import type { EntityConfig, EntityInput } from './types';

export type HarnessCostMode = 'standard' | 'strict';

export interface HarnessCostPreferences {
  /** Off by default — interactive Studio / Daily OS runs are unlimited. */
  enforceTokenBudget?: boolean;
  /** Shared token pool when enforceTokenBudget is on. */
  maxTokensPerRun?: number;
  /** standard = shared pool only; strict = also cap each agent role. */
  costMode?: HarnessCostMode;
  maxTokensPerAgent?: number;
  maxAgentTokensByRole?: Record<string, number>;
}

export const DEFAULT_INTERACTIVE_RUN_BUDGET = 80_000;

export const STRICT_AGENT_TOKEN_CAPS: Record<string, number> = {
  'daily-orchestrator': 14_000,
  'inbox-triage': 35_000,
  'calendar-reader': 12_000,
  'health-briefer': 10_000,
  'news-curator': 12_000,
  'work-prep': 12_000,
  dispatcher: 12_000,
  'shared-researcher': 12_000,
};

export function readHarnessCostPreferences(kb: Pick<KnowledgeBase, 'preferences'>): HarnessCostPreferences {
  return kb.preferences?.harnessCost ?? {};
}

export function isTokenBudgetEnforced(prefs: HarnessCostPreferences): boolean {
  return prefs.enforceTokenBudget === true;
}

/** Cron/monitor configs keep their entity caps; interactive runs honor Settings. */
export function shouldApplyUserCostPrefs(config: EntityConfig, input: EntityInput = {}): boolean {
  if (config.inboxTriageMode === 'lite') return false;
  if (config.rootAgentId === 'daily-lite-briefer' && input.mode !== 'lite' && input.lite !== true) {
    return false;
  }
  return true;
}

export function resolveHarnessCostConfig(
  entityCostConfig: Partial<CostConfig> | undefined,
  prefs: HarnessCostPreferences,
  applyUserPrefs: boolean,
): Partial<CostConfig> {
  const base: Partial<CostConfig> = {
    ...DEFAULT_COST_CONFIG,
    ...entityCostConfig,
    enforceRunBudget: true,
    enforcePerAgentCaps: false,
    maxTokensPerAgent: undefined,
    maxAgentTokensByRole: undefined,
  };

  if (!applyUserPrefs) return base;

  if (!isTokenBudgetEnforced(prefs)) {
    return {
      ...base,
      enforceRunBudget: false,
      enforcePerAgentCaps: false,
      maxTokensPerAgent: undefined,
      maxAgentTokensByRole: undefined,
    };
  }

  const strict = prefs.costMode === 'strict';
  return {
    ...base,
    enforceRunBudget: true,
    maxTokensPerRun: prefs.maxTokensPerRun ?? entityCostConfig?.maxTokensPerRun ?? DEFAULT_INTERACTIVE_RUN_BUDGET,
    enforcePerAgentCaps: strict,
    ...(strict
      ? {
          maxTokensPerAgent: prefs.maxTokensPerAgent ?? 16_000,
          maxAgentTokensByRole: {
            ...STRICT_AGENT_TOKEN_CAPS,
            ...prefs.maxAgentTokensByRole,
          },
        }
      : {
          maxTokensPerAgent: undefined,
          maxAgentTokensByRole: undefined,
        }),
  };
}

export function harnessCostModeLabel(mode: HarnessCostMode): string {
  return mode === 'strict' ? 'Strict (per-agent caps)' : 'Standard (shared pool)';
}
