import { NextRequest, NextResponse } from 'next/server';
import { readChatStore, writeChatStore } from '@/lib/storage';
import { applyChatStoreUpdate, emptyChatStore, mergeChatStores, normalizeChatStore } from '@/lib/chat/store-utils';
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

  const existing = await readChatStore();
  const existingNorm = existing ? normalizeChatStore(existing) : null;
  if (!existingNorm) {
    return NextResponse.json({ ok: true, store: null });
  }

  const deletedConversationIds = [
    ...new Set([...(existingNorm.deletedConversationIds ?? []), id]),
  ];
  let conversations = existingNorm.conversations.filter(c => c.id !== id);
  let activeId = existingNorm.activeId;

  if (conversations.length === 0) {
    const fresh = emptyChatStore();
    fresh.deletedConversationIds = deletedConversationIds;
    await writeChatStore(fresh);
    return NextResponse.json({ ok: true, store: fresh });
  }

  if (activeId === id) {
    activeId = conversations[0].id;
  }

  const next = mergeChatStores(
    { conversations, activeId, deletedConversationIds },
    existingNorm,
  );

  await writeChatStore(next);
  return NextResponse.json({ ok: true, store: next });
}
