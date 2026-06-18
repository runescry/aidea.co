import Anthropic from '@anthropic-ai/sdk';
import { writeSession, updateSession, findSession } from './memory';
import { runCEOIdentity, runCEODirective, runCEOReview, runCEOArbitration } from './agents/ceo';
import { runConflictDetector } from './agents/conflict-detector';
import { runCPO } from './agents/leads/cpo';
import { runCMO } from './agents/leads/cmo';
import { runCTO } from './agents/leads/cto';
import { runCFO } from './agents/leads/cfo';
import { runCopywriter } from './working-groups/copywriter';
import { runOutreach } from './working-groups/outreach';
import { runPricing } from './working-groups/pricing';
import { runResearch } from './working-groups/research';
import type { RunRequest, MemorySession, Cycle, SSEEvent, AgentId } from '@/types';

type Sender = (e: SSEEvent) => void;

function ev<T>(
  type: SSEEvent['type'],
  sessionId: string,
  cycleNumber: number,
  data: T,
  agent?: AgentId
): SSEEvent<T> {
  return { type, agent, sessionId, cycleNumber, data, timestamp: new Date().toISOString() };
}

async function runCEOReviewStep(
  client: Anthropic,
  session: MemorySession,
  cycle: Cycle,
  send: Sender
): Promise<void> {
  const { sessionId, companyIdentity: identity } = session;
  if (!identity) throw new Error('No company identity in session');

  send(ev('ceo_review_start', sessionId, 2, {}, 'ceo'));

  const cycle2Directive = await runCEOReview(
    client,
    identity,
    cycle,
    cycle.conflictReport ?? null,
    send,
    sessionId
  );

  cycle.cycle2Directive = cycle2Directive;
  cycle.completedAt = new Date().toISOString();
  session.status = 'complete';
  await updateSession(session);

  send(ev('ceo_cycle2_complete', sessionId, 2, { directive: cycle2Directive }, 'ceo'));
  send(ev('session_complete', sessionId, 2, { sessionId, totalCycles: 2 }));
}

