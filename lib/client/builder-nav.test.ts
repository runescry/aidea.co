import { describe, expect, it } from 'vitest';
import { navItemsForMode, isBuilderView } from './builder-nav';

describe('builder-nav', () => {
  it('shows core nav by default', () => {
    expect(navItemsForMode(false)).toEqual(['home', 'inbox', 'profile', 'settings']);
  });

  it('adds builder surfaces when enabled', () => {
    expect(navItemsForMode(true)).toEqual(['home', 'inbox', 'profile', 'settings', 'agents', 'studio']);
  });

  it('identifies builder-only views', () => {
    expect(isBuilderView('studio')).toBe(true);
    expect(isBuilderView('home')).toBe(false);
  });
});
