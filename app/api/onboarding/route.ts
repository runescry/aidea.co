import { NextResponse } from 'next/server';
import { readAllKB } from '@/lib/harness/knowledge-base';
import { isOnboardingComplete, getOnboardingProgress } from '@/lib/onboarding';
import type { KnowledgeBase } from '@/types/knowledge-base';

export const runtime = 'nodejs';

export async function GET() {
  const kb = await readAllKB() as KnowledgeBase;
  return NextResponse.json({
    complete: isOnboardingComplete(kb),
    progress: getOnboardingProgress(kb),
  });
}
