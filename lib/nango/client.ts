import { Nango } from '@nangohq/node';

let _nango: Nango | null = null;

export function getEndUserId(): string {
  return process.env.DEFAULT_USER_ID ?? 'default';
}

export function getNango(): Nango {
  if (!_nango) {
    const secretKey = process.env.NANGO_SECRET_KEY;
    if (!secretKey) {
      throw new Error('NANGO_SECRET_KEY is not configured');
    }
    _nango = new Nango({ secretKey });
  }
  return _nango;
}

export function nangoConfigured(): boolean {
  return Boolean(process.env.NANGO_SECRET_KEY);
}

export function gmailIntegrationId(): string {
  return process.env.NANGO_GMAIL_INTEGRATION_ID ?? 'google-mail';
}

export function calendarIntegrationId(): string {
  return process.env.NANGO_CALENDAR_INTEGRATION_ID ?? 'google-calendar';
}
