import { NextRequest, NextResponse } from 'next/server';
import { readChatStore, writeChatStore } from '@/lib/storage';
import { mergeChatStores, normalizeChatStore } from '@/lib/chat/store-utils';
import type { ChatStore } from '@/types/chat';

export const runtime = 'nodejs';

export async function GET() {
  const store = await readChatStore();
  const normalized = store ? normalizeChatStore(store) : null;
  return NextResponse.json({ store: normalized });
}

export async function PUT(req: NextRequest) {
  const body = await req.json() as { store?: ChatStore };
  const normalized = normalizeChatStore(body.store);
  if (!normalized) {
    return NextResponse.json({ error: 'Invalid chat store' }, { status: 400 });
  }

  const existing = await readChatStore();
  const existingNorm = existing ? normalizeChatStore(existing) : null;
  const merged = mergeChatStores(normalized, existingNorm);

  await writeChatStore(merged);
  return NextResponse.json({ ok: true, store: merged });
}
