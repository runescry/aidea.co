import { NextRequest, NextResponse } from 'next/server';
import { findEntityState } from '@/lib/harness/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await params;
  const entity = await findEntityState(entityId);
  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  return NextResponse.json(entity);
}
