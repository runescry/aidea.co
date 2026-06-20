import { describe, expect, it } from 'vitest';
import { buildKbUpdatePreview, describeKbUpdate } from './kb-update-display';

describe('buildKbUpdatePreview', () => {
  it('structures job application updates', () => {
    const preview = buildKbUpdatePreview({
      summary: '{"company":"Acme"}',
      payload: {
        reason: 'User asked to track application',
        input: { jobApplication: { company: 'Acme', role: 'PM', status: 'Interviewing', nextAction: 'Follow up' } },
      },
    });
    expect(preview.headline).toContain('Acme');
    expect(preview.reason).toBe('User asked to track application');
    expect(preview.fields.some(f => f.label === 'Role' && f.value === 'PM')).toBe(true);
  });

  it('describeKbUpdate returns human-readable lines', () => {
    const text = describeKbUpdate({
      summary: 'Set preferences.theme',
      payload: { input: { key: 'preferences.theme', value: 'dark' } },
    });
    expect(text).toContain('Field: preferences.theme');
  });
});
