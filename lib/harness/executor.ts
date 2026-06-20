import { generateText, type CoreMessage } from 'ai';
import type { HarnessAgent, HarnessContext, ToolInput } from './types';
import { setAgentStatus, patchAgent } from './registry';
import { getStateKeys } from './state';
import { executeHarnessTool } from './tools';
import { spawnChildAgent } from './spawn';
import { getModel } from '@/lib/ai/provider';
import { buildAiSdkTools } from '@/lib/ai/tools';

function buildAgentPrompt(agent: HarnessAgent, ctx: HarnessContext): string {
  const stateContext = getStateKeys(ctx.state, agent.stateReadKeys);
  const hasContext = Object.values(stateContext).some(v => v !== null);

  return [
    hasContext
      ? `ENTITY STATE (your context):\n${JSON.stringify(stateContext, null, 2)}`
      : '',
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

      const result = await generateText({
        model: getModel(agent.model),
        system: systemPrompt,
        messages,
        tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
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

      ctx.cost.recordUsage(
        result.usage?.promptTokens ?? 0,
        result.usage?.completionTokens ?? 0,
        0,
        0
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

      if (result.toolCalls.length > 0) {
        for (const tc of result.toolCalls) {
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
          content: result.toolCalls.map(tc => ({
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

        for (const tc of result.toolCalls) {
          ctx.send({
            type: 'tool_called',
            sessionId: ctx.sessionId,
            entityId: ctx.entityId,
            agentId: agent.id,
            agentRole: agent.role,
            data: { tool: tc.toolName, input: tc.args },
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

        continue;
      }

      if (result.finishReason === 'length') {
        throw new Error(`Agent ${agent.role} hit max_tokens limit`);
      }

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
          summary: buildAgentSummary(agent, ctx, result.text ?? '').slice(0, 8000),
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
