export type HomePanelFocus = 'school' | 'chat';

export function toggleHomePanelFocus(
  current: HomePanelFocus | null,
  panel: HomePanelFocus,
): HomePanelFocus | null {
  return current === panel ? null : panel;
}
