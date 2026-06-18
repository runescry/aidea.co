'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { HarnessEvent } from '@/lib/harness/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ tool: string; summary: string }>;
  timestamp: string;
  status?: 'streaming' | 'done' | 'error';
}

function ToolPill({ tool, summary }: { tool: string; summary: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-500 py-0.5">
      <span className="text-gray-700">›</span>
      <span className="text-blue-600">{tool}</span>
      <span className="text-gray-700 truncate max-w-[200px]">{summary}</span>
    </div>
  );
}

function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 max-w-[85%]">
      {msg.toolCalls && msg.toolCalls.length > 0 && (
        <div className="px-1">
          {msg.toolCalls.map((tc, i) => (
            <ToolPill key={i} tool={tc.tool} summary={tc.summary} />
          ))}
        </div>
      )}
      <div className={`bg-gray-800 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-gray-100 leading-relaxed ${
        msg.status === 'streaming' ? 'border border-blue-800/50' : ''
      }`}>
        {msg.content || (msg.status === 'streaming' ? <span className="text-gray-600 animate-pulse">thinking...</span> : null)}
        {msg.status === 'error' && <span className="text-red-400 text-xs ml-1">⚠ error</span>}
      </div>
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    const command = input.trim();
    if (!command || streaming) return;

    setInput('');
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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as HarnessEvent;
            handleEvent(event, assistantMsgId);
          } catch { /* skip */ }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, status: 'done' } : m
      ));
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
    }
  }, [input, streaming]);

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

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <div className="text-gray-700 text-sm">Your chief of staff is ready.</div>
            <div className="text-gray-800 text-xs space-y-1">
              <div>"What's urgent in my inbox?"</div>
              <div>"Draft a reply to Sarah about the budget"</div>
              <div>"What's my schedule tomorrow?"</div>
              <div>"Research [company] before my 3pm"</div>
            </div>
          </div>
        )}
        {messages.map(msg => (
          <ChatMessage key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Message your chief of staff..."
            disabled={streaming}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-600 placeholder-gray-600 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {streaming ? '...' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
