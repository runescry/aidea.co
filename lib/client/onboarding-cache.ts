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

export function clearOnboardingCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

export async function fetchSessionAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return false;
    const data = await res.json() as { authenticated?: boolean };
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

/** Profile onboarding flag — null when the request fails. */
export async function fetchOnboardingComplete(): Promise<boolean | null> {
  try {
    const res = await fetch('/api/onboarding');
    if (!res.ok) return null;
    const data = await res.json() as { complete?: boolean };
    return Boolean(data.complete);
  } catch {
    return null;
  }
}
