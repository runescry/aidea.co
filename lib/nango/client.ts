import { Nango } from '@nangohq/node';

let _nango: Nango | null = null;

export function getEndUserId(): string {
  return process.env.DEFAULT_USER_ID ?? 'default';
}

function nangoSecretKey(): string | undefined {
  const key = process.env.NANGO_SECRET_KEY?.trim();
  return key || undefined;
}

export function nangoMisconfigMessage(): string {
  if (process.env.NANGO_SECRET_KEY !== undefined && !nangoSecretKey()) {
    return 'NANGO_SECRET_KEY is empty — paste your Nango secret into .env.local (or Vercel env vars) and restart the dev server';
  }
  return 'NANGO_SECRET_KEY is not configured — add it in .env.local (or Vercel env vars) and restart the dev server';
}

export function getNango(): Nango {
  if (!_nango) {
    const secretKey = nangoSecretKey();
    if (!secretKey) {
      throw new Error(nangoMisconfigMessage());
    }
    _nango = new Nango({ secretKey });
  }
  return _nango;
}

export function nangoConfigured(): boolean {
  return Boolean(nangoSecretKey());
}

export function gmailIntegrationId(): string {
  return process.env.NANGO_GMAIL_INTEGRATION_ID ?? 'google-mail';
}

export function calendarIntegrationId(): string {
  return process.env.NANGO_CALENDAR_INTEGRATION_ID ?? 'google-calendar';
}
