import { createUserId } from './session';
import { stableGoogleUserId } from './session-token';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export const GOOGLE_OAUTH_STATE_COOKIE = 'aidea-google-oauth-state';

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function googleOAuthMisconfigMessage(): string {
  if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    return 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for Google sign-in';
  }
  return 'Google sign-in is not configured';
}

export function googleRedirectUri(origin: string): string {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, '')}/api/auth/google/callback`;
}

export function buildGoogleAuthorizeUrl(origin: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error(googleOAuthMisconfigMessage());

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(origin),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleAuthCode(origin: string, code: string): Promise<{ email: string; name?: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error(googleOAuthMisconfigMessage());

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(origin),
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error('Google sign-in failed while exchanging authorization code');
  }

  const tokenBody = await tokenRes.json() as { id_token?: string };
  if (!tokenBody.id_token) throw new Error('Google sign-in did not return an id token');
  return verifyGoogleIdToken(tokenBody.id_token, clientId);
}

export async function verifyGoogleIdToken(idToken: string, expectedClientId?: string): Promise<{ email: string; name?: string }> {
  const clientId = expectedClientId ?? process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) throw new Error(googleOAuthMisconfigMessage());

  const infoRes = await fetch(`${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  if (!infoRes.ok) throw new Error('Google sign-in token verification failed');

  const info = await infoRes.json() as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    exp?: string;
  };

  if (info.aud !== clientId) throw new Error('Google sign-in token audience mismatch');
  if (info.exp && Number(info.exp) * 1000 <= Date.now()) throw new Error('Google sign-in token expired');
  if (info.email_verified === false || info.email_verified === 'false') {
    throw new Error('Google account email is not verified');
  }
  if (!info.email?.includes('@')) throw new Error('Google sign-in did not return an email address');

  return { email: info.email, name: info.name };
}

export async function stableUserIdFromGoogleEmail(email: string): Promise<string> {
  return stableGoogleUserId(email);
}

export function newGoogleNangoUserId(): string {
  return createUserId('google');
}
