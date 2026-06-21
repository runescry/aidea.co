# Deployment — Vercel + Postgres

aidea runs locally with JSON files under `data/`. For production (especially multi-user), point storage at Postgres via `DATABASE_URL`.

## Local development (default)

Day-to-day work happens on **localhost** — not production. Per-slice build, test gates, and deploy cadence: [PLAN.md § Build workflow](./PLAN.md#build-workflow) · [Test strategy](./PLAN.md#test-strategy) · [Deployment workflow](./PLAN.md#deployment-workflow). **P7** is complete on prod; active backlog is **[PLAN P8](./PLAN.md#p8--harden--extend)**.

```bash
npm run dev          # http://localhost:3000
npm run typecheck && npm test && npm run test:contract && npm run build   # before calling work "done"
```

| Practice | Detail |
|----------|--------|
| **Storage** | Leave `DATABASE_URL` unset in `.env.local` for fast filesystem storage under `data/`. Set it only when you need to test against remote Postgres. |
| **Deploy** | Agents and contributors must **not** push to `main` or trigger Vercel deploys unless the user explicitly asks in that session. |
| **Testing** | All four local gates above still run before handoff — deploy is opt-in, verification is not. |

See [AGENTS.md](../AGENTS.md) for agent git/deploy rules.

**Interactive docs:** Markdown files with Mermaid diagrams are best read in the app at [/docs/vision](/docs/vision), [/docs/plan](/docs/plan), [/docs/architecture](/docs/architecture), and [/docs/roadmap](/docs/roadmap) (light reading mode, rendered diagrams, table of contents).

## Quick checklist (production deploy — explicit request only)

1. Deploy the Next.js app to [Vercel](https://vercel.com).
2. Create a Postgres database (Neon, Supabase, Vercel Postgres, or RDS).
3. Set environment variables in Vercel (Project → Settings → Environment Variables).
4. Redeploy so migrations run on first request.

## Post-deploy smoke ([aidea-co.vercel.app](https://aidea-co.vercel.app))

Run after each prod deploy (extends [PLAN P7.0](./PLAN.md#p70--ship--stabilize); full checklist tracked in [PLAN P8.0](./PLAN.md#p80--complete-p7-partials)):

| Surface | Check |
|---------|-------|
| Home | Chat streams; fast path responds; **Yesterday** tab shows cross-domain timeline |
| Inbox | Tabs; email edit; calendar/KB cards; approve / save / reject; dismiss/snooze suggestions |
| Mobile | Inbox overlay; bottom nav |
| Settings | Integration status; **per-domain autonomy**; queue activity audit; activity reset |
| Context | KB editor; contact/health lenses load without console errors |
| Docs | `/docs/plan`, `/docs/vision` render without console errors |
| Crons | `/api/monitor` reachable with `CRON_SECRET` |

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string. Also accepts `POSTGRES_URL` or `POSTGRES_PRISMA_URL`. |
| `AI_GATEWAY_API_KEY` | **Production LLM auth** — Vercel AI Gateway (required on Vercel; OIDC-only often returns `Forbidden`) |
| `DEFAULT_USER_ID` | Tenant id for single-user deploys (default: `default`). Set per user when you add auth. |

## Optional integrations

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Direct Anthropic (local dev fallback when gateway key is unset) |
| `CRON_SECRET` | Authorize Vercel Cron hits to `/api/monitor` (`Authorization: Bearer …`); schedules in [`vercel.json`](../vercel.json) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` | Optional [Vercel KV](https://vercel.com/docs/storage/vercel-kv) — human-input answers across serverless instances; omit for local dev |
| `BRAVE_SEARCH_API_KEY` | Web search tool |
| `NANGO_SECRET_KEY` | Gmail & Calendar OAuth via [Nango](https://app.nango.dev) — copy from **Environment Settings → Secret key** |

Vercel services **not** used: Auth, Analytics, Blob. See [ARCHITECTURE.md § Vercel platform services](./ARCHITECTURE.md#vercel-platform-services).

Copy from [`.env.local.example`](../.env.local.example) for local development. For Gmail/Calendar in Settings, set `NANGO_SECRET_KEY` in `.env.local` (dev) or Vercel env vars (production), then restart the dev server.

## aidea-co production (`aidea-co.vercel.app`)

Vercel project: **marcus-bowles-projects / aidea-co**

### AI Gateway key (`AI_GATEWAY_API_KEY`)

Production LLM calls (chat, Daily OS sub-agents, Studio CEOs) go through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). The team key is named **`aidea-co-prod`** (partial key ends in `…0Mnslc`).

1. Open [Vercel → AI Gateway → API Keys](https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys) for team **marcus-bowles-projects**.
2. Find the key **`aidea-co-prod`** (or create one with a monthly budget if rotating).
3. Copy the full secret (shown once at creation) into **Vercel → aidea-co → Settings → Environment Variables**:
   - Name: `AI_GATEWAY_API_KEY`
   - Environment: **Production** (and Preview if you test there)
4. **Redeploy** — env changes do not apply to running deployments until redeployed.

Verify the variable is non-empty:

```bash
npx vercel env pull /tmp/aidea-prod.env --environment=production --yes
# AI_GATEWAY_API_KEY should have length > 10 (do not commit this file)
rm /tmp/aidea-prod.env
```

**Why this matters:** If `AI_GATEWAY_API_KEY` is missing or empty, the app falls back to OIDC on Vercel. That path often returns **`403 Forbidden`** for multi-agent Studio runs. [`lib/ai/provider.ts`](../lib/ai/provider.ts) prefers `AI_GATEWAY_API_KEY` → `ANTHROPIC_API_KEY` → OIDC.

Local dev: copy the same key into `.env.local` as `AI_GATEWAY_API_KEY=` (never commit).

## How storage switches

- **No `DATABASE_URL`:** reads/writes `data/*.json` on the local filesystem.
- **With `DATABASE_URL`:** uses Postgres tables defined in [`lib/db/schema.sql`](../lib/db/schema.sql). Schema is applied automatically via [`lib/db/migrate.ts`](../lib/db/migrate.ts) on first DB access.

Tables include: `profiles`, `action_queue`, `action_audit`, `harness_entities`, `chat_conversations`, `chat_meta`, `chat_store` (legacy), `latest_briefs`, `app_settings`.

### Filesystem layout (`data/`)

When `DATABASE_URL` is unset:

| File / dir | Contents |
|------------|----------|
| `knowledge-base.json` | Profile / KB |
| `settings.json` | API keys (local Settings writes) |
| `action-queue.json` | Pending + resolved queue items |
| `action-audit.json` | Approve/reject/save audit trail |
| `harness-state.json` | Harness entity runs |
| `latest-brief.json` | Most recent daily brief |
| `chat/conversations/*.json` + `chat/meta.json` | Chat history |

---

## Activity reset

Clears queue, audit, harness runs, chat, and latest brief. **Does not** wipe profile/KB, settings, or Nango connections.

| Method | Command |
|--------|---------|
| **Settings UI** | Settings → Danger zone → Reset activity history |
| **API** | `POST /api/reset` → `{ ok: true }` |
| **CLI** | `npm run reset:activity` |

After reset, clear browser `localStorage` key `aidea-chat-v1` if chat UI still shows old threads (Settings button does this automatically).

**Production SQL** (if API not deployed yet):

```sql
DELETE FROM action_queue WHERE user_id = 'default';
DELETE FROM action_audit WHERE user_id = 'default';
DELETE FROM harness_entities WHERE user_id = 'default';
DELETE FROM chat_conversations WHERE user_id = 'default';
DELETE FROM chat_meta WHERE user_id = 'default';
DELETE FROM chat_store WHERE user_id = 'default';
DELETE FROM latest_briefs WHERE user_id = 'default';
```

Replace `'default'` with your `DEFAULT_USER_ID` if different.

---

## Dev server troubleshooting

Symptoms: **Internal Server Error** on Home or API routes; Turbopack `Can't resolve 'fs'`; ENOENT on `.next/.../_buildManifest.js`.

**Causes:** (1) corrupted `.next` cache from multiple `next dev` processes or hot reload; (2) client component importing `@/lib/harness/queue` or `@/lib/storage`.

**Fix:**

```bash
lsof -ti:3000 | xargs kill -9 2>/dev/null
pkill -f "next dev" 2>/dev/null
rm -rf .next
npm run dev
```

Keep a single dev server running. Client code must import queue types from `lib/harness/queue-types.ts`, not `lib/harness/queue.ts`.

**Nango local setup:** Copy `NANGO_SECRET_KEY` from [app.nango.dev](https://app.nango.dev) → Environment Settings into `.env.local`. Restart dev server. `vercel env pull` may return empty strings for encrypted vars — paste the key manually if needed.

### Live inbox approve E2E

Opt-in integration test (`npm run test:integration:e2e` / `test:e2e`) — not CI. Requires:

| Variable / setup | Purpose |
|------------------|---------|
| `AI_GATEWAY_API_KEY` or `ANTHROPIC_API_KEY` | Inbox triage LLM run |
| `NANGO_SECRET_KEY` | Gmail send/read; calendar create when connected |
| Gmail connected in Settings | Self-send test mail to connected address |
| Google Calendar connected (optional) | Calendar approve step; skipped with warning if missing |

Test mail subjects use prefix `aidea-e2e-`. The suite sends to yourself, triages, approves an `email_reply`, then approves seeded calendar and KB queue items.

Calendar step creates an event on your **primary** Google Calendar (~90 minutes ahead, title prefix `aidea-e2e-cal`). Search Google Calendar for `aidea-e2e-cal` or check the time slot about 90 minutes from the test run. aidea does not show a live calendar grid — executed events appear only as Inbox → **Done** queue rows (and in Settings audit), not in Home schedule unless a morning brief run included them.

---

- **Settings panel writes are disabled on Vercel** (`isProductionDeploy()`). API keys must be set as Vercel environment variables, not via the in-app Settings form. **Activity reset** (`POST /api/reset`) works on production once deployed.
- **Serverless:** the Postgres client uses `max: 1` connection per instance — suitable for Neon/serverless Postgres.
- **Build:** run locally before shipping:

```bash
npm run typecheck && npm test && npm run test:contract && npm run build
```

## Single-user vs multi-user

Today, `DEFAULT_USER_ID` scopes all rows. For true multi-user:

1. Add authentication (e.g. Clerk, Auth.js) and set `DEFAULT_USER_ID` from the session in middleware or API routes.
2. Ensure every storage call uses `getUserId()` (already centralized in [`lib/storage/index.ts`](../lib/storage/index.ts)).

## Verify Postgres locally

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/aidea"
npm run dev
```

On first API hit, tables are created. Profile and queue data persist in Postgres instead of `data/`.

## Audit trail

Queue approve/reject/execute/fail events append to `action_audit` (Postgres) or `data/action-audit.json` (filesystem). Read via `GET /api/queue/audit`.

## Performance & runtime

- **Chat:** Simple messages use fast-path Haiku (`lib/harness/fast-chat.ts`). Inbox/calendar/drafts/research use full harness dispatch — expect multi-second latency.
- **Daily OS / Studio runs:** Multi-agent workflows; CEO agents use Sonnet. Lite brief is default on Home; full five parallel sub-agents remain the slow cron/Studio path.
- **Work feed:** Client uses a single `WorkFeedProvider` poll — not duplicate `/api/tasks` fetchers.
- **Dev vs prod:** Use `npm run build && npm start` locally when testing perceived UI speed; `next dev` is slower.
- **Cold starts:** First request after idle on Vercel may add latency; Postgres + AI Gateway should be in the same region where possible.
