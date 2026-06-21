# aidea — agent instructions

Personal AI chief-of-staff platform — unified context across mail, calendar, health, contacts, KB, and connected services. Active UI: `HarnessDashboard` → **Home** (chat + **Inbox**), Agents, Studio, Context, Settings.

**Production:** [aidea-co.vercel.app](https://aidea-co.vercel.app) · **Local:** `http://localhost:3000`

**Product vision & domain maturity:** [docs/VISION.md](./docs/VISION.md) · [Interactive reader](/docs/vision)

**Gap closure plan (P7+P8):** [docs/PLAN.md](./docs/PLAN.md) · [Interactive reader](/docs/plan)

**Do not recreate the removed legacy stack** (Dashboard, orchestrator, `useAgentSession`, `lib/prompts/*`, imperative leads/working-groups). Agent runs go through `lib/harness/bootstrap.ts`, except **fast-path chat** (see below).

**Deploy:** [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

### Documentation map

| Doc | Read when |
|-----|-----------|
| [ROADMAP.md](./ROADMAP.md) | Picking the next checkbox; loop iterations |
| [docs/PLAN.md](./docs/PLAN.md) | P7 complete; **P8** strategic slices (harden + extend) |
| [docs/VISION.md](./docs/VISION.md) | Domain scope, scores, non-goals |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Env, Nango, Vercel, Postgres |
| [.cursor/loop-prompt.md](./.cursor/loop-prompt.md) | `/loop` automation |
| [.cursor/rules/](./.cursor/rules/) | Scoped constraints (always-on + globs) |

---

## Do not (engineering discipline)

### Code & scope

- **No unnecessary code** — minimal diff; no speculative features, one-off abstractions, or unrelated refactors
- **No duplication** — use shared helpers below; do not inline SSE parsing, queue labels, save UX, or profile merge logic
- **No scope creep** — one ROADMAP item or one user request per slice unless explicitly asked
- **No noise** — avoid trivial tests, restating comments, or drive-by formatting outside your edit

### Git & deploy

**Default workflow: local development.** Run and validate with `npm run dev` on localhost. Production (`aidea-co.vercel.app`) is updated only when the user explicitly asks to push or deploy.

- **Do not commit** unless the user explicitly asked in this session
- **Always run local gates** before telling the user work is ready (even when not committing):
  1. `npm run typecheck`
  2. `npm run test` (unit — `lib/**/*.test.ts`)
  3. `npm run test:contract` (API contracts — `app/api/**/*.contract.test.ts`)
  4. `npm run build`
- **Do not push to `main` or deploy to Vercel** without the user's **explicit** request in that session — no proactive pushes after fixes
- **Do not push** with failing local gates or failing CI on the branch
- **Do not** force-push, amend pushed commits, or skip hooks unless the user explicitly requests it
- One logical change per commit; message explains **why**

For faster local iteration, leave `DATABASE_URL` unset in `.env.local` to use filesystem storage under `data/` (see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#local-development-default)).

Cursor enforces this in `.cursor/rules/engineering-discipline.mdc`.

---

## Shared helpers (use these — do not duplicate)

### SSE streaming

| Helper | Path | Use when |
|--------|------|----------|
| `consumeHarnessSSE` | `lib/client/sse.ts` | Client reads `data: {...}\n\n` events from a `fetch` Response |
| `harnessSSEResponse` | `lib/api/sse.ts` | API route streams harness events to the browser |

**Client example:**

```typescript
import { consumeHarnessSSE } from '@/lib/client/sse';
import type { HarnessEvent } from '@/lib/harness/types';

const res = await fetch('/api/message', { method: 'POST', body: JSON.stringify({ command }), signal });
await consumeHarnessSSE<HarnessEvent>(res, (event) => handleEvent(event));
// AbortError is swallowed inside consumeHarnessSSE; wrap fetch in try/catch for other errors
```

**API route example:**

```typescript
import { harnessSSEResponse } from '@/lib/api/sse';
import { bootstrapEntity } from '@/lib/harness/bootstrap';

return harnessSSEResponse(sessionId, async (send) => {
  await bootstrapEntity(config, input, send, sessionId);
});
```

Do **not** copy TextEncoder/ReadableStream/buffer-split logic into new files.

---

### Chat dispatch (`POST /api/message`)

Two paths — same SSE event shape (`agent_text_delta`, `agent_complete`, etc.):

| Path | When | Module |
|------|------|--------|
| **Fast** | Greetings, general Q&A, planning advice — no tools | `shouldUseFastChat` + `runFastChat` in `lib/harness/fast-chat.ts` |
| **Full** | Inbox/calendar/drafts, research, profile updates, follow-ups on numbered items | `bootstrapEntity` + `dispatchEntityConfig` |

Extend routing in `shouldUseFastChat` (and tests in `fast-chat.test.ts`) — do not add a third parallel chat stack.

---

### Queue & tasks (client)

| Helper | Path | Use when |
|--------|------|----------|
| `patchQueueAction` | `lib/client/queue.ts` | Approve / save to drafts / reject; optional `QueueEditOverrides` |
| `QueueEditOverrides`, `QueueIntent` | `lib/harness/queue-types.ts` | Client-safe queue types — **never** import `@/lib/harness/queue` in client code |
| `ACTION_TYPE_LABELS` | `lib/harness/action-labels.ts` | Human-readable labels for `ActionType` |
| `useWorkFeed` | `hooks/useWorkFeed.tsx` | **Inbox feed + nav badge** — single shared poll (wrap app in `WorkFeedProvider`) |
| `usePollingFetch` | `hooks/usePollingFetch.ts` | Generic polling elsewhere — **not** for Inbox feed |

**Labels:** Import from `@/lib/harness/action-labels` in client components. Do **not** import from `lib/harness/queue.ts` in client code (pulls server storage).

**Queue intents:** `approve` (send), `save` (Gmail draft via Nango), `reject`. Live edits (`body`, `subject`, `to`, `cc`) pass as optional `edits` on `PATCH /api/queue`; server applies via `applyQueueEdits` in `normalize-queue-action.ts`.

**Inbox feed:** `HarnessDashboard` mounts `WorkFeedProvider`; `TaskFeed` and nav badge consume `useWorkFeed()`. Intervals: ~20s idle on Home, ~6s while agents run or chat streams, ~45s summary-only off Home; paused when tab hidden. Manual refresh via `refresh()` after chat complete, queue PATCH, or activity reset.

**Tasks API:**

- `GET /api/tasks` — full feed `{ tasks, needsYou, suggestions, autonomy }`
  - `needsYou` = queue items with `status: needs_you` and `source: queue` (awaiting approval)
  - `suggestions` = proactive nudges from KB (`lib/harness/proactive-tasks.ts`)
- `GET /api/tasks?summary=1` — badge counts `{ needsYou, suggestions }` (nav badge uses `needsYou` only)

Inbox UI lives in `components/harness/home/TaskFeed.tsx` (panel title **Inbox**). Do not add a separate `ActionQueue` component.

---

### Chat persistence (client + server)

| Helper | Path | Use when |
|--------|------|----------|
| `ChatProvider` / `useChatConversations` | `hooks/useChatConversations.tsx` | Home chat state, send, sync to server |
| `resetLocalChatStore` | `hooks/useChatConversations.tsx` | After activity reset — clears `localStorage` + in-memory chat |

**API:** `GET/PUT/DELETE /api/chat` — conversations in Postgres or `data/chat/` (filesystem). Hard delete on `DELETE ?id=`. Client caches in `localStorage` key `aidea-chat-v1`; clear after server-side activity reset.

**Home chat:** Markdown via `ChatMarkdown`; inbox summaries as structured cards; streams via `consumeHarnessSSE` (`agent_text_delta`). Conversation history passed to dispatcher on full-path messages.

---

### Activity reset

Clears queue, audit trail, harness runs, chat, and latest brief. **Preserves** profile/KB, app settings, and Nango connections.

| Mechanism | Path |
|-----------|------|
| Settings UI | Settings → **Danger zone** → Reset activity history (confirm dialog) |
| API | `POST /api/reset` → `{ ok: true }` |
| CLI | `npm run reset:activity` |

Implementation: `clearActivityHistory()` in `lib/storage`. Proactive suggestions reappear after reset (derived from KB, not stored separately).

---

### Integrations (Nango)

Gmail & Calendar OAuth via [Nango](https://app.nango.dev). Settings → Connect Google. Requires `NANGO_SECRET_KEY` in `.env.local` (dev) or Vercel env vars (prod); restart dev server after env changes. Gmail send/drafts need `gmail.compose` scope on the Nango `google-mail` integration.

**Do not** use direct `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — all Google access goes through Nango.

---

### Save UX (client)

| Helper | Path | Use when |
|--------|------|----------|
| `useSaveFeedback` | `hooks/useSaveFeedback.ts` | Form panels with Save → Saving… → Saved ✓ |

```typescript
const { saving, saved, runSave } = useSaveFeedback();

await runSave(async () => {
  await fetch('/api/kb', { method: 'POST', body: JSON.stringify({ updates }) });
});
```

For custom error handling (e.g. Agent Library), manage errors locally; still prefer `runSave` only when success/failure maps cleanly.

---

### Profile / KB (server)

| Helper | Path | Use when |
|--------|------|----------|
| `mergeProfile` | `lib/storage` | Merge top-level or dot-key updates into profile |
| `writeManyKB` | `lib/harness/knowledge-base.ts` | Batch KB writes — delegates to `mergeProfile` |
| `readKB` / `readAllKB` | `lib/harness/knowledge-base.ts` | Profile reads (15s in-process cache; invalidated on write) |

Do not reimplement read-merge-write against `readProfile`/`writeProfile`.

---

### Agent library & overrides (server)

| Helper | Path | Use when |
|--------|------|----------|
| `loadAgentOverrides` | `lib/agents/resolve.ts` | Load user customizations before a harness run |
| `resolveLibraryAgent` | `lib/agents/resolve.ts` | Apply overrides to a library agent definition |
| `applyAgentOverride` | `lib/agents/resolve.ts` | Build effective prompt + tools for one agent |
| `mergeOverride` | `lib/agents/resolve.ts` | Merge UI/API updates into `agentOverrides` |

Runtime: `bootstrap.ts` and `spawn.ts` call `resolveLibraryAgent` — new spawn paths must too.

Agent definitions live in `lib/agents/library/`. User overrides persist at `profile.agentOverrides`.

---

## UI conventions

- **Home** = chat (`ChatInterface variant="home"`) + **Inbox** (`TaskFeed` via `useWorkFeed`)
  - **Desktop (`lg+`):** chat left, Inbox panel right (~380px)
  - **Mobile (`<lg`):** full-height chat; Inbox via header button → full-screen overlay
- **Nav:** collapsible sidebar (desktop); `MobileBottomNav` (mobile); badge on Home = pending approvals
- **Onboarding** = 3-step `QuickStartOnboarding` on first launch; full `OnboardingWizard` from Context → Re-run onboarding
- **Studio** = `RunStudio` (harness debug + entity runs); Reset session = in-memory only
- **Agents** = `AgentLibrary` (view/customize workforce); Reset = agent overrides only
- **Context** = `KnowledgeBaseEditor` (+ contact/health lenses from P7.4)
- **Settings** = API keys, Google connect/disconnect, per-domain autonomy (P7.4), queue activity audit, **Danger zone** (activity reset)
- **Home Yesterday tab** = cross-domain timeline (`HomeScreen.tsx`)
- Reuse `components/harness/forms.tsx` for inputs (`Label`, `TextField`, `TextArea`, `Section`, etc.)

---

## Adding features checklist

1. New SSE endpoint? → `harnessSSEResponse` + `bootstrapEntity` or existing harness path
2. New client stream consumer? → `consumeHarnessSSE`
3. New queue action UI? → extend `TaskFeed`, use `patchQueueAction` + `ACTION_TYPE_LABELS` + `queue-types`
4. New agent? → add to `lib/agents/library/`, register in entity config; optional group in `app/api/agents/route.ts`
5. New save panel? → `useSaveFeedback` unless you need granular error states (catch errors — do not throw to React after setting inline error)
6. Faster chat routing? → extend `shouldUseFastChat` in `lib/harness/fast-chat.ts` (keep fast vs full split)
7. Inbox feed refresh? → `useWorkFeed().refresh()` or bump `WorkFeedProvider` `refreshKey` — do not add a second `/api/tasks` poller
8. Activity reset? → `POST /api/reset` or Settings button; call `resetLocalChatStore()` client-side

---

## Build & CI

```bash
npm run dev
npm run typecheck
npm test              # unit (lib/)
npm run test:contract # API contracts (app/api/)
npm run test:all      # both
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs **typecheck → unit tests → contract tests → build** on push/PR to `main`.

| Layer | Location | Purpose |
|-------|----------|---------|
| Unit | `lib/**/*.test.ts` | Pure logic, no network |
| Contract | `app/api/**/*.contract.test.ts` | Handler status + JSON shape |
| Integration | `tests/integration/**/*.test.ts` | Multi-step API scenarios (opt-in) |

Do not merge behavior or API changes without updating the relevant tests.

### Integration tests (API scenario runner)

Runs only when explicitly requested — **not** part of default CI.

```bash
# Handler mode — calls route handlers directly (no dev server)
npm run test:integration

# HTTP mode — against a running app
npm run dev   # separate terminal
TEST_BASE_URL=http://localhost:3000 npm run test:integration
```

`npm run test:integration` sets `INTEGRATION_CHAT=1`. Chat dispatch runs when `.env.local` has `AI_GATEWAY_API_KEY` (Vercel AI Gateway — recommended) or a valid direct `ANTHROPIC_API_KEY`. Placeholder keys are ignored.

Reads `.env.local` for `AI_GATEWAY_API_KEY` (preferred) or `ANTHROPIC_API_KEY`. Chat scenarios run when `INTEGRATION_CHAT=1` (default in `npm run test:integration`) and a valid gateway or Anthropic key is set.

Scenarios: agent library load + override round-trip, Work feed + queue reject, optional chat dispatch SSE completion (skipped if API key is missing or placeholder).

### Inbox triage harness

End-to-end run of the `inbox-triage` agent with structured validation (tools called, `inbox_triage` shape, messageId attribution, list limits).

```bash
# Vitest (dry-run mock inbox — needs LLM key in .env.local)
npm run test:inbox-triage

# Vitest against live Gmail (Nango connected + INTEGRATION_GMAIL=1)
npm run test:inbox-triage:live

# CLI report (same modes; live when INTEGRATION_GMAIL=1)
npm run test:inbox-triage:run
INTEGRATION_GMAIL=1 npm run test:inbox-triage:run
```

Validation logic: `lib/harness/inbox-triage-validate.ts`. Runner: `lib/harness/inbox-triage-harness.ts`.

Client bundles must not import server-only modules (`lib/storage`, `lib/harness/queue` value exports). Use `queue-types.ts`, `action-labels.ts`, and `lib/client/*` instead.

**Dev server 500 / Internal Server Error:** Often corrupted `.next` cache or client importing server code. Fix:

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
pkill -f "next dev" 2>/dev/null
rm -rf .next
npm run dev
```

Run only **one** `next dev` process at a time.

---

## Performance notes

| Area | Behaviour |
|------|-----------|
| **Simple chat** | Fast path — Haiku, no harness bootstrap (~1–3s) |
| **Tool chat** | Full dispatcher — multi-round tools + external APIs |
| **Daily OS** | Lite brief on Home (default); full six-agent run remains Studio/cron — slow by design |
| **Studio CEOs** | Sonnet (Company/Learning/Creator) |
| **Local dev** | `npm run dev` (Turbopack) — primary workflow; optional `npm run build && npm start` for prod-like UI speed |
| **Production** | Deploy **only when explicitly requested**; co-locate Vercel region with Postgres; set `AI_GATEWAY_API_KEY` on **aidea-co** (team key `aidea-co-prod` — see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#aidea-co-production-aidea-covercelapp)) |

---

## Roadmap & loops

Prioritized work lives in [ROADMAP.md](./ROADMAP.md). **P7** (complete) and **P8** (next) gap closure — data, workforce, UX, platform — is detailed in [docs/PLAN.md](./docs/PLAN.md). For recurring agent execution, use the prompt in [.cursor/loop-prompt.md](./.cursor/loop-prompt.md) with Cursor `/loop`.
