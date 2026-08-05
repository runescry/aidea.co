import { describe, expect, it } from 'vitest';
import { toggleHomePanelFocus } from './home-panel-focus';

describe('toggleHomePanelFocus', () => {
  it('focuses a panel when none is focused', () => {
    expect(toggleHomePanelFocus(null, 'school')).toBe('school');
  });

  it('clears focus when toggling the active panel', () => {
    expect(toggleHomePanelFocus('chat', 'chat')).toBe(null);
  });

  it('switches focus to another panel', () => {
    expect(toggleHomePanelFocus('school', 'chat')).toBe('chat');
  });
});
