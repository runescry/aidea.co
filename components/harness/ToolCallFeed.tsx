'use client';
import { useEffect, useRef } from 'react';
import type { ToolCallRecord } from '@/hooks/useHarnessSession';

const TOOL_COLOR: Record<string, string> = {
  spawn_agent: 'text-blue-400',
  wait_for_agents: 'text-amber-400',
  write_state: 'text-green-400',
  read_state: 'text-gray-400',
  request_consensus: 'text-purple-400',
  send_message: 'text-cyan-400',
  gmail_send: 'text-orange-400',
  github_commit: 'text-pink-400',
  calendar_create: 'text-teal-400',
};

function summariseInput(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case 'spawn_agent':
      return `${input.agentId} — "${String(input.mission ?? '').slice(0, 60)}"`;
    case 'wait_for_agents':
      return `[${(input.agentIds as string[] ?? []).join(', ')}]`;
    case 'write_state':
      return `key="${input.key}"`;
    case 'read_state':
      return `keys=${JSON.stringify(input.keys)}`;
    case 'request_consensus':
      return `"${input.topic}" → [${(input.stakeholderRoles as string[] ?? []).join(', ')}]`;
    case 'send_message':
      return `→ ${input.toRole}: ${String(input.content ?? '').slice(0, 60)}`;
    default:
      return JSON.stringify(input).slice(0, 80);
  }
}

function summariseResult(result: unknown): string {
  if (result === undefined) return '…';
  if (typeof result === 'string') return result.slice(0, 100);
  if (typeof result === 'object' && result !== null) {
    const r = result as Record<string, unknown>;
    if ('ok' in r) return r.ok ? '✓ ok' : `✗ ${r.error ?? 'error'}`;
    if ('outcome' in r) return `outcome: ${String(r.outcome).slice(0, 80)}`;
    if ('agents' in r) return `waiting for ${(r.agents as string[]).length} agents`;
  }
  return JSON.stringify(result).slice(0, 100);
}

interface Props {
  toolCalls: ToolCallRecord[];
}

export default function ToolCallFeed({ toolCalls }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [toolCalls.length]);

  if (toolCalls.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-foreground-subtle text-sm">
        No tool calls yet
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full pr-1 space-y-0.5 text-xs font-mono">
      {toolCalls.map((tc, i) => (
        <div key={i} className="border-l-2 border-border pl-2 py-1">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground-subtle shrink-0">{tc.calledAt.slice(11, 19)}</span>
            <span className="text-foreground-muted shrink-0">[{tc.agentRole}]</span>
            <span className={`font-semibold shrink-0 ${TOOL_COLOR[tc.tool] ?? 'text-foreground'}`}>
              {tc.tool}
            </span>
            <span className="text-foreground-muted truncate">{summariseInput(tc.tool, tc.input)}</span>
          </div>
          {tc.result !== undefined && (
            <div className="ml-[5.5rem] text-foreground-subtle truncate">
              ↳ {summariseResult(tc.result)}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
