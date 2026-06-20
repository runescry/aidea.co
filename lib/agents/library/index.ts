import type { AgentDefinition } from '@/lib/harness/types';

// Company agents
import { ceoDef } from './company/ceo';
import { cpoDef } from './company/cpo';
import { cmoDef } from './company/cmo';
import { ctoDef } from './company/cto';
import { cfoDef } from './company/cfo';
import { copywriterDef } from './company/copywriter';
import { outreachDef } from './company/outreach';
import { pricingDef } from './company/pricing';
import { researchDef } from './company/research';

// Personal OS agents
import { lifeCeoDef } from './personal/life-ceo';
import { growthDirectorDef } from './personal/growth-director';
import { healthDirectorDef } from './personal/health-director';
import { financeDirectorDef } from './personal/finance-director';
import { relationshipsDirectorDef } from './personal/relationships-director';
import { systemsDirectorDef } from './personal/systems-director';

// Shared agents
import { sharedResearcherDef } from './shared/researcher';
import { sharedPlannerDef } from './shared/planner';

// Daily OS agents
import {
  dailyOrchestratorDef,
  dailyLiteBrieferDef,
  inboxTriageDef,
  calendarReaderDef,
  healthBrieferDef,
  newsCuratorDef,
  workPrepDef,
} from './daily';

// Dispatch
import { dispatcherDef } from './dispatch/dispatcher';

// Personal OS additions
import { mentalHealthDirectorDef } from './personal/mental-health-director';
import { valuesDirectorDef } from './personal/values-director';
import { relationshipMonitorDef } from './personal/relationship-monitor';

import {
  learningCeoDef,
  curriculumDirectorDef,
  practiceCoachDef,
  knowledgeSynthesizerDef,
} from './learning';
import {
  creatorCeoDef,
  contentDirectorDef,
  productionDirectorDef,
  distributionDirectorDef,
} from './creator';

export const AGENT_LIBRARY: Record<string, AgentDefinition> = {
  // Company
  'ceo': ceoDef,
  'cpo': cpoDef,
  'cmo': cmoDef,
  'cto': ctoDef,
  'cfo': cfoDef,
  'copywriter': copywriterDef,
  'outreach': outreachDef,
  'pricing': pricingDef,
  'research': researchDef,

  // Personal OS
  'life-ceo': lifeCeoDef,
  'growth-director': growthDirectorDef,
  'health-director': healthDirectorDef,
  'finance-director': financeDirectorDef,
  'relationships-director': relationshipsDirectorDef,
  'systems-director': systemsDirectorDef,
  'mental-health-director': mentalHealthDirectorDef,
  'values-director': valuesDirectorDef,
  'relationship-monitor': relationshipMonitorDef,

  // Daily OS
  'daily-orchestrator': dailyOrchestratorDef,
  'daily-lite-briefer': dailyLiteBrieferDef,
  'inbox-triage': inboxTriageDef,
  'calendar-reader': calendarReaderDef,
  'health-briefer': healthBrieferDef,
  'news-curator': newsCuratorDef,
  'work-prep': workPrepDef,

  // Dispatch
  'dispatcher': dispatcherDef,

  // Shared
  'shared-researcher': sharedResearcherDef,
  'shared-planner': sharedPlannerDef,

  // Learning OS
  'learning-ceo': learningCeoDef,
  'curriculum-director': curriculumDirectorDef,
  'practice-coach': practiceCoachDef,
  'knowledge-synthesizer': knowledgeSynthesizerDef,

  // Creator Studio
  'creator-ceo': creatorCeoDef,
  'content-director': contentDirectorDef,
  'production-director': productionDirectorDef,
  'distribution-director': distributionDirectorDef,
};

export function getAgentDef(id: string): AgentDefinition {
  const def = AGENT_LIBRARY[id];
  if (!def) throw new Error(`Agent '${id}' not found in library`);
  return def;
}

export { ARCHETYPES, getArchetype } from './archetypes';
