import type { EntityConfig, EntityType } from '@/lib/harness/types';
import { companyEntityConfig } from './company';
import { personalEntityConfig } from './personal';
import { learningEntityConfig } from './learning';
import { creatorEntityConfig } from './creator';
import { dailyEntityConfig } from './daily';

export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  company: companyEntityConfig,
  personal: personalEntityConfig,
  learning: learningEntityConfig,
  creator: creatorEntityConfig,
  daily: dailyEntityConfig,
};

export function getEntityConfig(type: string): EntityConfig {
  const config = ENTITY_CONFIGS[type];
  if (!config) throw new Error(`Entity type '${type}' not found`);
  return config;
}

export { companyEntityConfig, personalEntityConfig, learningEntityConfig, creatorEntityConfig, dailyEntityConfig };

// Re-export EntityType for convenience
export type { EntityType };
