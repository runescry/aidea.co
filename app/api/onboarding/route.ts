import { NextResponse } from 'next/server';
import { readKB } from '@/lib/harness/knowledge-base';
import { isOnboardingComplete, getOnboardingProgress } from '@/lib/onboarding';
import type { KnowledgeBase } from '@/types/knowledge-base';

export const runtime = 'nodejs';

export async function GET() {
  const partial = await readKB(['preferences', 'identity', 'work', 'goals', 'family', 'health', 'routines', 'relationships']);
  const kb = partial as KnowledgeBase;

  if (kb.preferences?.onboardingComplete) {
    return NextResponse.json({
      complete: true,
      progress: { completed: 15, total: 15 },
    });
  }

  return NextResponse.json({
    complete: isOnboardingComplete(kb),
    progress: getOnboardingProgress(kb),
  });
}
