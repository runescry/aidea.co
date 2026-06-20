# aidea — agent instructions

Personal AI chief-of-staff platform. Active UI: `HarnessDashboard` → Home (chat + Work feed), Agents, Studio, Context, Settings.

**Do not recreate the removed legacy stack** (Dashboard, orchestrator, `useAgentSession`, `lib/prompts/*`, imperative leads/working-groups). Agent runs go through `lib/harness/bootstrap.ts`, except **fast-path chat** (see below).

**Deploy:** [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

## Do not (engineering discipline)

### Code & scope

- **No unnecessary code** — minimal diff; no speculative features, one-off abstractions, or unrelated refactors
- **No duplication** — use shared helpers below; do not inline SSE parsing, queue labels, save UX, or profile merge logic
- **No scope creep** — one ROADMAP item or one user request per slice unless explicitly asked
- **No noise** — avoid trivial tests, restating comments, or drive-by formatting outside your edit

### Git & deploy

- **Do not commit** unless the user explicitly asked in this session
- **Do not push** until all local gates pass:
  1. `npm run typecheck`
  2. `npm run test` (unit — `lib/**/*.test.ts`)
  3. `npm run test:contract` (API contracts — `app/api/**/*.contract.test.ts`)
  4. `npm run build`
- **Do not push to `main`** with failing CI or without explicit user request
- **Do not** force-push, amend pushed commits, or skip hooks unless the user explicitly requests it
- One logical change per commit; message explains **why**

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
| `patchQueueAction` | `lib/client/queue.ts` | Approve/reject a queued action from UI |
| `ACTION_TYPE_LABELS` | `lib/harness/action-labels.ts` | Human-readable labels for `ActionType` |
| `useWorkFeed` | `hooks/useWorkFeed.tsx` | **Work feed + nav badge** — single shared poll (wrap app in `WorkFeedProvider`) |
| `usePollingFetch` | `hooks/usePollingFetch.ts` | Generic polling elsewhere — **not** for Work feed |

**Labels:** Import from `@/lib/harness/action-labels` in client components. Do **not** import from `lib/harness/queue.ts` in client code (pulls server storage).

**Work feed:** `HarnessDashboard` mounts `WorkFeedProvider`; `TaskFeed` and nav badge consume `useWorkFeed()`. Intervals: ~20s idle on Home, ~6s while agents run or chat streams, ~45s summary-only off Home; paused when tab hidden. Manual refresh via `refresh()` after chat complete or queue PATCH.

**Tasks API:**

- `GET /api/tasks` — full feed `{ tasks, needsYou, autonomy }`
- `GET /api/tasks?summary=1` — badge only `{ needsYou }`

Work feed UI lives in `components/harness/home/TaskFeed.tsx`. Do not add a separate `ActionQueue` component.

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

- **Home** = chat (`ChatInterface variant="home"`) + **Work** (`TaskFeed` via `useWorkFeed`)
- **Onboarding** = 3-step `QuickStartOnboarding` on first launch; full `OnboardingWizard` from Context → Re-run onboarding
- **Studio** = `RunStudio` (harness debug + entity runs)
- **Agents** = `AgentLibrary` (view/customize workforce)
- **Context** = `KnowledgeBaseEditor`
- Reuse `components/harness/forms.tsx` for inputs (`Label`, `TextField`, `Section`, etc.)

---

## Adding features checklist

1. New SSE endpoint? → `harnessSSEResponse` + `bootstrapEntity` or existing harness path
2. New client stream consumer? → `consumeHarnessSSE`
3. New queue action UI? → extend `TaskFeed`, use `patchQueueAction` + `ACTION_TYPE_LABELS`
4. New agent? → add to `lib/agents/library/`, register in entity config; optional group in `app/api/agents/route.ts`
5. New save panel? → `useSaveFeedback` unless you need granular error states
6. Faster chat routing? → extend `shouldUseFastChat` in `lib/harness/fast-chat.ts` (keep fast vs full split)
7. Work feed refresh? → `useWorkFeed().refresh()` or bump `WorkFeedProvider` `refreshKey` — do not add a second `/api/tasks` poller

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

Client bundles must not import server-only modules (`lib/storage`, `lib/harness/queue` value exports). Use `action-labels.ts` for shared constants.

---

## Performance notes

| Area | Behaviour |
|------|-----------|
| **Simple chat** | Fast path — Haiku, no harness bootstrap (~1–3s) |
| **Tool chat** | Full dispatcher — multi-round tools + external APIs |
| **Daily OS** | Six agents (orchestrator + 5 specialists) — slow by design; lite mode is backlog (ROADMAP P6) |
| **Studio CEOs** | Sonnet (Company/Learning/Creator) |
| **Local dev** | `npm run build && npm start` is faster than `npm run dev` for UI testing |
| **Production** | Co-locate Vercel region with Postgres; set `AI_GATEWAY_API_KEY` on **aidea-co** (team key `aidea-co-prod` — see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#aidea-co-production-aidea-covercelapp)) |

---

## Roadmap & loops

Prioritized work lives in [ROADMAP.md](./ROADMAP.md). For recurring agent execution, use the prompt in [.cursor/loop-prompt.md](./.cursor/loop-prompt.md) with Cursor `/loop`.
