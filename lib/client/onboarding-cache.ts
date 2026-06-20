const KEY = 'aidea-onboarding-complete';

export function readOnboardingCache(): boolean | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(KEY);
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

export function writeOnboardingCache(complete: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, complete ? '1' : '0');
}
