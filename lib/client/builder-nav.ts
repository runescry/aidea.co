export type MainView = 'home' | 'inbox' | 'agents' | 'studio' | 'profile' | 'settings';

export const BUILDER_NAV_STORAGE_KEY = 'aidea-builder-nav';

export const BUILDER_NAV_EVENT = 'aidea-builder-nav-change';

/** Shown by default — daily product surfaces only. */
export const CORE_NAV: MainView[] = ['home', 'inbox', 'profile', 'settings'];

/** Hidden unless builder mode is on — agent debug & library. */
export const BUILDER_ONLY_NAV: MainView[] = ['agents', 'studio'];

export function isBuilderNavEnabled(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_BUILDER_NAV === '1';
  }
  try {
    const stored = localStorage.getItem(BUILDER_NAV_STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    // ignore
  }
  return process.env.NEXT_PUBLIC_BUILDER_NAV === '1';
}

export function setBuilderNavEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BUILDER_NAV_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new Event(BUILDER_NAV_EVENT));
  } catch {
    // ignore
  }
}

export function navItemsForMode(builderNav: boolean): MainView[] {
  return builderNav ? [...CORE_NAV, ...BUILDER_ONLY_NAV] : CORE_NAV;
}

export function isBuilderView(view: MainView): boolean {
  return BUILDER_ONLY_NAV.includes(view);
}
