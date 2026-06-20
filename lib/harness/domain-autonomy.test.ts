import { describe, expect, it } from 'vitest';
import { readDomainAutonomy, autonomyForAction, domainAutonomyLabel, AUTONOMY_DOMAINS } from './domain-autonomy';
import type { KnowledgeBase } from '@/types/knowledge-base';

describe('readDomainAutonomy', () => {
  it('falls back to default autonomy level', () => {
    const kb: KnowledgeBase = { preferences: { defaultAutonomyLevel: 'semi-autonomous' } };
    expect(readDomainAutonomy(kb).finance).toBe('supervised');
  });

  it('uses per-domain overrides when set', () => {
    const kb: KnowledgeBase = {
      preferences: { defaultAutonomyLevel: 'semi-autonomous', domainAutonomy: { email: 'autonomous' } },
    };
    expect(readDomainAutonomy(kb).email).toBe('autonomous');
  });
});

describe('autonomyForAction', () => {
  it('maps kb_update to kb domain', () => {
    const kb: KnowledgeBase = { preferences: { domainAutonomy: { kb: 'supervised' } } };
    expect(autonomyForAction(kb, 'kb_update')).toBe('supervised');
  });
});

describe('domainAutonomyLabel', () => {
  it('returns readable labels', () => {
    expect(domainAutonomyLabel('supervised')).toBe('Supervised');
    expect(AUTONOMY_DOMAINS.length).toBe(5);
  });
});
