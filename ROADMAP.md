# aidea roadmap

One item per agent loop iteration unless the loop prompt says to continue through all unchecked items. Mark `[x]` only when `npm run typecheck`, `npm test`, `npm run test:contract`, and `npm run build` all pass (or note if blocked on external deps).

**Guides:** [AGENTS.md](./AGENTS.md) · `.cursor/rules/`

---

## Current status

<!-- Agent: overwrite this block each loop iteration — user reads this for live progress -->
**Last updated:** 2026-06-20  
**Phase:** P3 — Entity modes  
**Next up:** Learning OS agents  
**Session:** P2 complete (3/3). P0–P2 all local, uncommitted. Loop unreliable — work continues in chat.

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

- [ ] **Learning OS agents** — Dedicated library + entity config (replace `life-ceo` stub in `lib/entities/learning.ts`)
- [ ] **Creator Studio agents** — Content/Production/Distribution agents (replace `ceo` stub in `lib/entities/creator.ts`)
- [ ] **Invoke modes from Home** — Chat or command palette can start company/learning/creator runs without opening Studio

---

## P4 — Workforce depth

- [ ] **Proactive Work items** — Agent-initiated nudges (relationships, stale projects) appear in Work feed
- [ ] **Autonomy reflected in UI** — supervised / semi-autonomous / autonomous affects what auto-runs vs queues
- [ ] **Work filter: Running** — Dedicated filter/tab for in-flight agent sessions

---

## P5 — Brand & scale

- [ ] **Visual system pass** — Typography, icons (replace emoji entity chips in Studio), output-first templates
- [ ] **Onboarding quick start** — 3-step path; defer full 18-step wizard to Context
- [ ] **Action audit trail** — Log approved/rejected queue items with timestamp
- [ ] **Multi-user / Postgres production path** — Document and verify Vercel + Postgres deploy

---

## Done

- [x] Home: chat left + Work feed right
- [x] Agent Library (view, customize, runtime overrides)
- [x] Legacy stack removed; shared helpers (SSE, queue, polling, save feedback)
- [x] AGENTS.md + Cursor rules for helpers

---

## Loop log

<!-- Agent: append one line per completed iteration -->
- 2026-06-20 — P0 unified task feed API — `lib/harness/tasks.ts`, `app/api/tasks/route.ts`, `TaskFeed.tsx`, tests
- 2026-06-20 — P0 batch (chat context, instant refresh, nav badge, mobile stack) — `HomeScreen`, `ChatInterface`, `TaskFeed`, `AppSidebar`, `MobileBottomNav`, `HarnessDashboard`
- 2026-06-20 — P1 batch (integration bar, chat restore UX, Work previews, approve feedback) — `lib/integrations.ts`, `IntegrationStatusBar`, `TaskFeed`, `ChatInterface`
- 2026-06-20 — P2 batch (ProfileSections, artifact labels, agent groups) — `profile/ProfileSections.tsx`, `lib/agents/artifact-labels.ts`, `lib/agents/groups.ts`
