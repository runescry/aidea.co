export type SuggestionAction = 'dismiss' | 'snooze';

export async function patchSuggestion(
  id: string,
  action: SuggestionAction,
  days?: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/tasks/suggestions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, ...(days != null ? { days } : {}) }),
  });

  const body = await res.json().catch(() => ({})) as { error?: string; ok?: boolean };
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.error ?? `Update failed (${res.status})` };
  }
  return { ok: true };
}
