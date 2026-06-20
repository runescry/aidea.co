export interface AgentGroupDef {
  id: string;
  label: string;
  agentIds: string[];
}

/** Single source for Agent Library grouping (API + UI). */
export const AGENT_GROUP_DEFS: AgentGroupDef[] = [
  {
    id: 'command',
    label: 'Command',
    agentIds: ['dispatcher'],
  },
  {
    id: 'daily',
    label: 'Daily operations',
    agentIds: [
      'daily-orchestrator', 'inbox-triage', 'calendar-reader',
      'health-briefer', 'news-curator', 'work-prep',
    ],
  },
  {
    id: 'personal',
    label: 'Personal OS',
    agentIds: [
      'life-ceo', 'values-director', 'mental-health-director',
      'growth-director', 'health-director', 'finance-director',
      'relationships-director', 'systems-director', 'relationship-monitor',
    ],
  },
  {
    id: 'company',
    label: 'Company',
    agentIds: [
      'ceo', 'cpo', 'cmo', 'cto', 'cfo',
      'copywriter', 'outreach', 'pricing', 'research',
    ],
  },
  {
    id: 'shared',
    label: 'Shared',
    agentIds: ['shared-researcher', 'shared-planner'],
  },
  {
    id: 'learning',
    label: 'Learning OS',
    agentIds: ['learning-ceo', 'curriculum-director', 'practice-coach', 'knowledge-synthesizer'],
  },
  {
    id: 'creator',
    label: 'Creator Studio',
    agentIds: ['creator-ceo', 'content-director', 'production-director', 'distribution-director'],
  },
];
