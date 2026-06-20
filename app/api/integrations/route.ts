import { NextResponse } from 'next/server';
import { getIntegrationStatus } from '@/lib/integrations';

export const runtime = 'nodejs';

export async function GET() {
  const status = await getIntegrationStatus();
  return NextResponse.json(status);
}
