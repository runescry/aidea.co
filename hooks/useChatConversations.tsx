'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { HarnessEvent } from '@/lib/harness/types';
import { pendingInputFromEvent, type PendingHumanInput } from '@/lib/client/human-input';
import { consumeHarnessSSE } from '@/lib/client/sse';
import { buildHistoryFromMessages } from '@/lib/chat/history';
import { formatDispatchChatSummary, hasStructuredDispatchOutput } from '@/lib/harness/dispatch-summary';
import {
  dedupeEphemeralConversations,
  emptyChatStore,
  hydrateChatStore,
  normalizeChatStore,
  trimChatStore,
} from '@/lib/chat/store-utils';
import type { ChatConversation, ChatMessage, ChatStore } from '@/types/chat';

const CHAT_AGENT_ROLES = new Set(['dispatcher']);

const TOOL_STATUS: Record<string, string> = {
  gmail_read: 'Checking your inbox…',
  calendar_read: 'Checking your calendar…',
  web_search: 'Searching the web…',
  news_search: 'Fetching news…',
  kb_read: 'Reading your profile…',
  update_kb: 'Updating your profile…',
  queue_action: 'Queuing action…',
  spawn_agent: 'Delegating to a specialist…',
};

const TOOL_STATUS_VALUES = new Set(Object.values(TOOL_STATUS));

function hasStructuredChatCard(value: unknown): boolean {
  return hasStructuredDispatchOutput(value);
}

function isChatAgentEvent(event: HarnessEvent): boolean {
  return CHAT_AGENT_ROLES.has(event.agentRole ?? '');
}

function stripToolStatus(content: string): string {
  return TOOL_STATUS_VALUES.has(content.trim()) ? '' : content;
}

const STORAGE_KEY = 'aidea-chat-v1';
const SYNC_DEBOUNCE_MS = 800;

const LOADING_CONVERSATION: ChatConversation = {
  id: '',
  title: 'New conversation',
  messages: [],
  createdAt: '',
  updatedAt: '',
};

function newConversation(): ChatConversation {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: 'New conversation',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function deriveTitle(messages: ChatMessage[], fallback: string): string {
  const first = messages.find(m => m.role === 'user' && m.content.trim());
  if (!first) return fallback;
  const text = first.content.trim();
  return text.length > 36 ? `${text.slice(0, 36)}…` : text;
}

function loadLocalStore(): ChatStore | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeChatStore(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveLocalStore(store: ChatStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota or private mode
  }
}

function prepareStoreForSync(store: ChatStore): ChatStore {
  const trimmed = trimChatStore(store);
  return {
    ...trimmed,
    conversations: dedupeEphemeralConversations(trimmed.conversations),
  };
}

async function fetchRemoteStore(): Promise<ChatStore | null> {
  const res = await fetch('/api/chat');
  if (!res.ok) return null;
  const data = await res.json() as { store?: ChatStore | null };
  return data.store ? normalizeChatStore(data.store) : null;
}

async function pushStoreToServer(store: ChatStore): Promise<void> {
  await fetch('/api/chat', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store }),
  });
}

