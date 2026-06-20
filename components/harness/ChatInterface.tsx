'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { HarnessEvent } from '@/lib/harness/types';
import { consumeHarnessSSE } from '@/lib/client/sse';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ tool: string; summary: string }>;
  timestamp: string;
  status?: 'streaming' | 'done' | 'error';
}

const HOME_SUGGESTIONS = [
  "What's still open from this week?",
  'Draft a reply to Sarah about the budget',
  'Research a company before my next meeting',
  'What needs my attention right now?',
];

function ToolPill({ tool, summary }: { tool: string; summary: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-foreground-subtle py-0.5">
      <span className="text-accent/80">{tool}</span>
      <span className="truncate max-w-[240px]">{summary}</span>
    </div>
  );
}

function ChatMessage({ msg, variant }: { msg: Message; variant: 'default' | 'home' }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className={`max-w-[85%] text-sm leading-relaxed ${
          variant === 'home'
            ? 'bg-foreground text-surface rounded-2xl rounded-br-sm px-4 py-2.5'
            : 'bg-accent text-accent-foreground rounded-2xl rounded-br-md px-4 py-2.5'
        }`}>
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 max-w-[90%]">
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div className="px-1 space-y-0.5">
          {msg.toolCalls.map((tc, i) => (
            <ToolPill key={i} tool={tc.tool} summary={tc.summary} />
          ))}
        </div>
      )}
      <div className={`text-sm text-foreground leading-relaxed ${
        variant === 'home'
          ? 'px-1 py-1'
          : 'bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm'
      } ${msg.status === 'streaming' && variant !== 'home' ? 'border-accent/30' : ''}`}>
        {msg.content || (msg.status === 'streaming' ? (
          <span className="text-foreground-subtle animate-pulse">Working…</span>
        ) : null)}
        {msg.status === 'error' && <span className="text-danger text-xs ml-1">Error</span>}
      </div>
    </div>
  );
}

interface Props {
  variant?: 'default' | 'home';
  onMessageComplete?: () => void;
}

export default function ChatInterface({ variant = 'default', onMessageComplete }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isHome = variant === 'home';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isHome) inputRef.current?.focus();
  }, [isHome]);

  const handleEvent = (event: HarnessEvent, assistantMsgId: string) => {
    if (event.type === 'tool_called') {
      const inputSummary = Object.entries(event.data.input as Record<string, unknown>)
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
        .join(', ');
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, toolCalls: [...(m.toolCalls ?? []), { tool: event.data.tool as string, summary: inputSummary }] }
          : m
      ));
    }
    if (event.type === 'agent_complete') {
      const summary = event.data.summary as string;
      if (summary) {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId ? { ...m, content: summary } : m
        ));
      }
    }
    if (event.type === 'error') {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, status: 'error', content: (event.data.message as string) || 'Error' }
          : m
      ));
    }
  };

  const send = useCallback(async (text?: string) => {
    const command = (text ?? input).trim();
    if (!command || streaming) return;

    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: command,
      timestamp: new Date().toISOString(),
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: new Date().toISOString(),
      status: 'streaming',
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
        signal: abort.signal,
      });

      if (!res.body) throw new Error('No response body');

      await consumeHarnessSSE<HarnessEvent>(res, (event) => {
        handleEvent(event, assistantMsgId);
      });

      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, status: 'done' } : m
      ));
      onMessageComplete?.();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId
            ? { ...m, status: 'error', content: m.content || 'Something went wrong.' }
            : m
        ));
      }
    } finally {
      setStreaming(false);
      if (isHome) inputRef.current?.focus();
    }
  }, [input, streaming, isHome, onMessageComplete]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const composer = (
    <div className={isHome ? 'shrink-0 pt-4 pb-5' : 'border-t border-border pt-4'}>
      {isHome && (
        <label htmlFor="chief-of-staff-input" className="block text-[11px] font-medium text-foreground-muted mb-2">
          Message
        </label>
      )}
      <div className={`flex gap-2 ${isHome ? 'items-end rounded-xl border border-border bg-surface-subtle/40 p-3 shadow-sm focus-within:border-foreground/25 focus-within:ring-2 focus-within:ring-foreground/5' : ''}`}>
        <textarea
          id={isHome ? 'chief-of-staff-input' : undefined}
          ref={inputRef}
          rows={isHome ? 2 : 1}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            if (isHome && inputRef.current) {
              inputRef.current.style.height = 'auto';
              inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={isHome ? 'Ask your chief of staff anything…' : 'Message your chief of staff…'}
          disabled={streaming}
          className={`flex-1 disabled:opacity-50 resize-none ${
            isHome
              ? 'bg-transparent border-0 px-1 py-1 text-[15px] leading-relaxed placeholder:text-foreground-subtle focus:outline-none min-h-[44px]'
              : 'input-field rounded-xl'
          }`}
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={!input.trim() || streaming}
          className={
            isHome
              ? 'shrink-0 px-4 py-2 text-sm font-medium bg-foreground text-surface rounded-lg hover:bg-foreground/90 disabled:opacity-30 transition-colors'
              : 'px-4 py-2.5 btn-primary rounded-xl'
          }
        >
          {streaming ? '…' : 'Send'}
        </button>
      </div>
      {isHome && (
        <p className="text-[10px] text-foreground-subtle mt-2">Enter to send · Shift+Enter for new line</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex-1 overflow-y-auto min-h-0 ${isHome ? 'space-y-5 py-4' : 'space-y-4 pb-4'}`}>
        {messages.length === 0 && (
          <div className={isHome ? 'space-y-5' : 'text-center py-12 space-y-3'}>
            {isHome ? (
              <>
                <p className="text-[15px] text-foreground leading-relaxed max-w-lg">
                  Your workforce is ready. Ask for research, drafts, schedule checks, profile updates — or pick a starter below.
                </p>
                <div className="flex flex-wrap gap-2">
                  {HOME_SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={streaming}
                      className="text-left text-[12px] text-foreground-muted px-3 py-2 rounded-lg border border-border hover:border-foreground/20 hover:text-foreground hover:bg-surface-subtle/50 transition-colors disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="text-foreground-muted text-sm">Your chief of staff is ready.</div>
                <div className="text-foreground-subtle text-xs space-y-1">
                  {HOME_SUGGESTIONS.map(s => (
                    <div key={s}>&ldquo;{s}&rdquo;</div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} msg={msg} variant={variant} />
        ))}
        <div ref={bottomRef} />
      </div>

      {composer}
    </div>
  );
}
