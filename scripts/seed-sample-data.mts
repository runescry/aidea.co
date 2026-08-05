#!/usr/bin/env npx tsx
/**
 * Clear activity history and load realistic sample data for demo / dev use.
 * Safe to re-run — replaces everything each time.
 *
 * Usage:
 *   npm run seed
 */
import '../tests/integration/setup';
import { clearActivityHistory, saveQueuedAction, saveEntityState, writeLatestBrief } from '../lib/storage';

const TODAY = new Date().toISOString().split('T')[0];
const NOW = new Date().toISOString();

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

// ─── Sample action queue ───────────────────────────────────────────────────

const SAMPLE_QUEUE = [
  {
    id: 'q-001',
    type: 'email_reply' as const,
    summary: 'Reply to Sarah Chen re: Q3 budget proposal',
    detail: 'Sarah is waiting on your sign-off before she can finalise the marketing budget. Her email asks for approval or changes by EOD.',
    agentRole: 'inbox-triage',
    tool: 'gmail_draft',
    payload: {
      to: 'sarah.chen@acmecorp.com',
      subject: 'Re: Q3 budget proposal',
      body: `Hi Sarah,\n\nThanks for pulling this together — looks solid overall.\n\nA couple of small tweaks:\n- Move £5k from "events" to "paid social" given the conference got cancelled\n- Add a contingency line of ~10% as we discussed\n\nOtherwise approved. Go ahead and circulate to the wider team.\n\nCheers`,
      threadId: 'thread-abc123',
    },
    status: 'pending' as const,
    priority: 'high' as const,
    createdAt: ago(12),
  },
  {
    id: 'q-002',
    type: 'email_reply' as const,
    summary: 'Reply to James Okafor — intro to Maya Rodriguez',
    detail: 'James asked you to connect him with Maya. Draft introduces them and gives context on why they should meet.',
    agentRole: 'inbox-triage',
    tool: 'gmail_draft',
    payload: {
      to: 'james.okafor@ventures.io',
      cc: 'maya.rodriguez@studio.co',
      subject: 'Introduction: James Okafor ↔ Maya Rodriguez',
      body: `Hi both,\n\nConnecting you two as promised.\n\nMaya — James is building a Series A-stage B2B SaaS company in the logistics space and is looking for a strong design partner. His team has great product instincts but needs senior visual direction.\n\nJames — Maya leads design at Studio Co and has done exceptional work for several portfolio companies in your space. She's selective about new engagements, but I think this is worth a conversation.\n\nI'll leave you both to it. Hope this is useful!\n\nBest`,
      threadId: 'thread-def456',
    },
    status: 'pending' as const,
    priority: 'normal' as const,
    createdAt: ago(45),
  },
  {
    id: 'q-003',
    type: 'calendar_event' as const,
    summary: 'Block deep work: Thursday 9–12am',
    detail: 'You have 0 protected focus blocks this week and 18 meetings. Agent is proposing to block Thursday morning before anything else lands.',
    agentRole: 'calendar-reader',
    tool: 'calendar_draft',
    payload: {
      title: 'Deep work — do not book',
      start: `${TODAY}T09:00:00`,
      end: `${TODAY}T12:00:00`,
      description: 'Protected focus block. Reschedule meetings elsewhere this week.',
      calendar: 'primary',
    },
    status: 'pending' as const,
    priority: 'normal' as const,
    createdAt: ago(60),
  },
  {
    id: 'q-004',
    type: 'kb_update' as const,
    summary: 'Update KB — Tom Nguyen promoted to VP Engineering',
    detail: 'Detected from email thread. Tom\'s new title is relevant to how you engage with him.',
    agentRole: 'inbox-triage',
    tool: 'kb_write',
    payload: {
      input: {
        person: {
          name: 'Tom Nguyen',
          email: 'tom@client.com',
          relationship: 'client',
          notes: 'VP Engineering',
        },
      },
    },
    status: 'pending' as const,
    priority: 'low' as const,
    createdAt: ago(90),
  },
  {
    id: 'q-005',
    type: 'reminder' as const,
    summary: 'Send proposal to Meridian Health by Friday',
    detail: 'Commitment extracted from your email to Lisa Park: "I\'ll get the proposal over by end of week." Nothing sent yet — 2 days remaining.',
    agentRole: 'inbox-triage',
    tool: 'queue_action',
    payload: {
      commitment: 'Send proposal to Meridian Health',
      dueDate: TODAY,
      source: 'email',
      contact: 'Lisa Park <lisa.park@meridian.health>',
    },
    status: 'pending' as const,
    priority: 'high' as const,
    createdAt: ago(180),
  },
  {
    id: 'q-006',
    type: 'email_reply' as const,
    summary: 'Follow-up with Dan after last week\'s catch-up',
    detail: 'You hadn\'t spoken in 8 weeks before the call. Good momentum — agent drafted a short follow-up to keep it going.',
    agentRole: 'relationship-monitor',
    tool: 'gmail_draft',
    payload: {
      to: 'dan.fowler@email.com',
      subject: 'Great catching up',
      body: `Dan,\n\nReally good to reconnect last week — always useful getting your perspective on things.\n\nWill look into the Notion setup you mentioned and let you know how I get on.\n\nCatch up again in a month?\n\nBest`,
      threadId: null,
    },
    status: 'pending' as const,
    priority: 'low' as const,
    createdAt: ago(240),
  },
] as const;