export async function runOrchestrator(request: RunRequest, send: Sender): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set. Create a .env.local file with your key.');
  }

  const client = new Anthropic({ apiKey });

  // Resume a paused session
  if (request.sessionId) {
    const existing = findSession(request.sessionId);
    if (existing?.status === 'paused' && existing.cycles.length > 0) {
      existing.status = 'running';
      await updateSession(existing);
      await runCEOReviewStep(client, existing, existing.cycles[0], send);
      return;
    }
  }

  // ── New session ────────────────────────────────────────────────────────────
  const sessionId = crypto.randomUUID();
  const session: MemorySession = {
    sessionId,
    idea: request.idea,
    mode: request.mode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cycles: [],
    status: 'running',
  };
  await writeSession(session);
  send(ev('session_start', sessionId, 1, { sessionId, idea: request.idea, mode: request.mode }));

  // ── Step 1: CEO Identity ────────────────────────────────────────────────────
  send(ev('ceo_identity_start', sessionId, 1, {}, 'ceo'));
  const companyIdentity = await runCEOIdentity(client, request.idea, send, sessionId);
  session.companyIdentity = companyIdentity;
  await updateSession(session);
  send(ev('ceo_identity_complete', sessionId, 1, { companyIdentity }, 'ceo'));

  // ── Step 2: CEO Directive ───────────────────────────────────────────────────
  send(ev('ceo_directive_start', sessionId, 1, {}, 'ceo'));
  const directive = await runCEODirective(client, companyIdentity, request.idea, 1, send, sessionId);
  const cycle: Cycle = { number: 1, directive, startedAt: new Date().toISOString() };
  session.cycles.push(cycle);
  await updateSession(session);
  send(ev('ceo_directive_complete', sessionId, 1, { directive }, 'ceo'));

  // ── Step 3: Functional Leads (parallel) ────────────────────────────────────
  (['cpo', 'cmo', 'cto', 'cfo'] as const).forEach(id =>
    send(ev('lead_start', sessionId, 1, {}, id))
  );

  const [cpoOutput, cmoOutput, ctoOutput, cfoOutput] = await Promise.all([
    runCPO(client, companyIdentity, directive, send, sessionId).then(o => {
      send(ev('lead_complete', sessionId, 1, { output: o }, 'cpo'));
      return o;
    }),
    runCMO(client, companyIdentity, directive, send, sessionId).then(o => {
      send(ev('lead_complete', sessionId, 1, { output: o }, 'cmo'));
      return o;
    }),
    runCTO(client, companyIdentity, directive, send, sessionId).then(o => {
      send(ev('lead_complete', sessionId, 1, { output: o }, 'cto'));
      return o;
    }),
    runCFO(client, companyIdentity, directive, send, sessionId).then(o => {
      send(ev('lead_complete', sessionId, 1, { output: o }, 'cfo'));
      return o;
    }),
  ]);

  const leadOutputs = { cpo: cpoOutput, cmo: cmoOutput, cto: ctoOutput, cfo: cfoOutput };
  cycle.leadOutputs = leadOutputs;
  await updateSession(session);
  send(ev('all_leads_complete', sessionId, 1, { leadOutputs }));

  // ── Step 4: Conflict Detection ─────────────────────────────────────────────
  send(ev('conflict_checking', sessionId, 1, {}, 'conflict_detector'));
  let conflictReport = await runConflictDetector(client, cmoOutput, ctoOutput, companyIdentity);
  send(ev('conflict_result', sessionId, 1, { conflictReport }, 'conflict_detector'));

  if (conflictReport.hasConflict && conflictReport.severity === 'blocking') {
    send(ev('ceo_arbitration_start', sessionId, 1, { conflict: conflictReport }, 'ceo'));
    const arbitration = await runCEOArbitration(client, conflictReport, companyIdentity, directive);
    conflictReport = { ...conflictReport, ...arbitration };
    send(ev('ceo_arbitration_complete', sessionId, 1, { conflictReport }, 'ceo'));
  }

  cycle.conflictReport = conflictReport;
  await updateSession(session);

  // ── Step 5: Working Groups (parallel) ──────────────────────────────────────
  (['copywriter', 'outreach', 'pricing', 'research'] as const).forEach(id =>
    send(ev('working_group_start', sessionId, 1, {}, id))
  );

  const [copywriterArtifact, outreachArtifact, pricingArtifact, researchArtifact] = await Promise.all([
    runCopywriter(client, companyIdentity, cmoOutput, cpoOutput, directive, send, sessionId).then(a => {
      send(ev('working_group_complete', sessionId, 1, { artifact: a }, 'copywriter'));
      return a;
    }),
    runOutreach(client, companyIdentity, cmoOutput, cpoOutput, send, sessionId).then(a => {
      send(ev('working_group_complete', sessionId, 1, { artifact: a }, 'outreach'));
      return a;
    }),
    runPricing(client, companyIdentity, cpoOutput, cfoOutput, send, sessionId).then(a => {
      send(ev('working_group_complete', sessionId, 1, { artifact: a }, 'pricing'));
      return a;
    }),
    runResearch(client, companyIdentity, cpoOutput, cmoOutput, send, sessionId).then(a => {
      send(ev('working_group_complete', sessionId, 1, { artifact: a }, 'research'));
      return a;
    }),
  ]);

  const artifacts = {
    copywriter: copywriterArtifact,
    outreach: outreachArtifact,
    pricing: pricingArtifact,
    research: researchArtifact,
  };
  cycle.artifacts = artifacts;
  await updateSession(session);
  send(ev('all_working_groups_complete', sessionId, 1, { artifacts }));

  // ── Step 6: Pause check ────────────────────────────────────────────────────
  if (request.mode === 'pause_after_working_groups') {
    session.status = 'paused';
    await updateSession(session);
    send(ev('session_paused', sessionId, 1, {
      message: 'Paused after working groups. Review artifacts above, then resume for CEO Cycle 2 directive.',
      sessionId,
    }));
    return;
  }

  // ── Step 7: CEO Review → Cycle 2 Directive ─────────────────────────────────
  await runCEOReviewStep(client, session, cycle, send);
}
