/** Remove server-only integration credentials before returning a profile to a browser. */
export function redactProfileSecrets(data: Record<string, unknown>): Record<string, unknown> {
  const integrations = data.integrations as Record<string, unknown> | undefined;
  const strava = integrations?.strava as Record<string, unknown> | undefined;
  if (!strava) return data;
  const { accessToken: _accessToken, refreshToken: _refreshToken, ...safeStrava } = strava;
  return { ...data, integrations: { ...integrations, strava: safeStrava } };
}
