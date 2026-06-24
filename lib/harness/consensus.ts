import { generateText } from 'ai';
import { getModel } from '@/lib/ai/provider';
import type { HarnessContext, Decision, Vote } from './types';
import { getAgentByRole } from './registry';
import { getStateKeys } from './state';

function buildVotePrompt(
  role: string,
  domain: string,
  topic: string,
  context: Record<string, unknown>,
  priorVotes: Vote[],
  round: number
): string {
  const contextStr = JSON.stringify(context, null, 2);
  const priorStr = round === 1
    ? 'This is round 1. Submit your initial position.'
    : `Round ${round - 1} positions:\n${priorVotes
        .filter(v => v.round === round - 1)
        .map(v => `${v.role}: ${v.position} (confidence: ${v.confidence})`)
        .join('\n')}\n\nReview the above. You may revise your position or maintain it — but you must justify either choice.`;

  return `You are the ${role} (domain: ${domain}).

TOPIC FOR CONSENSUS: ${topic}

CONTEXT:
${contextStr}

${priorStr}

Respond ONLY with valid JSON (no markdown, no preamble):
{
  "position": "Your specific, actionable position on this topic",
  "confidence": 0.8,
  "reasoning": "Why you hold this position, referencing specific context above"
}`;
}

function buildArbitrationPrompt(
  parentRole: string,
  decision: Decision,
  context: Record<string, unknown>
): string {
  const votesSummary = decision.votes
    .map(v => `${v.role} (round ${v.round}, confidence ${v.confidence}): ${v.position}\nReasoning: ${v.reasoning}`)
    .join('\n\n');

  return `You are the ${parentRole}. Consensus was not reached after ${decision.rounds} rounds on: "${decision.topic}"

Stakeholder positions:
${votesSummary}

CONTEXT:
${JSON.stringify(context, null, 2)}

You have final authority. Make a binding decision.

Respond ONLY with valid JSON:
{
  "decision": "Your binding resolution — specific and immediately actionable",
  "rationale": "Why this resolves the tension in the right way"
}`;
}

function measureConsensus(votes: Vote[], threshold: number, round: number): boolean {
  const roundVotes = votes.filter(v => v.round === round);
  if (roundVotes.length === 0) return false;
  const avgConf = roundVotes.reduce((s, v) => s + v.confidence, 0) / roundVotes.length;
  return avgConf >= threshold;
}

function extractJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON in: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export interface ConsensusResult {
  outcome: string;
  decidedBy: 'consensus' | 'parent';
  rounds: number;
  decision: Decision;
}

export async function runConsensus(
  ctx: HarnessContext,
  stakeholderRoles: string[],
  topic: string,
  contextKeys: string[],
  parentRole: string
): Promise<ConsensusResult> {
  const decisionId = crypto.randomUUID();
  const threshold = ctx.config.consensusThreshold;
  const contextData = getStateKeys(ctx.state, contextKeys);

  const decision: Decision = {
    id: decisionId,
    entityId: ctx.entityId,
    topic,
    contextKeys,
    stakeholderRoles,
    votes: [],
    rounds: 0,
    phase: 'collecting',
    threshold,
    openedAt: new Date().toISOString(),
  };

  ctx.send({
    type: 'consensus_started',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    data: { decisionId, topic, stakeholderRoles },
    timestamp: new Date().toISOString(),
  });

  const MAX_ROUNDS = 2;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    decision.rounds = round;
    decision.phase = round === 1 ? 'collecting' : 'negotiating';

    const roundVotes = await Promise.all(
      stakeholderRoles.map(async role => {
        const agent = getAgentByRole(ctx.registry, role);
        if (!agent) return null;

        const prompt = buildVotePrompt(role, agent.domain, topic, contextData, decision.votes, round);
        const voteModel = agent.model.includes('haiku') ? agent.model : 'claude-haiku-4-5-20251001';

        const resp = await generateText({
          model: getModel(voteModel),
          prompt,
          maxTokens: 512,
        });

        ctx.cost.recordUsage(
          resp.usage?.promptTokens ?? 0,
          resp.usage?.completionTokens ?? 0,
          { agentId: agent.id, agentRole: agent.role, model: voteModel },
        );

        const parsed = extractJSON<{ position: string; confidence: number; reasoning: string }>(resp.text);

        const vote: Vote = {
          agentId: agent.id,
          role,
          position: parsed.position,
          confidence: Math.min(1, Math.max(0, parsed.confidence)),
          reasoning: parsed.reasoning,
          round,
          submittedAt: new Date().toISOString(),
        };

        ctx.send({
          type: 'consensus_vote',
          sessionId: ctx.sessionId,
          entityId: ctx.entityId,
          agentId: agent.id,
          agentRole: role,
          data: { decisionId, round, position: vote.position, confidence: vote.confidence },
          timestamp: new Date().toISOString(),
        });

        return vote;
      })
    );

    decision.votes.push(...roundVotes.filter((v): v is Vote => !!v));

    if (measureConsensus(decision.votes, threshold, round)) {
      const outcome = decision.votes
        .filter(v => v.round === round)
        .map(v => v.position)
        .join(' | ');

      decision.outcome = outcome;
      decision.decidedBy = 'consensus';
      decision.phase = 'resolved';
      decision.resolvedAt = new Date().toISOString();

      ctx.state.decisions.push(decision);
      ctx.send({
        type: 'consensus_resolved',
        sessionId: ctx.sessionId,
        entityId: ctx.entityId,
        data: { decisionId, topic, outcome, decidedBy: 'consensus', rounds: round },
        timestamp: new Date().toISOString(),
      });

      return { outcome, decidedBy: 'consensus', rounds: round, decision };
    }
  }

  decision.phase = 'escalating';
  ctx.send({
    type: 'consensus_escalated',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    data: { decisionId, topic, escalatedTo: parentRole },
    timestamp: new Date().toISOString(),
  });

  const parentAgent = getAgentByRole(ctx.registry, parentRole);
  if (!parentAgent) throw new Error(`Parent agent '${parentRole}' not in registry for escalation`);

  const arbPrompt = buildArbitrationPrompt(parentRole, decision, contextData);
  const arbResp = await generateText({
    model: getModel(parentAgent.model),
    prompt: arbPrompt,
    maxTokens: 1024,
    ...(parentAgent.useThinking
      ? {
          providerOptions: {
            anthropic: {
              thinking: { type: 'enabled', budgetTokens: parentAgent.thinkingBudget ?? 1000 },
            },
          },
        }
      : {}),
  });

  ctx.cost.recordUsage(
    arbResp.usage?.promptTokens ?? 0,
    arbResp.usage?.completionTokens ?? 0,
    { agentId: parentAgent.id, agentRole: parentRole, model: parentAgent.model },
  );

  const arb = extractJSON<{ decision: string; rationale: string }>(arbResp.text);

  decision.outcome = arb.decision;
  decision.decidedBy = 'parent';
  decision.parentRole = parentRole;
  decision.phase = 'resolved';
  decision.resolvedAt = new Date().toISOString();

  ctx.state.decisions.push(decision);
  ctx.send({
    type: 'consensus_resolved',
    sessionId: ctx.sessionId,
    entityId: ctx.entityId,
    data: { decisionId, topic, outcome: arb.decision, decidedBy: 'parent', parentRole },
    timestamp: new Date().toISOString(),
  });

  return { outcome: arb.decision, decidedBy: 'parent', rounds: MAX_ROUNDS, decision };
}
