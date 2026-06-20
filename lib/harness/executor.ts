import { generateText, type CoreMessage } from 'ai';
import type { HarnessAgent, HarnessContext, ToolInput } from './types';
import { setAgentStatus, patchAgent } from './registry';
import { getStateKeys } from './state';
import { executeHarnessTool } from './tools';
import { spawnChildAgent } from './spawn';
import { getModel } from '@/lib/ai/provider';
import { buildAiSdkTools } from '@/lib/ai/tools';
import { formatConversationHistory } from '@/lib/chat/history';
import type { ChatHistoryEntry } from '@/types/chat';

function buildAgentPrompt(agent: HarnessAgent, ctx: HarnessContext): string {
  const stateContext = getStateKeys(ctx.state, agent.stateReadKeys);
  const hasContext = Object.values(stateContext).some(v => v !== null);
  const command = ctx.state.data.command as string | undefined;
  const history = ctx.state.data.conversationHistory as ChatHistoryEntry[] | undefined;

  return [
    hasContext
      ? `ENTITY STATE (your context):\n${JSON.stringify(stateContext, null, 2)}`
      : '',
    ctx.state.data.dailyKickstartComplete && agent.role === 'daily-orchestrator'
      ? 'STATUS: kb_read and spawn_agent (5 parallel sub-agents) are already complete. Do NOT repeat them. Call wait_for_agents with roles ["inbox-triage","calendar-reader","health-briefer","news-curator","work-prep"], then read their state keys and write morning_brief.'
      : '',
    history?.length
      ? `CONVERSATION HISTORY (use for references like "the second one", "that email", "reply to #2"):\n${formatConversationHistory(history)}`
      : '',
    command ? `CURRENT USER COMMAND:\n${command}` : '',
    `ENTITY MISSION: ${ctx.config.mission}`,
    agent.memory.crossRunContext
      ? `YOUR PRIOR CONTEXT:\n${agent.memory.crossRunContext}`
      : '',
  ].filter(Boolean).join('\n\n');
}

function buildAgentSummary(
  agent: HarnessAgent,
  ctx: HarnessContext,
  resultText: string,
): string {
  const fromText = resultText.trim();
  if (fromText) return fromText;

  const stateVal = agent.stateWriteKey ? ctx.state.data[agent.stateWriteKey] : null;
  if (stateVal && typeof stateVal === 'object' && stateVal !== null && 'summary' in stateVal) {
    const s = (stateVal as { summary?: unknown }).summary;
    if (typeof s === 'string' && s.trim()) return s.trim();
  }
  if (typeof stateVal === 'string' && stateVal.trim()) return stateVal.trim();

  return 'Done.';
}

interface ToolCallRecord { name: string; inputHash: string }

function hashInput(input: ToolInput): string {
  return JSON.stringify(input ?? {});
}

function completeAgent(
  agent: HarnessAgent,
  ctx: HarnessContext,
  resultText: string,
): void {
  setAgentStatus(ctx.registry, agent.id, 'complete');
  ctx.send({
    type: 'agent_complete',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    agentId: agent.id,
    agentRole: agent.role,
    data: {
      tier: agent.tier,
      stateWriteKey: agent.stateWriteKey,
      tokensUsed: ctx.registry.agents.get(agent.id)?.tokensUsed ?? 0,
      summary: buildAgentSummary(agent, ctx, resultText).slice(0, 8000),
      structured: agent.stateWriteKey ? ctx.state.data[agent.stateWriteKey] : undefined,
    },
    timestamp: new Date().toISOString(),
  });

  ctx.send({
    type: 'cost_update',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    data: { cost: ctx.cost.snapshot() },
    timestamp: new Date().toISOString(),
  });
}

function shouldCompleteAfterTools(
  agent: HarnessAgent,
  ctx: HarnessContext,
  toolNames: string[],
): boolean {
  if (!agent.stateWriteKey || !toolNames.includes('write_state')) return false;
  const response = ctx.state.data[agent.stateWriteKey];
  if (!response || typeof response !== 'object') return false;
  return true;
}