// ─── Sample entity state (last daily run) ─────────────────────────────────

const SAMPLE_ENTITY_STATE = {
  entityId: 'daily-run-sample',
  entityType: 'daily' as const,
  entityName: 'Daily OS',
  status: 'complete' as const,
  data: {
    inbox_triage: {
      summary: '14 emails processed. 3 require action, 7 filed, 4 newsletters archived.',
      urgentCount: 3,
      threads: [
        { subject: 'Q3 budget proposal', from: 'sarah.chen@acmecorp.com', urgency: 'high', action: 'reply_drafted' },
        { subject: 'Intro request: James ↔ Maya', from: 'james.okafor@ventures.io', urgency: 'normal', action: 'reply_drafted' },
        { subject: 'Meridian Health proposal — quick chase', from: 'lisa.park@meridian.health', urgency: 'high', action: 'commitment_logged' },
        { subject: 'Team offsite feedback', from: 'hr@acmecorp.com', urgency: 'low', action: 'filed' },
        { subject: 'Your invoice #2047', from: 'billing@saas.com', urgency: 'normal', action: 'filed' },
      ],
    },
    calendar_brief: {
      summary: 'Busy day: 4 meetings, 0 focus blocks. Week has 18 meetings — consider blocking Thursday AM.',
      events: [
        { title: 'Weekly team standup', time: '09:30', duration: 30, attendees: ['team@acmecorp.com'] },
        { title: 'Sarah Chen — budget review', time: '11:00', duration: 60, attendees: ['sarah.chen@acmecorp.com'] },
        { title: 'Lunch with investor (Dan Park)', time: '13:00', duration: 90, attendees: ['dan.park@bluevc.com'] },
        { title: 'Product roadmap planning', time: '15:30', duration: 60, attendees: ['team@acmecorp.com', 'product@acmecorp.com'] },
      ],
      focusBlockCount: 0,
      weekMeetingCount: 18,
    },
    health_brief: {
      summary: 'Pull day. Hit your protein target yesterday. Sleep was solid at 7h 40m.',
      workout: { type: 'Pull', exercises: ['Pull-ups 4×8', 'Barbell rows 4×10', 'Face pulls 3×15', 'Hammer curls 3×12'] },
      nutrition: { targetCalories: 2200, reminder: 'Pre-log lunch now to stay on track' },
      hydration: '2.5L target — 0.5L done so far',
    },
    news_brief: {
      summary: '5 stories worth your attention across AI, fintech, and your market.',
      headlines: [
        { topic: 'AI', title: 'Anthropic releases new reasoning model with 2× benchmark improvement', whyRelevant: 'Directly relevant to your AI integrations roadmap' },
        { topic: 'Fintech', title: 'Open Banking adoption hits 60% among UK SMEs', whyRelevant: 'Your Meridian Health client mentioned this in last week\'s call' },
        { topic: 'Competitors', title: 'Notion AI launches meeting summary feature in beta', whyRelevant: 'Overlaps with your async meeting digest feature' },
        { topic: 'Regulation', title: 'ICO publishes draft guidance on AI decision-making in HR', whyRelevant: 'You use AI for candidate screening — worth flagging to legal' },
        { topic: 'Market', title: 'B2B SaaS multiples recover to 6× ARR in mid-market', whyRelevant: 'Relevant context for your investor lunch today' },
      ],
    },
    work_prep: {
      summary: 'Prepped for 4 meetings. Investor lunch is highest-stakes — brief included.',
      firstMeeting: {
        title: 'Weekly team standup',
        time: '09:30',
        prep: 'No specific prep needed — standard cadence. Check project status board beforehand.',
      },
      meetingPreps: [
        {
          title: 'Lunch with investor (Dan Park)',
          context: 'Dan Park is a Partner at Blue Ventures. Last contact was 6 months ago at SaaS Europe. He backed your competitor Loopline in 2023 but has since written about B2B AI tools positively.',
          talkingPoints: [
            'Q3 ARR growth: 34% QoQ — lead with this',
            'Meridian Health as anchor enterprise customer',
            'Team: recent VP Eng hire (Tom Nguyen) credentialises the technical story',
            'Ask about Blue Ventures\' thesis on AI-native tools vs AI-enhanced',
          ],
          recentNews: 'Blue Ventures closed a £120M fund last month — may be actively looking to deploy',
        },
      ],
    },
    relationship_monitor: {
      summary: '2 cooling relationships surfaced. 1 follow-up drafted.',
      cooling: [
        { name: 'Dan Fowler', type: 'mentor', weeksSince: 8, threshold: 6, draftQueued: true },
        { name: 'Priya Mehta', type: 'collaborator', weeksSince: 4, threshold: 3, draftQueued: false },
      ],
    },
  },
  decisions: [],
  createdAt: ago(120),
  updatedAt: ago(90),
};

