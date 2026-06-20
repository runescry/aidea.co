import { describe, it, expect } from 'vitest';
import type { AgentDefinition } from '@/lib/harness/types';
import {
  applyAgentOverride,
  buildEffectiveSystemPrompt,
  hasActiveCustomization,
  isOverrideEmpty,
  mergeOverride,
  resolveLibraryAgent,
} from './resolve';
import { dispatcherDef } from '@/lib/agents/library/dispatch/dispatcher';

const base: AgentDefinition = {
  ...dispatcherDef,
  systemPrompt: 'Base dispatcher prompt.',
};

describe('isOverrideEmpty', () => {
  it('is true for empty override', () => {
    expect(isOverrideEmpty({})).toBe(true);
  });

  it('is false when prompt append is set', () => {
    expect(isOverrideEmpty({ promptAppend: 'Be brief.' })).toBe(false);
  });

  it('is false when tools array is empty (explicit disable)', () => {
    expect(isOverrideEmpty({ tools: [] })).toBe(false);
  });
});

describe('buildEffectiveSystemPrompt', () => {
  it('includes identity line and custom display name', () => {
    const prompt = buildEffectiveSystemPrompt(base, { displayName: 'Chief Router' });
    expect(prompt).toContain('You are Chief Router (role: dispatcher).');
    expect(prompt).toContain('Base dispatcher prompt.');
  });

  it('appends custom instructions', () => {
    const prompt = buildEffectiveSystemPrompt(base, { promptAppend: 'Use British English.' });
    expect(prompt).toContain('CUSTOM INSTRUCTIONS');
    expect(prompt).toContain('Use British English.');
  });

  it('replaces base prompt when systemPromptReplace is set', () => {
    const prompt = buildEffectiveSystemPrompt(base, {
      systemPromptReplace: 'You route all commands.',
    });
    expect(prompt).toContain('You route all commands.');
    expect(prompt).not.toContain('Base dispatcher prompt.');
  });
});

describe('applyAgentOverride', () => {
  it('returns base when override is empty', () => {
    expect(applyAgentOverride(base, {})).toBe(base);
  });

  it('restricts tools when override lists a subset', () => {
    const resolved = applyAgentOverride(base, { tools: ['write_state', 'kb_read'] });
    expect(resolved.defaultTools).toEqual(['write_state', 'kb_read']);
  });
});

describe('hasActiveCustomization', () => {
  it('detects tool changes', () => {
    expect(hasActiveCustomization(base, { tools: ['write_state'] })).toBe(true);
  });

  it('ignores tools identical to base', () => {
    expect(hasActiveCustomization(base, { tools: [...base.defaultTools] })).toBe(false);
  });
});

describe('mergeOverride', () => {
  it('clears fields when updated to empty string', () => {
    const merged = mergeOverride(
      { displayName: 'Old', promptAppend: 'Keep' },
      { displayName: '' },
    );
    expect(merged.displayName).toBeUndefined();
    expect(merged.promptAppend).toBe('Keep');
    expect(merged.updatedAt).toBeDefined();
  });
});

describe('resolveLibraryAgent', () => {
  it('applies overrides for a library agent', () => {
    const resolved = resolveLibraryAgent('dispatcher', {
      dispatcher: { promptAppend: 'End with BANANA.' },
    });
    expect(resolved.systemPrompt).toContain('End with BANANA.');
    expect(resolved.id).toBe('dispatcher');
  });

  it('throws for unknown agents', () => {
    expect(() => resolveLibraryAgent('not-real', {})).toThrow("Agent 'not-real' not found");
  });
});
