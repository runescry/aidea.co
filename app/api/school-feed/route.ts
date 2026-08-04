import { NextResponse } from 'next/server';
import { readAllKB } from '@/lib/harness/knowledge-base';
import type { KnowledgeBase } from '@/types/knowledge-base';

export const runtime = 'nodejs';

export async function GET() {
  const kb = await readAllKB() as KnowledgeBase;
  const feed = kb.family?.schoolFeed ?? null;
  return NextResponse.json({ feed });
}
