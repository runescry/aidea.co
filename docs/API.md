# API notes

Internal and external HTTP endpoints beyond what the UI uses directly.

---

## `POST /api/eval/chat` — EvalKit adapter (fast-chat only)

Stateless JSON endpoint for external eval harnesses ([EvalKit](https://github.com/runescry/evalkit) and similar). Does **not** use SSE, `command`, or the full harness dispatcher.

### Request

```http
POST /api/eval/chat
Content-Type: application/json

{ "message": "What can you help me with?" }
```

- `message` (string, required) — trimmed user prompt
- No `history` or `sessionId` (keeps eval deterministic)

### Response

**200** — fast path

```json
{ "response": "…", "mode": "fast" }
```

**400** — missing or empty `message`

**500** — no LLM API key configured, or fast-chat failure

### Scope

Always runs `runFastChat` (~1–3s Haiku, no tools) — never `bootstrapEntity` or `/api/message`.

Unlike production `/api/message`, does **not** pre-filter with `shouldUseFastChat`. Prompts that would route to the full harness in production (inbox, calendar, profile writes, research, news, queue, etc.) still invoke the model; the fast-chat system prompt refuses tool actions in natural language.

| Eval expectation | Production `/api/message` |
|------------------|---------------------------|
| All prompts get a model response | `shouldUseFastChat` may route to full harness |
| Model refuses email/calendar/profile in prose | Full harness may execute tools |

### Security

Unauthenticated like `POST /api/message` today. Optional follow-up: `EVAL_API_SECRET` header for production. Do not log full `message` in observability spans.

### EvalKit setup

**Target URL:** `https://aidea-co.vercel.app/api/eval/chat` (or `http://localhost:3000/api/eval/chat` locally)

**Suggested description:**

> Personal AI chief-of-staff (aidea) in fast-chat mode. Answers in 1–4 sentences. No tools, inbox, calendar, email, or profile writes in this endpoint. Must not claim to have sent email, scheduled meetings, updated profile, or queued actions. For those requests, should say the full workflow can handle it. Grounded in user identity/preferences when KB is available. Must stay in scope as a planning/advice assistant, not a financial or medical authority.

**Manual smoke test:**

```bash
curl -s -X POST http://localhost:3000/api/eval/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What can you help me with?"}' | jq
```

---

## `POST /api/eval/agent` — EvalKit adapter (single-agent harness)

Stateless JSON endpoint for EvalKit **agent-matrix** mode. Runs one library agent through `bootstrapEntity` with dry-run tools by default (no live Gmail/Calendar, no real queue writes).

### Request

```http
POST /api/eval/agent
Content-Type: application/json
X-Eval-Api-Secret: <optional when EVAL_API_SECRET is set>

{
  "agentId": "inbox-triage",
  "mission": "Triage unread inbox and surface urgent items.",
  "realWorldMode": "dry-run",
  "applyOverrides": false,
  "kbFixture": {
    "identity": { "name": "Eval User" },
    "work": { "currentProjects": [] }
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `agentId` | yes | Must exist in `AGENT_LIBRARY` |
| `mission` | yes | Initial task for the agent loop |
| `realWorldMode` | no | Default `"dry-run"` — never live integrations in eval |
| `applyOverrides` | no | Default `false` for deterministic eval |
| `kbFixture` | no | Overlay for `kb_read` / profile reads instead of real storage |

### Response

**200** — harness run

```json
{
  "agentId": "inbox-triage",
  "mode": "harness",
  "realWorldMode": "dry-run",
  "response": "Human-readable summary for rubric scoring",
  "structured": {},
  "stateWriteKey": "inbox_triage",
  "toolsCalled": ["kb_read", "gmail_read", "write_state"],
  "toolCalls": [{ "name": "gmail_read", "input": { "query": "is:unread", "maxResults": 20 } }],
  "validation": { "ok": true, "errors": [], "warnings": [] },
  "cost": { "estimatedUSD": 0.02, "agentCount": 1 }
}
```

**400** — unknown `agentId`, missing `mission`, or `realWorldMode: "auto"` without `EVAL_ALLOW_LIVE=1`

**401** — `EVAL_API_SECRET` set but `X-Eval-Api-Secret` header missing or wrong

**500** — no LLM API key, or harness failure

`maxDuration`: 120s. Pilot agents: `inbox-triage`, `finance-director`, `mental-health-director`. All other library agents use the generic harness validator.

### Security

- Default `dry-run`; reject `realWorldMode: "auto"` unless `EVAL_ALLOW_LIVE=1`
- Optional `EVAL_API_SECRET` — when set, require `X-Eval-Api-Secret` header
- Do not log full `mission` in observability spans (hash only)

### Manual smoke test

```bash
curl -s -X POST http://localhost:3000/api/eval/agent \
  -H 'Content-Type: application/json' \
  -d '{
    "agentId": "inbox-triage",
    "mission": "Triage unread inbox and surface urgent items.",
    "kbFixture": { "identity": { "name": "Eval User" } }
  }' | jq
```

---

## `GET /api/eval/agents` — agent catalog for EvalKit fixtures

Returns library metadata for fixture generation.

```http
GET /api/eval/agents
X-Eval-Api-Secret: <optional when EVAL_API_SECRET is set>
```

**200:**

```json
{
  "agents": [
    {
      "id": "inbox-triage",
      "displayName": "Inbox Triage",
      "authority": "executor",
      "defaultTools": ["gmail_read", "queue_action"],
      "stateWriteKey": "inbox_triage",
      "contractSummary": "…"
    }
  ]
}
```
