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
