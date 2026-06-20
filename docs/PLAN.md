# aidea — P7 gap closure plan

Structured backlog to close the gap between **vision** ([VISION.md](./VISION.md)) and **what ships today**. Read after [ROADMAP.md](../ROADMAP.md) **Current status**; pick **one slice** per loop iteration; mark checkboxes in this file and the matching [ROADMAP P7](../ROADMAP.md#p7--gap-closure-see-docsplanmd) item when gates pass.

**Related:** [Roadmap](/docs/roadmap) · [Vision](/docs/vision) · [Agent instructions](/docs/agents) · [Deployment](/docs/deployment)

> **Interactive reader:** [/docs/plan](/docs/plan)

---

## Purpose & how to use

1. Check [ROADMAP.md](../ROADMAP.md) **Current status** for phase and prod/local delta.
2. Work **P7.0** first if post-P6 polish is not on production.
3. Pick the highest-priority unchecked item in the phase table below (or ROADMAP P7 summary).
4. One logical slice per iteration — minimal diff, shared helpers in [AGENTS.md](../AGENTS.md).
5. When a slice ships: mark `[x]` here, matching ROADMAP P7 item, and append **Loop log**; update VISION domain score if material.

```mermaid
flowchart TB
  subgraph docs [Agent doc stack]
    AGENTS[AGENTS.md]
    ROADMAP[ROADMAP.md]
    PLAN[docs/PLAN.md]
    VISION[docs/VISION.md]
  end
  AGENTS --> ROADMAP
  ROADMAP --> PLAN
  PLAN --> VISION
```

---

## Build workflow

How to implement each P7 slice. Feature backlog stays in [Checkbox backlog](#checkbox-backlog) below.

### Per-slice loop

1. Read [ROADMAP.md](../ROADMAP.md) **Current status** and pick the highest-priority unchecked PLAN item.
2. Start a **single** dev server: `npm run dev` → `http://localhost:3000`
3. Implement a minimal diff — shared helpers in [AGENTS.md](../AGENTS.md) (SSE, queue, Work feed, save UX).
4. Run the [four test gates](#mandatory-gates-every-slice) before marking `[x]`.
5. Do **not** start P7.1+ until [P7.0](#p70--ship--stabilize) prod parity is done.

```mermaid
flowchart LR
  subgraph buildLoop [Build]
    PickSlice[Pick PLAN checkbox]
    Dev[npm run dev]
    Implement[Minimal slice]
  end
  subgraph verify [Verify]
    Gates[4 local gates]
  end
  PickSlice --> Dev --> Implement --> Gates
```

### Environment defaults

| Mode | `DATABASE_URL` | Storage | When |
|------|----------------|---------|------|
| **Fast iteration** | unset | `data/*.json` | Default daily dev |
| **Postgres parity** | set in `.env.local` | Postgres via [`lib/storage`](../lib/storage/index.ts) | Before prod deploy or DB-touching slices |

Copy keys from [`.env.local.example`](../.env.local.example). Full reference: [DEPLOYMENT.md](./DEPLOYMENT.md).

| Variable | Needed for |
|----------|------------|
| `AI_GATEWAY_API_KEY` or `ANTHROPIC_API_KEY` | Chat, agents, crons |
| `NANGO_SECRET_KEY` | Gmail & Calendar (paste manually — `vercel env pull` may return empty) |
| `BRAVE_SEARCH_API_KEY` | Web search tool |

### Dev hygiene

- Run **one** `next dev` process at a time.
- Do **not** run `npm run build` while dev is running — corrupts `.next` (500 / ENOENT manifest errors).
- Client code: import `@/lib/harness/queue-types`, not `@/lib/harness/queue` or `@/lib/storage`.

**Fix corrupted dev cache:**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 1; rm -rf .next && npm run dev
```

### Slice → primary files

| Phase / area | Primary touchpoints |
|--------------|---------------------|
| P7.0 ship | git commit; Vercel redeploy — no new feature code |
| P7.1 morning ritual | `lib/harness/daily-kickstart.ts`, `lib/entities/daily.ts`, `HomeScreen.tsx`, `MorningBriefRenderer.tsx` |
| P7.1 Inbox hygiene | `lib/harness/proactive-tasks.ts`, `TaskFeed.tsx`, `/api/tasks`, profile or storage for dismiss/snooze |
| P7.1 audit viewer | `lib/harness/queue-audit.ts`, Settings or Inbox panel |
| P7.2 workforce → Inbox | `TaskFeed.tsx`, `queue-types.ts`, `execute-queued-action.ts`, cron monitor outputs |
| P7.2 human input | `lib/harness/tools.ts` (`request_human_input`), Home/Inbox UI |
| P7.3 connectors | New integration module + KB section + agent tool — one connector per slice |
| P7.4 timeline / autonomy | `HomeScreen.tsx`, `SettingsPanel.tsx`, `proactive-tasks.ts` |

---

## Test strategy

### Mandatory gates (every slice)

Mark a PLAN checkbox `[x]` only when all pass:

```bash
npm run typecheck
npm test                    # lib/**/*.test.ts
npm run test:contract       # app/api/**/*.contract.test.ts
npm run build
```

GitHub Actions runs the same sequence on push/PR to `main` ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

### When to add or update tests

| Change touches | Action |
|----------------|--------|
| Pure logic in `lib/` | Add/update `lib/**/*.test.ts` |
| API route shape or status | Add/update `app/api/**/*.contract.test.ts` |
| UI-only (no testable logic) | Manual smoke on Home, Inbox, `/docs/plan` |
| Queue / tasks / feed behavior | Extend `lib/harness/tasks.test.ts` or `app/api/tasks/tasks.contract.test.ts` |

**Existing contract coverage:** `tasks`, `agents`, `integrations`, `reset` — extend when adding routes (e.g. dismiss/snooze API, audit viewer).

### Optional gates (not CI)

| Command | When | Requires |
|---------|------|----------|
| `npm run test:integration` | Pre-P7.0 deploy; after queue/chat changes | LLM key in `.env.local` |
| `npm run test:inbox-triage` | After inbox-triage / Gmail changes | LLM key |
| `INTEGRATION_GMAIL=1 npm run test:inbox-triage:live` | Before trusting prod Gmail | Nango + Gmail connected |
| `npm run build && npm start` | Prod-like UI speed check | Stop dev first |

### Phase-specific test focus

| Phase | Beyond four gates |
|-------|------------------|
| **P7.0** | Optional integration smoke; manual Home / Inbox / mobile / `/docs/plan` |
| **P7.1** | Unit tests for dismiss, snooze, audit logic; contract for new APIs |
| **P7.2** | Contract for non-email queue PATCH; manual calendar/KB approval cards |
| **P7.3** | Connector spike tests isolated; no live external API in unit/contract CI |
| **P7.4** | Autonomy and timeline logic unit tests |

---

## Deployment workflow

### Policy

- **Default: local only** — no push or Vercel deploy unless explicitly requested in session.
- Never push with failing local gates or red CI.
- One logical commit per slice; message explains **why**.

See [AGENTS.md](../AGENTS.md) and [DEPLOYMENT.md](./DEPLOYMENT.md) for env vars and Postgres setup.

### P7.0 — Ship post-P6 (first deploy milestone)

**Pre-deploy checklist:**

1. All [four gates](#mandatory-gates-every-slice) pass locally.
2. Working tree committed (user request).
3. Vercel env verified for **aidea-co**:
   - `DATABASE_URL` (Postgres)
   - `AI_GATEWAY_API_KEY` (team key `aidea-co-prod`)
   - `NANGO_SECRET_KEY`
   - `CRON_SECRET` (crons in [`vercel.json`](../vercel.json))
4. Optional: `npm run test:integration` with valid LLM key.

**Deploy steps:**

1. Push to `main` (explicit user request).
2. Confirm GitHub Actions + Vercel build green.
3. Redeploy if env vars changed (env does not apply until redeployed).

**Post-deploy smoke** ([aidea-co.vercel.app](https://aidea-co.vercel.app)):

| Surface | Check |
|---------|-------|
| Home | Chat streams; fast path responds |
| Inbox | Tabs; email edit; approve / save / reject |
| Mobile | Inbox overlay; bottom nav |
| Settings | Integration status; activity reset |
| Docs | `/docs/plan` renders without console errors |
| Crons | `/api/monitor` reachable with `CRON_SECRET` |

Mark [P7.0](#p70--ship--stabilize) here and **P7.0 Ship post-P6** in [ROADMAP P7](../ROADMAP.md#p7--gap-closure-see-docsplanmd) when smoke passes.

### P7.1–P7.4 deploy cadence

- Not every checkbox needs a prod deploy.
- Recommended: deploy after each **phase** completes (or weekly if iterating locally).
- Before deploy: four gates + [phase-specific tests](#phase-specific-test-focus).
- Update [VISION.md](./VISION.md) deploy status and domain scores when prod catches up.

### Rollback and ops

- **Activity reset:** `POST /api/reset`, Settings → Danger zone, or `npm run reset:activity` — see [DEPLOYMENT.md § Activity reset](./DEPLOYMENT.md#activity-reset).
- **Corrupted local dev:** [Dev hygiene](#dev-hygiene) restart command above.

---

## Prerequisite: ship post-P6 (P7.0)

**Blocked by:** local working tree not committed/deployed to [aidea-co.vercel.app](https://aidea-co.vercel.app).

Post-P6 polish (Inbox edit, Gmail drafts, streaming chat, chat persistence, activity reset, mobile Inbox overlay, `queue-types` client boundary) must reach production before P7.1 UX work is meaningful on the daily product surface.

---

## Layer 1 — Data: unified picture of you

Semantic hub + connectors that agents read before acting.

### Exists today

| Area | How | Key files |
|------|-----|-----------|
| **Knowledge base** | Context editor, onboarding, `kb_read` / `update_kb` | `lib/harness/knowledge-base.ts`, Context UI |
| **Mail** | Nango Gmail — triage, drafts, send | `lib/nango/gmail.ts`, inbox-triage cron |
| **Calendar** | Nango Google Calendar — schedule, logistics | `lib/harness/tools.ts` (`calendar_*`) |
| **Web / news** | Brave search, news curator in Daily OS | `lib/harness/tools.ts`, daily agents |

### Missing or thin

| Gap | Today | Target |
|-----|-------|--------|
| **Live health sync** | Static KB `health` + agent inference | Apple Health, Strava, Whoop, etc. → KB or live read |
| **Rich contact graph** | KB `relationships` + `contacts_read` (Google People) + weekly relationship-monitor cron | Interaction history, last touch, channels per person |
| **Finance** | Phase 3 env placeholders only | Plaid, budgets, subscription alerts |
| **Async messaging** | Not started | Slack, WhatsApp, iMessage |
| **Docs / notes** | Not started | Notion, Drive |
| **Unified timeline** | No cross-domain “yesterday” view | Single chronological feed across mail, cal, health, projects |
| **Conflict resolution** | Calendar vs health KB can disagree silently | Explicit merge UX when sources conflict |

---

## Layer 2 — Agent workforce: background specialists that run

Dispatcher, crons, queue, and Studio harness.

### Exists today

| Area | How | Key files |
|------|-----|-----------|
| **Agent library** | Company, personal, daily, learning, creator, dispatch | `lib/agents/library/` |
| **Inbox triage** | Cron every 15m → queue dominates Home/Inbox | `lib/agents/library/daily/inbox-triage.ts` |
| **Daily OS** | 6-agent orchestrator + specialists | `lib/harness/daily-kickstart.ts`, `lib/entities/daily.ts` |
| **Crons** | Daily 6:30, inbox, relationships Mon 8am | `vercel.json` → `/api/monitor` |
| **Studio harness** | Spawn, wait, consensus, artifacts | `lib/harness/bootstrap.ts`, Studio UI |

### Missing or thin

| Gap | Today | Target | Key files |
|-----|-------|--------|-----------|
| **Daily lite brief on Home** | Full 6-agent run too heavy for daily ritual | Single-agent morning brief (ROADMAP P6 backlog) | `daily-kickstart.ts`, `lib/entities/daily.ts` |
| **Non-email cron outcomes** | health-briefer, relationship-monitor → entity state / Studio | Same prominence as inbox-triage in Inbox | `proactive-tasks.ts`, monitor crons |
| **True proactive outreach** | KB heuristics (stale job app, cooling contact) | Agent noticed X → queued action | `lib/harness/proactive-tasks.ts` |
| **Cross-domain orchestration** | Personal OS / Life CEO in Studio only | Feeds daily Home loop | `lib/entities/personal.ts`, Home launcher |
| **Action types beyond email** | `calendar_event`, `kb_update` in queue types; email-polished Inbox UX | Calendar holds, KB updates as first-class approval cards | `queue-types.ts`, `TaskFeed.tsx` |
| **Human-in-the-loop on Home** | `request_human_input` in harness | Productized on Home, not Studio-only | `lib/harness/tools.ts` |
| **Agent memory of outcomes** | Rejections not systematically fed back | “You rejected this draft style” → profile or override | `queue-audit.ts`, agent overrides |

---

## Layer 3 — Product UX: one surface for your day

Home chat + Inbox as the daily product.

### Exists today

| Area | How | Key files |
|------|-----|-----------|
| **Home chat** | Fast path + full dispatcher, streaming, persistence | `ChatInterface`, `fast-chat.ts`, `/api/message` |
| **Inbox** | Approvals vs suggestions tabs, live email edit, drafts | `TaskFeed.tsx`, `patchQueueAction` |
| **Mobile** | Bottom nav, full-height chat, Inbox overlay | `HomeScreen.tsx`, `MobileBottomNav` |
| **Work feed** | Shared poll, adaptive intervals | `useWorkFeed`, `/api/tasks` |
| **Reset** | Clear queue, chat, runs, brief | `POST /api/reset`, Settings |

### Missing or thin

| Gap | Today | Target | Key files |
|-----|-------|--------|-----------|
| **Morning ritual** | Chat-first; brief elsewhere | Open app → brief + top 3 approvals | `HomeScreen.tsx`, `MorningBriefRenderer.tsx` |
| **Inbox for non-email** | Email cards polished; other types generic | Calendar, KB, future finance as approval cards | `TaskFeed.tsx`, `action-labels.ts` |
| **Suggestion hygiene** | Discuss in chat only | Dismiss, snooze, “not relevant” | `proactive-tasks.ts`, `/api/tasks` |
| **Audit / history** | API only | “What did my workforce do this week?” UI | `queue-audit.ts`, storage |
| **Contact-centric views** | Not built | “Everything about Sarah” | new surface or Context tab |
| **Health-centric views** | Brief artifact / KB only | “This week’s training” on Home or Context | KB + future sync |
| **Trust & control** | Global `defaultAutonomyLevel` | Per-domain autonomy (email ok, finance never auto) | `proactive-tasks.ts`, Settings |
| **Prod parity** | Best UX local/uncommitted | Ship post-P6 to production | deploy |

---

## Recommended phasing

Ordered by leverage on the existing stack. Do not start a later phase until prerequisites pass gates.

| Phase | Focus | Rationale |
|-------|--------|-----------|
| **P7.0** | Ship & stabilize | Prod parity unlocks real daily use feedback |
| **P7.1** | UX on existing data | Morning ritual, brief surfacing, suggestion hygiene, audit viewer — no new connectors |
| **P7.2** | Workforce → Inbox | Cron outcomes, calendar/KB cards, `request_human_input` on Home |
| **P7.3** | Richer context | Pick **one** connector spike: contact graph **or** health sync — not both in first slice |
| **P7.4** | Unified timeline + governance | Cross-domain day view, conflict surfacing, per-domain autonomy dashboard |

---

## Checkbox backlog

Mark `[x]` only when `npm run typecheck`, `npm test`, `npm run test:contract`, and `npm run build` pass.

### P7.0 — Ship & stabilize

- [x] **Commit post-P6 polish** — Inbox, email edit, drafts, streaming, chat persist, reset, mobile, queue-types (`bd3a01b`)
- [x] **Deploy to aidea-co** — explicit user request; verify prod matches local Home/Inbox UX

### P7.1 — UX on existing data

- [x] **Daily lite brief** — Single-agent morning mode; skip 5 parallel sub-agents ([ROADMAP P6 backlog](../ROADMAP.md#p6-backlog-not-started))
- [x] **Morning brief on Home** — Cron/lite output → Inbox row or chat card, not Studio-only (`MorningBriefRenderer`, `HomeScreen`)
- [x] **Suggestion dismiss** — Persist dismissed proactive IDs; hide from feed (`proactive-tasks.ts`, profile or storage)
- [x] **Suggestion snooze** — Snooze until date; re-surface in feed
- [x] **Audit trail viewer** — Browse approved/rejected/saved queue history (`queue-audit.ts`, new Settings or Inbox panel)

### P7.2 — Workforce → Inbox

- [x] **Health-briefer → Inbox** — Workout/meal guidance as Inbox row or approval when actionable
- [ ] **Relationship-monitor → Inbox** — Cooling contacts as queue or structured suggestion cards (not only KB nudge)
- [x] **Calendar approval cards** — Polished Inbox UX for `calendar_event` queue items (`TaskFeed`, `execute-queued-action.ts`)
- [x] **KB update approval cards** — Polished Inbox UX for `kb_update` queue items
- [ ] **request_human_input on Home** — Surface harness human-input prompts in Inbox or chat modal (not Studio-only)

### P7.3 — Richer context (pick one per slice)

- [ ] **Contact interaction graph (spike)** — Last touch, channels, interaction history beyond Google People read
- [ ] **Health sync spike** — One wearable/API path → KB or live tool (Apple Health, Strava, or Whoop — pick one)

### P7.4 — Unified timeline + governance

- [ ] **Unified timeline** — “What happened across domains yesterday” view on Home or dedicated tab
- [ ] **Conflict surfacing** — When calendar vs health KB disagree, explicit merge UX for user
- [ ] **Per-domain autonomy** — Trust dashboard: email semi-auto, finance never auto, etc. (`Settings`, `proactive-tasks.ts`)
- [ ] **Contact-centric view** — “Everything about [person]” from KB + mail + calendar signals
- [ ] **Health-centric view** — “This week’s training” from KB + sync when available

### Deferred (not P7)

- Multi-user auth and billing ([VISION deferred](./VISION.md#explicitly-deferred))
- Full 6-agent Daily OS as default Home morning path
- All Phase 3 connectors at once (Plaid, Slack, Notion, WhatsApp)
- Autonomous send without approval in supervised mode

---

## Explicit non-goals for P7

Align with [VISION.md — Explicitly deferred](./VISION.md#explicitly-deferred):

- Not a public multi-user SaaS in P7
- Not replacing Gmail/Calendar/health apps as primary UI
- Not building every connector before Home morning ritual works on prod
- Not merging Studio debug UX into Home daily loop

---

## Updating this document

When a checkbox closes:

1. Mark `[x]` here and the matching [ROADMAP P7](../ROADMAP.md#p7--gap-closure-see-docsplanmd) item.
2. Update [VISION.md](./VISION.md) domain score and **Next enrichment** if the domain changed materially.
3. Append one line to [ROADMAP Loop log](../ROADMAP.md#loop-log).
