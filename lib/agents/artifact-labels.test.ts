import { describe, it, expect } from 'vitest';
import { getArtifactLabel, getKnownArtifactKeys } from './artifact-labels';

describe('getArtifactLabel', () => {
  it('uses agent displayName for stateWriteKey', () => {
    expect(getArtifactLabel('morning_brief')).toBe('Daily Orchestrator');
  });

  it('uses entity bootstrap labels', () => {
    expect(getArtifactLabel('company_identity')).toBe('Company Identity');
    expect(getArtifactLabel('ceo_directive')).toBe('CEO Directive (Cycle 1)');
  });

  it('humanizes unknown keys', () => {
    expect(getArtifactLabel('custom_output')).toBe('Custom Output');
  });
});

describe('getKnownArtifactKeys', () => {
  it('includes library and entity keys', () => {
    const keys = getKnownArtifactKeys();
    expect(keys).toContain('morning_brief');
    expect(keys).toContain('company_identity');
  });
});
