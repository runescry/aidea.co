import { NextRequest, NextResponse } from 'next/server';
import {
  getSettingsStatus,
  readSettings,
  writeSettings,
  isSettingsReadOnly,
  type AppSettings,
} from '@/lib/settings';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: await getSettingsStatus(),
    readOnly: isSettingsReadOnly(),
  });
}

export async function POST(req: NextRequest) {
  if (isSettingsReadOnly()) {
    return NextResponse.json(
      { error: 'Settings are read-only in production — use Vercel Environment Variables' },
      { status: 403 }
    );
  }

  const body = await req.json() as Partial<AppSettings> & { clear?: Array<keyof AppSettings> };

  const updates: Partial<AppSettings> = {};
  const keys: Array<keyof AppSettings> = [
    'anthropicApiKey',
    'braveSearchApiKey',
  ];

  for (const key of keys) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (body.clear?.length) {
    const current = await readSettings();
    for (const key of body.clear) {
      delete current[key];
    }
    await writeSettings(current);
  } else if (Object.keys(updates).length > 0) {
    await writeSettings(updates);
  } else {
    return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: await getSettingsStatus() });
}
