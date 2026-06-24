import type { EntityType } from '@/lib/harness/types';

export interface EntityRunField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'number';
}

export type HomeRunnableEntity = 'company' | 'learning' | 'creator';

export const ENTITY_RUN_META: Record<HomeRunnableEntity, { label: string; fields: EntityRunField[] }> = {
  company: {
    label: 'Company',
    fields: [
      { key: 'idea', label: 'Startup idea', placeholder: 'A B2B SaaS tool that automates invoice reconciliation for SMBs' },
    ],
  },
  learning: {
    label: 'Learning OS',
    fields: [
      { key: 'goal', label: 'What do you want to learn?', placeholder: 'Become proficient in machine learning engineering' },
      { key: 'skillLevel', label: 'Current skill level', placeholder: 'Intermediate Python dev, no ML experience' },
      { key: 'hoursPerWeek', label: 'Hours/week available', placeholder: '8', type: 'number' },
      { key: 'timeframe', label: 'Timeframe', placeholder: '6 months' },
    ],
  },
  creator: {
    label: 'Creator Studio',
    fields: [
      { key: 'prompt', label: 'Creator context', placeholder: 'I make YouTube videos about personal finance and want to monetise my 5k audience' },
      { key: 'platform', label: 'Primary platform', placeholder: 'YouTube' },
      { key: 'niche', label: 'Niche', placeholder: 'Personal finance for millennials' },
      { key: 'monetisationGoal', label: 'Monetisation goal', placeholder: '$5k/month within 12 months' },
    ],
  },
};

export const HOME_RUN_ENTITIES: HomeRunnableEntity[] = ['company', 'learning', 'creator'];

export type StudioEntityType = EntityType;

export const STUDIO_ENTITY_META: Record<StudioEntityType, { label: string; description: string; fields: EntityRunField[] }> = {
  company: {
    label: 'Company',
    description: 'Simulate a startup with CEO, product, marketing, and finance agents. Produces strategy artifacts and a consensus plan.',
    fields: ENTITY_RUN_META.company.fields,
  },
  learning: {
    label: 'Learning OS',
    description: 'Build a personalised curriculum, practice schedule, and knowledge capture plan from your learning goals.',
    fields: ENTITY_RUN_META.learning.fields,
  },
  creator: {
    label: 'Creator Studio',
    description: 'Plan content strategy, production workflow, and distribution for a creator business.',
    fields: ENTITY_RUN_META.creator.fields,
  },
  personal: {
    label: 'Personal OS',
    description: 'Run life-domain directors (health, finance, relationships, growth) against your priorities and context.',
    fields: [
      { key: 'prompt', label: 'Life context', placeholder: 'I\'m a 32-year-old engineer who wants to transition to founding my own company in 18 months' },
      { key: 'priorities', label: 'Top priorities (comma-separated)', placeholder: 'financial independence, health, meaningful relationships' },
    ],
  },
  daily: {
    label: 'Daily OS',
    description: 'Morning brief from inbox, calendar, health, news, and work prep. Lite (default) uses one agent; Full runs six parallel agents.',
    fields: [],
  },
  custom: {
    label: 'Custom',
    description: '',
    fields: [],
  },
};