interface ChatContextValue {
  conversations: ChatConversation[];
  activeConversation: ChatConversation;
  activeId: string;
  streaming: boolean;
  syncReady: boolean;
  switchConversation: (id: string) => void;
  createConversation: () => void;
  deleteConversation: (id: string) => void;
  /** @deprecated use deleteConversation */
  closeConversation: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
  resetLocalChatStore: () => void;
  pendingInput: PendingHumanInput | null;
  clearPendingInput: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<ChatStore | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [pendingInput, setPendingInput] = useState<PendingHumanInput | null>(null);
  const [syncReady, setSyncReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const local = loadLocalStore();
        const remote = await fetchRemoteStore();
        if (cancelled) return;
        const hydrated = hydrateChatStore(local, remote);
        setStore(hydrated);
        saveLocalStore(hydrated);
      } catch {
        if (!cancelled) {
          const fallback = hydrateChatStore(loadLocalStore(), null);
          setStore(fallback);
          saveLocalStore(fallback);
        }
      } finally {
        if (!cancelled) setSyncReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!syncReady || streaming || !store) return;
    const prepared = prepareStoreForSync(store);
    saveLocalStore(prepared);
    const timer = setTimeout(() => {
      pushStoreToServer(prepared).catch(() => {});
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [store, syncReady, streaming]);

  const activeConversation = useMemo(
    () => {
      if (!store) return LOADING_CONVERSATION;
      return store.conversations.find(c => c.id === store.activeId) ?? store.conversations[0];
    },
    [store],
  );

  const updateConversation = useCallback(
    (id: string, updater: (conv: ChatConversation) => ChatConversation) => {
      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          conversations: prev.conversations.map(c =>
            c.id === id ? updater(c) : c,
          ),
        };
      });
    },
    [],
  );

  const switchConversation = useCallback((id: string) => {
    setStore(prev => (prev ? { ...prev, activeId: id } : prev));
  }, []);

  const createConversation = useCallback(() => {
    const next = newConversation();
    setStore(prev => ({
      conversations: [next, ...(prev?.conversations ?? [])],
      activeId: next.id,
    }));
  }, []);

  const resetLocalChatStore = useCallback(() => {
    const empty = emptyChatStore();
    setStore(empty);
    setPendingInput(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearPendingInput = useCallback(() => {
    setPendingInput(null);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    if (streaming && storeRef.current?.activeId === id) {
      abortRef.current?.abort();
      setStreaming(false);
    }

    setStore(prev => {
      if (!prev) return prev;
      const conversations = prev.conversations.filter(c => c.id !== id);
      const activeId = conversations.length === 0
        ? prev.activeId
        : prev.activeId === id
          ? conversations[0].id
          : prev.activeId;
      return conversations.length === 0
        ? prev
        : { conversations, activeId };
    });

    fetch(`/api/chat?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(async res => {
        if (!res.ok) throw new Error('Delete failed');
        const data = await res.json() as { store?: ChatStore | null };
        const normalized = data.store ? normalizeChatStore(data.store) : null;
        if (!normalized) return;
        setStore(normalized);
        saveLocalStore(normalized);
      })
      .catch(() => {
        setStore(prev => {
          if (!prev) return prev;
          const conversations = prev.conversations.filter(c => c.id !== id);
          if (conversations.length === 0) {
            const next = newConversation();
            const nextStore: ChatStore = { conversations: [next], activeId: next.id };
            saveLocalStore(nextStore);
            if (syncReady) {
              pushStoreToServer(prepareStoreForSync(nextStore)).catch(() => {});
            }
            return nextStore;
          }
          const activeId = prev.activeId === id ? conversations[0].id : prev.activeId;
          const nextStore: ChatStore = { conversations, activeId };
          saveLocalStore(nextStore);
          if (syncReady) {
            pushStoreToServer(prepareStoreForSync(nextStore)).catch(() => {});
          }
          return nextStore;
        });
      });
  }, [streaming, syncReady]);

  const closeConversation = deleteConversation;

  const sendMessage = useCallback(async (text: string) => {
    const command = text.trim();
    if (!command || streaming) return;

    const current = storeRef.current;
    if (!current) return;

    const conversationId = current.activeId;
    const conv = current.conversations.find(c => c.id === conversationId);
    const history = conv ? buildHistoryFromMessages(conv.messages) : [];

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: command,
      timestamp: new Date().toISOString(),
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: new Date().toISOString(),
      status: 'streaming',
    };

    updateConversation(conversationId, c => ({
      ...c,
      messages: [...c.messages, userMsg, assistantMsg],
      title: c.messages.length === 0 ? deriveTitle([userMsg], c.title) : c.title,
      updatedAt: new Date().toISOString(),
    }));

    setStreaming(true);

    const pendingDeltaRef = { current: '' };
    let deltaFrame: number | null = null;

    const patchAssistant = (
      patch: Partial<ChatMessage> | ((msg: ChatMessage) => Partial<ChatMessage>),
    ) => {
      updateConversation(conversationId, c => ({
        ...c,
        messages: c.messages.map(m => {
          if (m.id !== assistantMsgId) return m;
          const next = typeof patch === 'function' ? patch(m) : patch;
          return { ...m, ...next };
        }),
        updatedAt: new Date().toISOString(),
      }));
    };

    const flushDelta = () => {
      deltaFrame = null;
      const delta = pendingDeltaRef.current;
      if (!delta) return;
      pendingDeltaRef.current = '';
      patchAssistant(m => ({
        content: stripToolStatus(m.content) + delta,
      }));
    };

    const queueDelta = (delta: string) => {
      pendingDeltaRef.current += delta;
      if (deltaFrame == null) {
        deltaFrame = requestAnimationFrame(flushDelta);
      }
    };

    const handleEvent = (event: HarnessEvent) => {
      if (event.type === 'tool_called') {
        const tool = event.data.tool as string;
        const inputSummary = Object.entries(event.data.input as Record<string, unknown>)
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
          .join(', ');
        updateConversation(conversationId, c => ({
          ...c,
          messages: c.messages.map(m => {
            if (m.id !== assistantMsgId) return m;
            const status = TOOL_STATUS[tool];
            return {
              ...m,
              toolCalls: [...(m.toolCalls ?? []), { tool, summary: inputSummary }],
              ...(!m.content.trim() && status ? { content: status } : {}),
            };
          }),
        }));
      }
      if (event.type === 'human_input_requested') {
        setPendingInput(pendingInputFromEvent(event.data as Record<string, unknown>, event.agentRole));
      }
      if (event.type === 'agent_text_delta' && isChatAgentEvent(event)) {
        const delta = event.data.delta as string;
        if (delta) queueDelta(delta);
      }
      if (event.type === 'agent_response' && isChatAgentEvent(event)) {
        const summary = event.data.summary as string | undefined;
        const structured = event.data.structured;
        patchAssistant({
          ...(summary ? { content: summary } : {}),
          ...(structured !== undefined ? { structured } : {}),
        });
      }
      if (event.type === 'agent_complete' && isChatAgentEvent(event)) {
        const summary = event.data.summary as string | undefined;
        const structured = event.data.structured;
        patchAssistant(m => {
          const structuredOut = structured !== undefined ? structured : m.structured;
          const structuredFormatted = formatDispatchChatSummary(structuredOut);
          const hasCard = hasStructuredChatCard(structuredOut);
          const formatted = (hasCard && structuredFormatted)
            || summary?.trim()
            || structuredFormatted
            || formatDispatchChatSummary(m.structured);
          return {
            content: formatted || (hasCard ? '' : stripToolStatus(m.content)) || 'Done.',
            ...(structured !== undefined ? { structured } : {}),
          };
        });
      }
      if (event.type === 'error' || event.type === 'agent_error' || event.type === 'entity_error') {
        const message =
          (event.data.message as string | undefined)
          ?? (event.data.error as string | undefined)
          ?? 'Something went wrong.';
        patchAssistant({ status: 'error', content: message });
      }
    };

    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, sessionId: conversationId, history }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `Request failed (${res.status})`);
      }

      if (!res.body) throw new Error('No response body');

      await consumeHarnessSSE<HarnessEvent>(res, handleEvent);
      if (deltaFrame != null) cancelAnimationFrame(deltaFrame);
      if (pendingDeltaRef.current) flushDelta();
      patchAssistant({ status: 'done' });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        patchAssistant({ status: 'error', content: message });
      }
    } finally {
      setStreaming(false);
    }
  }, [streaming, updateConversation]);

  const value = useMemo<ChatContextValue>(() => ({
    conversations: store?.conversations ?? [],
    activeConversation,
    activeId: store?.activeId ?? '',
    streaming,
    syncReady,
    switchConversation,
    createConversation,
    deleteConversation,
    closeConversation,
    sendMessage,
    resetLocalChatStore,
    pendingInput,
    clearPendingInput,
  }), [
    store?.conversations,
    store?.activeId,
    activeConversation,
    streaming,
    syncReady,
    pendingInput,
    switchConversation,
    createConversation,
    deleteConversation,
    closeConversation,
    sendMessage,
    resetLocalChatStore,
    clearPendingInput,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatConversations(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatConversations must be used within ChatProvider');
  return ctx;
}
