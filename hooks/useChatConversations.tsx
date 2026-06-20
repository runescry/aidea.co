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
import { consumeHarnessSSE } from '@/lib/client/sse';
import type { ChatConversation, ChatMessage, ChatStore } from '@/types/chat';

const STORAGE_KEY = 'aidea-chat-v1';

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

function loadStore(): ChatStore {
  if (typeof window === 'undefined') {
    const conv = newConversation();
    return { conversations: [conv], activeId: conv.id };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const conv = newConversation();
      return { conversations: [conv], activeId: conv.id };
    }
    const parsed = JSON.parse(raw) as ChatStore;
    if (!parsed.conversations?.length || !parsed.activeId) {
      const conv = newConversation();
      return { conversations: [conv], activeId: conv.id };
    }
    return parsed;
  } catch {
    const conv = newConversation();
    return { conversations: [conv], activeId: conv.id };
  }
}

function saveStore(store: ChatStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota or private mode
  }
}

interface ChatContextValue {
  conversations: ChatConversation[];
  activeConversation: ChatConversation;
  activeId: string;
  streaming: boolean;
  switchConversation: (id: string) => void;
  createConversation: () => void;
  closeConversation: (id: string) => void;
  sendMessage: (text: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const conv = newConversation();
  const [store, setStore] = useState<ChatStore>({
    conversations: [conv],
    activeId: conv.id,
  });
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const activeConversation = useMemo(
    () => store.conversations.find(c => c.id === store.activeId) ?? store.conversations[0],
    [store],
  );

  const updateConversation = useCallback(
    (id: string, updater: (conv: ChatConversation) => ChatConversation) => {
      setStore(prev => ({
        ...prev,
        conversations: prev.conversations.map(c =>
          c.id === id ? updater(c) : c,
        ),
      }));
    },
    [],
  );

  const switchConversation = useCallback((id: string) => {
    setStore(prev => ({ ...prev, activeId: id }));
  }, []);

  const createConversation = useCallback(() => {
    const conv = newConversation();
    setStore(prev => ({
      conversations: [conv, ...prev.conversations],
      activeId: conv.id,
    }));
  }, []);

  const closeConversation = useCallback((id: string) => {
    setStore(prev => {
      if (prev.conversations.length <= 1) {
        const conv = newConversation();
        return { conversations: [conv], activeId: conv.id };
      }
      const next = prev.conversations.filter(c => c.id !== id);
      const activeId = prev.activeId === id ? next[0].id : prev.activeId;
      return { conversations: next, activeId };
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const command = text.trim();
    if (!command || streaming) return;

    const conversationId = store.activeId;
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

    updateConversation(conversationId, conv => ({
      ...conv,
      messages: [...conv.messages, userMsg, assistantMsg],
      title: conv.messages.length === 0 ? deriveTitle([userMsg], conv.title) : conv.title,
      updatedAt: new Date().toISOString(),
    }));

    setStreaming(true);

    const patchAssistant = (patch: Partial<ChatMessage>) => {
      updateConversation(conversationId, conv => ({
        ...conv,
        messages: conv.messages.map(m =>
          m.id === assistantMsgId ? { ...m, ...patch } : m,
        ),
        updatedAt: new Date().toISOString(),
      }));
    };

    const handleEvent = (event: HarnessEvent) => {
      if (event.type === 'tool_called') {
        const inputSummary = Object.entries(event.data.input as Record<string, unknown>)
          .slice(0, 2)
          .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
          .join(', ');
        updateConversation(conversationId, conv => ({
          ...conv,
          messages: conv.messages.map(m =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  toolCalls: [...(m.toolCalls ?? []), {
                    tool: event.data.tool as string,
                    summary: inputSummary,
                  }],
                }
              : m,
          ),
        }));
      }
      if (event.type === 'agent_complete') {
        const summary = event.data.summary as string | undefined;
        const structured = event.data.structured;
        patchAssistant({
          content: summary?.trim() || 'Done.',
          ...(structured !== undefined ? { structured } : {}),
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
        body: JSON.stringify({ command, sessionId: conversationId }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `Request failed (${res.status})`);
      }

      if (!res.body) throw new Error('No response body');

      await consumeHarnessSSE<HarnessEvent>(res, handleEvent);
      patchAssistant({ status: 'done' });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        patchAssistant({ status: 'error', content: message });
      }
    } finally {
      setStreaming(false);
    }
  }, [streaming, store.activeId, updateConversation]);

  const value = useMemo<ChatContextValue>(() => ({
    conversations: store.conversations,
    activeConversation,
    activeId: store.activeId,
    streaming,
    switchConversation,
    createConversation,
    closeConversation,
    sendMessage,
  }), [
    store.conversations,
    store.activeId,
    activeConversation,
    streaming,
    switchConversation,
    createConversation,
    closeConversation,
    sendMessage,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatConversations(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatConversations must be used within ChatProvider');
  return ctx;
}
