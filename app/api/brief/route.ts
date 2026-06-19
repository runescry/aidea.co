import { NextResponse } from 'next/server';
import { readLatestBrief } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  const brief = await readLatestBrief();
  if (!brief) {
    return NextResponse.json({ brief: null });
  }
  return NextResponse.json({ brief });
}
