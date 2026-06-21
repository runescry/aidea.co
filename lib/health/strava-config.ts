export function stravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID?.trim() && process.env.STRAVA_CLIENT_SECRET?.trim());
}

export function stravaClientId(): string {
  return process.env.STRAVA_CLIENT_ID?.trim() ?? '';
}

export function stravaClientSecret(): string {
  return process.env.STRAVA_CLIENT_SECRET?.trim() ?? '';
}

export function stravaRedirectUri(origin: string): string {
  const base = process.env.STRAVA_REDIRECT_URI?.trim() || `${origin.replace(/\/$/, '')}/api/integrations/strava/callback`;
  return base;
}

export function stravaAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: stravaClientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read',
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}
