import { describe, expect, it } from 'vitest';
import { readDomainAutonomy, autonomyForAction, shouldAutoExecuteAction, domainAutonomyLabel, AUTONOMY_DOMAINS } from './domain-autonomy';
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

  it('maps email_send to email domain', () => {
    const kb: KnowledgeBase = { preferences: { domainAutonomy: { email: 'autonomous' } } };
    expect(autonomyForAction(kb, 'email_send')).toBe('autonomous');
  });
});

describe('shouldAutoExecuteAction', () => {
  it('auto-executes only in autonomous mode', () => {
    expect(shouldAutoExecuteAction('autonomous')).toBe(true);
    expect(shouldAutoExecuteAction('semi-autonomous')).toBe(false);
    expect(shouldAutoExecuteAction('supervised')).toBe(false);
    expect(shouldAutoExecuteAction('autonomous', true)).toBe(false);
  });
});

describe('domainAutonomyLabel', () => {
  it('returns readable labels', () => {
    expect(domainAutonomyLabel('supervised')).toBe('Supervised');
    expect(AUTONOMY_DOMAINS.length).toBe(5);
  });
});
