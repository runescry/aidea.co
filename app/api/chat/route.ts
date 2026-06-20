import { NextRequest, NextResponse } from 'next/server';
import { deleteChatConversation, readChatStore, writeChatStore } from '@/lib/storage';
import { applyChatStoreUpdate, normalizeChatStore } from '@/lib/chat/store-utils';
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
  const merged = applyChatStoreUpdate(normalized, existingNorm);

  await writeChatStore(merged);
  return NextResponse.json({ ok: true, store: merged });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: '"id" query parameter is required' }, { status: 400 });
  }

  const store = await deleteChatConversation(id);
  return NextResponse.json({ ok: true, store: normalizeChatStore(store) });
}