export async function runAgentLoop(
  agent: HarnessAgent,
  ctx: HarnessContext
): Promise<void> {
  if (ctx.cost.isOverBudget()) {
    ctx.send({
      type: 'budget_exceeded',
      sessionId: ctx.sessionId,
      entityId: ctx.entityId,
      agentId: agent.id,
      agentRole: agent.role,
      data: { cost: ctx.cost.snapshot() },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  setAgentStatus(ctx.registry, agent.id, 'running');
  ctx.send({
    type: 'agent_started',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    agentId: agent.id,
    agentRole: agent.role,
    data: { tier: agent.tier, domain: agent.domain },
    timestamp: new Date().toISOString(),
  });

  const systemPrompt = agent.systemPrompt;
  const userPrompt = buildAgentPrompt(agent, ctx);
  const aiTools = buildAiSdkTools(agent.allowedTools);
  const hasTools = Object.keys(aiTools).length > 0;

  const messages: CoreMessage[] = [{ role: 'user', content: userPrompt }];
  const recentToolCalls: ToolCallRecord[] = [];
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  const spawnFn = (role: string, domain: string, mission: string, authority: string, parentAgent: HarnessAgent) => {
    const child = spawnChildAgent(role, domain, mission, authority, parentAgent, ctx, runAgentLoop);
    return Promise.resolve({ agentId: child.id });
  };

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      if (ctx.cost.isOverBudget()) {
        throw new Error('Token budget exceeded mid-loop');
      }

      const kickstarted = agent.role === 'daily-orchestrator' && ctx.state.data.dailyKickstartComplete;

      const result = await generateText({
        model: getModel(agent.model),
        system: systemPrompt,
        messages,
        tools: hasTools ? aiTools : undefined,
        toolChoice:
          kickstarted && iterations === 1
            ? { type: 'tool', toolName: 'wait_for_agents' }
            : iterations === 1 && agent.authority === 'directive' && hasTools
              ? 'required'
              : 'auto',
        maxTokens: agent.maxTokens ?? 4096,
        ...(agent.useThinking
          ? {
              providerOptions: {
                anthropic: {
                  thinking: { type: 'enabled', budgetTokens: agent.thinkingBudget ?? 3000 },
                },
              },
            }
          : {}),
      });

      if (result.text) {
        ctx.send({
          type: 'agent_text_delta',
          sessionId: ctx.sessionId,
          entityId: ctx.entityId,
          agentId: agent.id,
          agentRole: agent.role,
          data: { delta: result.text },
          timestamp: new Date().toISOString(),
        });
      }

      ctx.cost.recordUsage(
        result.usage?.promptTokens ?? 0,
        result.usage?.completionTokens ?? 0,
        0,
        0,
      );

      patchAgent(ctx.registry, agent.id, {
        tokensUsed: (ctx.registry.agents.get(agent.id)?.tokensUsed ?? 0) + (result.usage?.completionTokens ?? 0),
      });

      if (ctx.cost.isNearBudget()) {
        ctx.send({
          type: 'cost_warning',
          sessionId: ctx.sessionId,
          entityId: ctx.entityId,
          data: { cost: ctx.cost.snapshot() },
          timestamp: new Date().toISOString(),
        });
      }

      const toolCalls = result.toolCalls;

      if (toolCalls.length > 0) {
        for (const tc of toolCalls) {
          const call: ToolCallRecord = { name: tc.toolName, inputHash: hashInput(tc.args as ToolInput) };
          const duplicate = recentToolCalls.some(
            c => c.name === call.name && c.inputHash === call.inputHash
          );
          if (duplicate) {
            throw new Error(`Loop detected: agent called ${tc.toolName} with same args twice`);
          }
          recentToolCalls.push(call);
          if (recentToolCalls.length > 10) recentToolCalls.shift();
        }

        messages.push({
          role: 'assistant',
          content: toolCalls.map(tc => ({
            type: 'tool-call' as const,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
          })),
        });

        const toolResultParts: Array<{
          type: 'tool-result';
          toolCallId: string;
          toolName: string;
          result: unknown;
        }> = [];

        for (const tc of toolCalls) {
          ctx.send({
            type: 'tool_called',
            sessionId: ctx.sessionId,
            entityId: ctx.entityId,
            agentId: agent.id,
            agentRole: agent.role,
            data: { tool: tc.toolName, input: tc.args as Record<string, unknown> },
            timestamp: new Date().toISOString(),
          });

          let toolResult: unknown;
          try {
            toolResult = await executeHarnessTool(
              tc.toolName,
              tc.args as ToolInput,
              agent,
              ctx,
              spawnFn
            );
          } catch (err) {
            toolResult = { error: String(err) };
          }

          ctx.send({
            type: 'tool_result',
            sessionId: ctx.sessionId,
            entityId: ctx.entityId,
            agentId: agent.id,
            agentRole: agent.role,
            data: { tool: tc.toolName, result: toolResult },
            timestamp: new Date().toISOString(),
          });

          toolResultParts.push({
            type: 'tool-result',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            result: toolResult,
          });
        }

        const pending = ctx.bus.drain(agent.role);
        messages.push({ role: 'tool', content: toolResultParts });

        if (pending.length > 0) {
          const incomingText = pending.map(m =>
            `[${m.type.toUpperCase()} from ${m.fromRole} re: ${m.topic}] ${m.content}`
          ).join('\n');
          messages.push({ role: 'user', content: `INCOMING MESSAGES:\n${incomingText}` });
        }

        if (shouldCompleteAfterTools(agent, ctx, toolResultParts.map(p => p.toolName))) {
          completeAgent(agent, ctx, '');
          return;
        }

        continue;
      }

      if (result.finishReason === 'length') {
        throw new Error(`Agent ${agent.role} hit max_tokens limit`);
      }

      completeAgent(agent, ctx, result.text ?? '');
      return;
    }

    throw new Error(`Agent ${agent.role} exceeded max iterations (${MAX_ITERATIONS})`);
  } catch (err) {
    setAgentStatus(ctx.registry, agent.id, 'error');
    ctx.send({
      type: 'agent_error',
      sessionId: ctx.sessionId,
      entityId: ctx.entityId,
      agentId: agent.id,
      agentRole: agent.role,
      data: { error: String(err) },
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}
