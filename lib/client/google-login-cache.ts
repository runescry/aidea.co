const KEY = 'aidea-google-user-id';

export function readLastGoogleUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(KEY)?.trim();
  return value?.startsWith('google:') ? value : null;
}

export function writeLastGoogleUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  if (!userId.startsWith('google:')) return;
  localStorage.setItem(KEY, userId);
}
