import Anthropic from '@anthropic-ai/sdk';
import type { HarnessAgent, HarnessContext, ToolInput } from './types';
import { setAgentStatus, patchAgent } from './registry';
import { getStateKeys } from './state';
import { buildAnthropicTools, executeHarnessTool } from './tools';
import { spawnChildAgent } from './spawn';

// ── Context builder ───────────────────────────────────────────────────────────

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

// ── Loop detection ────────────────────────────────────────────────────────────

interface ToolCall { name: string; inputHash: string }

function hashInput(input: ToolInput): string {
  return JSON.stringify(input ?? {});
}

// ── The agentic loop ──────────────────────────────────────────────────────────

export async function runAgentLoop(
  client: Anthropic,
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
  const tools = buildAnthropicTools(agent.allowedTools);

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

  const recentToolCalls: ToolCall[] = [];
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;

      if (ctx.cost.isOverBudget()) {
        throw new Error('Token budget exceeded mid-loop');
      }

      const createParams: Anthropic.MessageCreateParams = {
        model: agent.model,
        max_tokens: agent.maxTokens ?? 4096,
        system: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        messages,
        ...(agent.useThinking
          ? { thinking: { type: 'enabled' as const, budget_tokens: agent.thinkingBudget ?? 3000 } }
          : {}),
      };

      const response = await client.messages.create(createParams);

      ctx.cost.recordUsage(
        response.usage.input_tokens,
        response.usage.output_tokens,
        response.usage.cache_read_input_tokens ?? 0,
        response.usage.cache_creation_input_tokens ?? 0
      );

      patchAgent(ctx.registry, agent.id, {
        tokensUsed: (ctx.registry.agents.get(agent.id)?.tokensUsed ?? 0) + response.usage.output_tokens,
      });

      // Emit cost update every iteration
      if (ctx.cost.isNearBudget()) {
        ctx.send({
          type: 'cost_warning',
          sessionId: ctx.sessionId,
          entityId: ctx.entityId,
          data: { cost: ctx.cost.snapshot() },
          timestamp: new Date().toISOString(),
        });
      }

      // ── Handle tool use ──────────────────────────────────────────────────────
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (toolUseBlocks.length > 0) {
        // Loop detection
        for (const block of toolUseBlocks) {
          const call: ToolCall = { name: block.name, inputHash: hashInput(block.input as ToolInput) };
          const duplicate = recentToolCalls.some(
            c => c.name === call.name && c.inputHash === call.inputHash
          );
          if (duplicate) {
            throw new Error(`Loop detected: agent called ${block.name} with same args twice`);
          }
          recentToolCalls.push(call);
          if (recentToolCalls.length > 10) recentToolCalls.shift();
        }

        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          ctx.send({
            type: 'tool_called',
            sessionId: ctx.sessionId,
            entityId: ctx.entityId,
            agentId: agent.id,
            agentRole: agent.role,
            data: { tool: block.name, input: block.input },
            timestamp: new Date().toISOString(),
          });

          let result: unknown;
          try {
            result = await executeHarnessTool(
              client,
              block.name,
              block.input as ToolInput,
              agent,
              ctx,
              (role, domain, mission, authority, parentAgent) => {
                const child = spawnChildAgent(role, domain, mission, authority, parentAgent, ctx, runAgentLoop.bind(null, client));
                return Promise.resolve({ agentId: child.id });
              }
            );
          } catch (err) {
            result = { error: String(err) };
          }

          ctx.send({
            type: 'tool_result',
            sessionId: ctx.sessionId,
            entityId: ctx.entityId,
            agentId: agent.id,
            agentRole: agent.role,
            data: { tool: block.name, result },
            timestamp: new Date().toISOString(),
          });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // ── Agent is done (end_turn with no tool use) ─────────────────────────
      if (response.stop_reason === 'end_turn') {
        setAgentStatus(ctx.registry, agent.id, 'complete');
        const textContent = response.content.find(b => b.type === 'text')?.text ?? '';

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
            summary: textContent.slice(0, 200),
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

      // max_tokens hit — agent may have truncated output
      if (response.stop_reason === 'max_tokens') {
        throw new Error(`Agent ${agent.role} hit max_tokens limit`);
      }
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
