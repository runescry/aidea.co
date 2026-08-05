import { NextResponse } from 'next/server';
import { readSchoolFeed } from '@/lib/harness/school-feed-read';

export const runtime = 'nodejs';

export async function GET() {
  const feed = await readSchoolFeed();
  return NextResponse.json({ feed });
}
