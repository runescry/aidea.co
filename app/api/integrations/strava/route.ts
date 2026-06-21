import { NextResponse } from 'next/server';
import { syncStravaToKb, stravaConnectionStatus } from '@/lib/health/strava-sync';
import { writeStravaConnection } from '@/lib/health/strava-tokens';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(await stravaConnectionStatus());
}

export async function DELETE() {
  await writeStravaConnection(null);
  return NextResponse.json({ ok: true });
}

export async function POST() {
  try {
    const snapshot = await syncStravaToKb();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
