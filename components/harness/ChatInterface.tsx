'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatConversations } from '@/hooks/useChatConversations';
import type { ChatMessage } from '@/types/chat';
import ChatMarkdown from './ChatMarkdown';
import InboxSummaryCard, { isInboxStructured, type DispatchInboxStructured } from './chat/InboxSummaryCard';
import NewsHeadlinesCard, { isNewsStructured, type DispatchNewsStructured } from './chat/NewsHeadlinesCard';

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

function AssistantContent({ msg, variant }: { msg: ChatMessage; variant: 'default' | 'home' }) {
  const isHome = variant === 'home';
  const streaming = msg.status === 'streaming';

  if (streaming && !msg.content) {
    return <span className="text-foreground-subtle animate-pulse">Working…</span>;
  }

  if (streaming && isHome && msg.content && !msg.content.includes('\n\n')) {
    return (
      <span className="text-foreground-muted animate-pulse">{msg.content}</span>
    );
  }

  if (msg.status === 'error') {
    return (
      <div className="text-sm text-foreground leading-relaxed">
        {msg.content ? <ChatMarkdown content={msg.content} /> : 'Something went wrong.'}
        <span className="text-danger text-xs ml-1">Error</span>
      </div>
    );
  }

  if (isInboxStructured(msg.structured)) {
    return (
      <InboxSummaryCard
        data={msg.structured as DispatchInboxStructured}
        fallbackMarkdown={msg.content}
      />
    );
  }

  if (isNewsStructured(msg.structured)) {
    return (
      <NewsHeadlinesCard data={msg.structured as DispatchNewsStructured} />
    );
  }

  if (msg.content) {
    return <ChatMarkdown content={msg.content} />;
  }

  return null;
}

function ChatMessageRow({ msg, variant }: { msg: ChatMessage; variant: 'default' | 'home' }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className={`max-w-[85%] text-sm leading-relaxed ${
          variant === 'home'
            ? 'bg-accent/12 text-foreground border border-accent/25 rounded-2xl rounded-br-sm px-4 py-2.5'
            : 'bg-accent text-accent-foreground rounded-2xl rounded-br-md px-4 py-2.5'
        }`}>
          {msg.content}
        </div>
      </div>
    );
  }

  const showToolPills = msg.toolCalls && msg.toolCalls.length > 0;
  const homeSteps = variant === 'home' && showToolPills;

  return (
    <div className="flex flex-col gap-1 max-w-[90%]">
      {homeSteps && (
        <div className="text-[11px] text-foreground-subtle px-1">
          {msg.status === 'streaming' ? (
            <span className="animate-pulse">
              Step {msg.toolCalls!.length}: {msg.toolCalls![msg.toolCalls!.length - 1].tool.replace(/_/g, ' ')}
            </span>
          ) : (
            <span>{msg.toolCalls!.length} step{msg.toolCalls!.length === 1 ? '' : 's'}</span>
          )}
        </div>
      )}
      {showToolPills && variant !== 'home' && (
        <details className="px-1 group">
          <summary className="text-[11px] text-foreground-subtle cursor-pointer hover:text-foreground-muted list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">›</span>
            {msg.toolCalls!.length} step{msg.toolCalls!.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-1 space-y-0.5 pl-3 border-l border-border/60">
            {msg.toolCalls!.map((tc, i) => (
              <ToolPill key={i} tool={tc.tool} summary={tc.summary} />
            ))}
          </div>
        </details>
      )}
      <div className={`text-sm text-foreground leading-relaxed ${
        variant === 'home'
          ? 'rounded-xl border border-border bg-surface-subtle/30 px-4 py-3 max-w-full'
          : 'bg-surface border border-border rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm'
      } ${msg.status === 'streaming' && variant !== 'home' ? 'border-accent/30' : ''} ${msg.status === 'streaming' && variant === 'home' ? 'border-accent/20' : ''}`}>
        <AssistantContent msg={msg} variant={variant} />
      </div>
    </div>
  );
}

interface Props {
  variant?: 'default' | 'home';
  onMessageComplete?: () => void;
  prefill?: string | null;
  onPrefillApplied?: () => void;
}

export default function ChatInterface({
  variant = 'default',
  onMessageComplete,
  prefill,
  onPrefillApplied,
}: Props) {
  const { activeConversation, streaming, sendMessage, syncReady } = useChatConversations();
  const messages = activeConversation.messages;
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasStreamingRef = useRef(false);
  const isHome = variant === 'home';

  useEffect(() => {
    if (!prefill?.trim()) return;
    setInput(prefill);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
      inputRef.current.focus();
    }
    onPrefillApplied?.();
  }, [prefill, onPrefillApplied]);

  useEffect(() => {
    if (wasStreamingRef.current && !streaming) {
      onMessageComplete?.();
    }
    wasStreamingRef.current = streaming;
  }, [streaming, onMessageComplete]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' });
  }, [messages, activeConversation.id, streaming]);

  useEffect(() => {
    if (isHome) inputRef.current?.focus();
  }, [isHome, activeConversation.id]);

  const send = useCallback(async (text?: string) => {
    const command = (text ?? input).trim();
    if (!command || streaming) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    await sendMessage(command);
  }, [input, streaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const composer = (
    <div className={isHome ? 'shrink-0 pt-3 pb-3 md:pt-4 md:pb-5' : 'border-t border-border pt-4'}>
      {isHome && (
        <label htmlFor="chief-of-staff-input" className="block text-[11px] font-medium text-foreground-muted mb-2">
          Message
        </label>
      )}
      <div className={`flex gap-2 ${isHome ? 'items-end rounded-xl border border-border bg-surface-subtle/40 p-3 shadow-sm focus-within:border-accent/30 focus-within:ring-2 focus-within:ring-accent/10' : ''}`}>
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
              ? 'shrink-0 px-4 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 disabled:opacity-30 transition-colors'
              : 'px-4 py-2.5 btn-primary rounded-xl'
          }
        >
          {streaming ? '…' : 'Send'}
        </button>
      </div>
      {isHome && (
        <p className="text-[10px] text-foreground-subtle mt-2 hidden sm:block">Enter to send · Shift+Enter for new line</p>
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
                      className="text-left text-[12px] text-foreground-muted px-3 py-2 rounded-lg border border-accent/20 hover:border-accent/40 hover:text-foreground hover:bg-accent/5 transition-colors disabled:opacity-50"
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
          <ChatMessageRow key={msg.id} msg={msg} variant={variant} />
        ))}
        <div ref={bottomRef} />
      </div>

      {isHome && !syncReady && (
        <p className="text-[10px] text-foreground-subtle mb-2">Restoring conversation…</p>
      )}
      {composer}
    </div>
  );
}
