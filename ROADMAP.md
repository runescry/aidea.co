# aidea roadmap

One item per agent loop iteration unless the loop prompt says to continue through all unchecked items. Mark `[x]` only when `npm run typecheck`, `npm test`, `npm run test:contract`, and `npm run build` all pass (or note if blocked on external deps).

**Guides:** [AGENTS.md](./AGENTS.md) · [docs/VISION.md](./docs/VISION.md) · [docs/PLAN.md](./docs/PLAN.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [Interactive docs](/docs/vision) · [/docs/plan](/docs/plan) · `.cursor/rules/`

---

## Current status

<!-- Agent: overwrite this block each loop iteration — user reads this for live progress -->
**Last updated:** 2026-07-19
**Phase:** P8.4 and P9 core complete
**Next up:** Run the production tenant report and make the explicit legacy `default`-tenant copy decision in [the smoke checklist](./docs/PROD_SMOKE.md)
**Recent:** person-sheet interaction history; legacy key-contact deprecation; signed multi-user sessions; mobile surface completion
**Git:** `main` synchronized with `origin/main`

**Vision & domain scores:** [docs/VISION.md](./docs/VISION.md) · [Interactive reader](/docs/vision)  
**Gap closure plan:** [docs/PLAN.md](./docs/PLAN.md) · [Interactive reader](/docs/plan)  
**Post-gap work:** [PLAN P8](./docs/PLAN.md#p8--harden--extend)

---

## P0 — Product core (Home is the product)

- [x] **Unified task feed API** — Extend `/api/tasks` (or new module) so Work shows queue + active sessions + recent completed artifacts in one sorted feed
- [x] **Work row detail → chat context** — Selecting a task can pre-fill or attach context in chat (“Why did you draft this?”)
- [x] **Instant Work refresh after chat** — Ensure chat completion triggers TaskFeed refresh without waiting for poll interval
- [x] **Nav badge: pending Work count** — Show count on Home when items need approval
- [x] **Home mobile layout** — Stack chat / Work vertically under breakpoint; usable composer on small screens

---

## P1 — Daily use reliability

- [x] **Integration status on Home** — Surface configured/missing keys (Anthropic, Google, Brave) with link to Settings
- [x] **Chat persistence** — Persist messages server-side; restore thread on load
- [x] **Rich output in Work** — After runs, surface deliverables (briefs, drafts) as Work rows with rich preview, not only Studio → Artifacts
- [x] **Approve flow feedback** — Toast or inline state when queue PATCH succeeds/fails

---

## P2 — Code health (audit leftovers)

- [x] **ProfileSections component** — Shared form sections for OnboardingWizard + KnowledgeBaseEditor
- [x] **Artifact labels from library** — Derive ArtifactBrowser labels from `AGENT_LIBRARY` / `stateWriteKey`; remove duplicate maps
- [x] **Agent groups metadata** — Single source for API `GROUPS` (e.g. `groupId` on defs or entity config)

---

## P3 — Entity modes (stubs)

- [x] **Learning OS agents** — Dedicated library + entity config (replace `life-ceo` stub in `lib/entities/learning.ts`)
- [x] **Creator Studio agents** — Content/Production/Distribution agents (replace `ceo` stub in `lib/entities/creator.ts`)
- [x] **Invoke modes from Home** — Chat or command palette can start company/learning/creator runs without opening Studio

---

## P4 — Workforce depth

- [x] **Proactive Work items** — Agent-initiated nudges (relationships, stale projects) appear in Work feed
- [x] **Autonomy reflected in UI** — supervised / semi-autonomous / autonomous affects what auto-runs vs queues
- [x] **Work filter: Running** — Dedicated filter/tab for in-flight agent sessions

---

## P5 — Brand & scale

- [x] **Visual system pass** — Typography, icons (replace emoji entity chips in Studio), output-first templates
- [x] **Onboarding quick start** — 3-step path; defer full 18-step wizard to Context
- [x] **Action audit trail** — Log approved/rejected queue items with timestamp
- [x] **Multi-user / Postgres production path** — Document and verify Vercel + Postgres deploy

---

## P6 — Performance

- [x] **Shared Work feed** — `WorkFeedProvider` dedupes polling; adaptive intervals; pauses when tab hidden
- [x] **Tasks summary API** — `GET /api/tasks?summary=1` returns `{ needsYou }` for nav badge off Home
- [x] **Fast-path chat** — Simple Home messages use Haiku via `lib/harness/fast-chat.ts` (no full bootstrap)
- [x] **Home chat progress** — Step indicators + tool status while dispatcher runs
- [x] **Server caches** — Profile read cache (15s); Nango connection check cache (60s)
- [x] **Studio CEO tier** — Company/Learning/Creator CEOs use Sonnet (not Opus + thinking)

### P6 backlog (not started)

- [x] **Daily lite brief** — Single-agent morning brief mode (skip 5 parallel sub-agents)

---

## Post-P6 polish (working tree — verify before marking done)

- [x] **Inbox UX** — Panel renamed; tabs: All / Awaiting approval / Suggestions / Running / Done; badge = approvals only
- [x] **Live email edit** — Edit To, Cc, subject, body on approval cards before Approve & send or Save to drafts
- [x] **Gmail drafts** — Nango OAuth; queue `intent: save` creates Gmail draft; job-ad vs application classification in dispatcher
- [x] **Chat persistence** — Server-side conversations (`/api/chat`); hard delete; conversation history in dispatcher
- [x] **Streaming chat** — `agent_text_delta` SSE; markdown + inbox summary cards on Home
- [x] **Mobile Home** — Bottom nav; full-height chat; Inbox full-screen overlay (not split viewport)
- [x] **Activity reset** — `POST /api/reset`, `npm run reset:activity`, Settings → Danger zone button
- [x] **Client import boundary** — `lib/harness/queue-types.ts`; no `@/lib/harness/queue` or `@/lib/storage` in `'use client'` files

---

## P7 — Gap closure (see [docs/PLAN.md](./docs/PLAN.md))

Build / test / deploy: [PLAN.md § Build workflow](./docs/PLAN.md#build-workflow) · [Test strategy](./docs/PLAN.md#test-strategy) · [Deployment workflow](./docs/PLAN.md#deployment-workflow)

Full backlog by layer (data, workforce, UX) and P7.0–P7.4 phasing lives in [docs/PLAN.md](./docs/PLAN.md). Summary checkboxes:

- [x] **P7.0 Ship post-P6** — Deployed polish to production (`e9b6d55`)
- [x] **Daily lite brief on Home** — Single-agent morning mode ([P6 backlog](#p6-backlog-not-started))
- [x] **Morning brief surfacing** — Brief → Inbox row or chat card, not Studio-only
- [x] **Suggestion dismiss / snooze** — Hygiene for proactive Inbox items
- [x] **Audit trail viewer** — Browse queue approve/reject/save history in UI
- [x] **Non-email Inbox cards** — Calendar and KB queue items with polished approval UX
- [x] **Cron outcomes → Inbox** — Health-briefer and relationship-monitor surface like inbox-triage
- [x] **request_human_input on Home** — Human-in-the-loop outside Studio
- [x] **P7.3 contact graph + health sync spikes** — KB merge modules + agent read tools
- [x] **P7.4 timeline + governance** — Yesterday tab, schedule conflicts, per-domain autonomy

---

## P8 — Harden & extend (see [docs/PLAN.md](./docs/PLAN.md#p8--harden--extend))

Build / test / deploy: reuse [PLAN.md § Build workflow](./docs/PLAN.md#build-workflow) · [Test strategy](./docs/PLAN.md#test-strategy) · [Deployment workflow](./docs/PLAN.md#deployment-workflow)

Full P8.0–P8.4 backlog lives in [docs/PLAN.md § P8](./docs/PLAN.md#p8--checkbox-backlog). Summary checkboxes:

- [x] **P8.0 P7 partials** — Wire contact graph persist; per-domain autonomy on queue; prod smoke doc
- [x] **Live health connector** — One wearable OAuth + sync (Strava, Apple Health, or Whoop)
- [x] **Rich contact graph** — Last touch from Gmail/Calendar; relationship-monitor writes graph
- [x] **Finance spike** — Plaid read-only or minimal subscription alerts
- [x] **Finance → Inbox** — Actionable finance nudges as approval/suggestion cards
- [x] **Auth / multi-user** — Signed session middleware; stable Nango-verified Google tenants; per-user profile/KB and safe tenant claiming (no Clerk dependency)
- [x] **Mobile secondary surfaces** — Agents, Profile/Context, and Settings polished and smoke-tested on small screens

---

## P9 — Profile memory & people graph (see [docs/PLAN.md](./docs/PLAN.md#p9--profile-memory--people-graph))

Profile as the living control plane: canonical `relationships.people[]`, tombstones + sync blocklist, unified People UI, agent write path, memory hygiene.

- [x] **P9.1 Data model + graph** — `ProfilePerson`, `removedKeys`, `lib/profile/people.ts`, migration, graph/sync blocklist
- [x] **P9.2 People UI** — Unified list + person sheet on Profile; archive/remove/restore; legacy editor collapsed
- [x] **P9.3 Agent KB writes** — `person` patch in `kb-updates`; dispatcher/inbox-triage remove instructions
- [x] **P9.4 Memory hygiene** — Pulse dismiss; job remove row; kb_update reject → `rejectedKbPatches`
- [x] **P9.5 Docs** — PLAN, ROADMAP, VISION D5, ARCHITECTURE profile section
- [x] **P9 follow-up** — Agent `person` queue payload; onboarding → `people[]`; archived restore UI; profile E2E + `/api/kb` contract

---

## Done

- [x] Home: chat left + Work feed right
- [x] Agent Library (view, customize, runtime overrides)
- [x] Legacy stack removed; shared helpers (SSE, queue, polling, save feedback)
- [x] AGENTS.md + Cursor rules for helpers
- [x] Home performance pass (Work feed provider, fast chat, caches)

---

## Loop log

<!-- Agent: append one line per completed iteration -->
- 2026-06-20 — P0 unified task feed API — `lib/harness/tasks.ts`, `app/api/tasks/route.ts`, `TaskFeed.tsx`, tests
- 2026-06-20 — P0 batch (chat context, instant refresh, nav badge, mobile stack) — `HomeScreen`, `ChatInterface`, `TaskFeed`, `AppSidebar`, `MobileBottomNav`, `HarnessDashboard`
- 2026-06-20 — P1 batch (integration bar, chat restore UX, Work previews, approve feedback) — `lib/integrations.ts`, `IntegrationStatusBar`, `TaskFeed`, `ChatInterface`
- 2026-06-20 — P2 batch (ProfileSections, artifact labels, agent groups) — `profile/ProfileSections.tsx`, `lib/agents/artifact-labels.ts`, `lib/agents/groups.ts`
- 2026-06-20 — P3 batch (learning/creator agents, Home run launcher) — `lib/agents/library/learning`, `lib/agents/library/creator`, `EntityRunLauncher.tsx`
- 2026-06-20 — P4 batch (proactive Work, autonomy UI, running filter) — `lib/harness/proactive-tasks.ts`, `TaskFeed.tsx`, `/api/tasks`
- 2026-06-20 — P5 batch (visual system, quick onboarding, audit trail, deploy docs) — `EntityTypeIcon`, `QuickStartOnboarding`, `queue-audit`, `docs/DEPLOYMENT.md`
- 2026-06-20 — P6 performance (Work feed, fast chat, caches, CEO tier) — `useWorkFeed`, `fast-chat`, `4348afb`
- 2026-06-21 — P7.0 deploy — pushed `e9b6d55` to main; prod smoke pass (Home, Inbox API, /docs/plan)
- 2026-06-21 — P7.1 audit trail viewer — Settings queue activity panel; `AuditTrailPanel`
- 2026-06-21 — P7.1 suggestion dismiss/snooze — profile persistence; TaskFeed buttons; `/api/tasks/suggestions`
- 2026-06-21 — P7.1 morning brief on Home — Inbox row + chat card; `latestBriefToTask`, `/api/tasks`
- 2026-06-21 — P7.2 calendar approval cards — Inbox edit + approve for `calendar_event`; `calendar-display`, queue PATCH contract
- 2026-06-21 — P7.2 KB update approval cards — structured preview + reason; `buildKbUpdatePreview`
- 2026-06-21 — P7.2 health-briefer → Inbox — `latestHealthBriefToTask`, `HealthBriefRenderer`
- 2026-06-21 — P7.2 relationship-monitor cards — structured cooling-contact suggestions in TaskFeed
- 2026-06-21 — P7.2 request_human_input on Home — `lib/client/human-input`, chat SSE overlay wiring
- 2026-06-21 — P7.3 contact graph + health sync spikes — `lib/contacts/interaction-graph`, `lib/health/sync`, harness read tools
- 2026-06-21 — P7.4 timeline + governance — `timeline`, `conflicts`, domain autonomy, Context/Settings lenses
- 2026-06-21 — P7 complete — prod daily loop shipped; docs synced for P8 (PLAN, ROADMAP, VISION, AGENTS)
- 2026-06-21 — P8.0 P7 partials — contact interaction recording, per-domain queue autonomy, prod smoke doc
- 2026-06-21 — P8.1 Strava health connector — OAuth, sync job, Settings connect/disconnect
- 2026-06-21 — P8.2 rich contact graph — mail/calendar signal sync, relationship-monitor persist
- 2026-06-21 — P8.3 finance spike — KB subscription nudges in Inbox, Plaid env stub, finance_read tool
- 2026-07-19 — P8.4 platform complete — signed Nango-backed auth, tenant isolation, and mobile Settings/Profile/Agents
- 2026-06-21 — P9 profile memory — canonical people store, tombstones, People UI, pulse dismiss, kb reject feedback
- 2026-06-21 — P9 follow-up — profile E2E suite, kb contract, onboarding→people[], agent person queue round-trip