// ─── Sample morning brief ─────────────────────────────────────────────────

const SAMPLE_BRIEF = {
  date: TODAY,
  generatedAt: ago(120),
  mustDo: [
    { task: 'Approve reply to Sarah re: Q3 budget — she needs sign-off by EOD', priority: 'high', source: 'inbox' },
    { task: 'Send Meridian Health proposal — committed to Lisa by Friday', priority: 'high', source: 'commitment' },
    { task: 'Review and approve investor lunch talking points before 1pm', priority: 'high', source: 'calendar' },
  ],
  logistics: [
    'Standup at 09:30 — no prep needed',
    'Budget review with Sarah at 11:00 — draft reply queued for your approval',
    'Investor lunch at 13:00 (Dan Park, Blue Ventures) — brief in Work Prep',
    'Product roadmap at 15:30 — check Linear board beforehand',
  ],
  health: {
    workout: 'Pull day: pull-ups, rows, face pulls, hammer curls',
    meals: 'Target 2,200 kcal — pre-log lunch to stay on track',
    hydration: '2.5L target',
    sleep: '7h 40m ✓',
  },
  topNews: [
    { headline: 'Anthropic releases new reasoning model — 2× benchmark jump', relevance: 'AI roadmap' },
    { headline: 'Open Banking adoption at 60% among UK SMEs', relevance: 'Meridian context' },
    { headline: 'Notion AI launches meeting summaries in beta', relevance: 'Competitive overlap' },
  ],
  sentiment: 'Productive day ahead. High-stakes investor lunch — be sharp. Clear your inbox approvals this morning.',
};

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Clearing activity history…');
  await clearActivityHistory();

  console.log('Seeding action queue…');
  for (const action of SAMPLE_QUEUE) {
    await saveQueuedAction({ ...action });
  }
  console.log(`  → ${SAMPLE_QUEUE.length} queued actions`);

  console.log('Seeding entity state…');
  await saveEntityState(SAMPLE_ENTITY_STATE);
  console.log('  → 1 completed Daily OS run');

  console.log('Seeding morning brief…');
  await writeLatestBrief(SAMPLE_BRIEF);
  console.log('  → morning brief written');

  console.log('\nDone. Reload the app to see sample data.');
  console.log('Also clear browser localStorage keys aidea-chat-v1 and aidea-onboarding-complete if the UI looks stale.');
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
