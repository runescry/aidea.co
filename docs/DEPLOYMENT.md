# Deployment — Vercel + Postgres

aidea runs locally with JSON files under `data/`. For production (especially multi-user), point storage at Postgres via `DATABASE_URL`.

## Quick checklist

1. Deploy the Next.js app to [Vercel](https://vercel.com).
2. Create a Postgres database (Neon, Supabase, Vercel Postgres, or RDS).
3. Set environment variables in Vercel (Project → Settings → Environment Variables).
4. Redeploy so migrations run on first request.

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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail & Calendar |
| `BRAVE_SEARCH_API_KEY` | Web search tool |
| `NANGO_SECRET_KEY` | OAuth connection management |

Copy from [`.env.local.example`](../.env.local.example) for local development.

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

Tables include: `profiles`, `action_queue`, `action_audit`, `harness_entities`, `chat_conversations`, `app_settings`, and others.

## Vercel-specific notes

- **Settings panel writes are disabled on Vercel** (`isProductionDeploy()`). API keys must be set as Vercel environment variables, not via the in-app Settings form.
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
- **Daily OS / Studio runs:** Multi-agent workflows; CEO agents use Sonnet. Daily brief spawns five parallel sub-agents — the main remaining slow path.
- **Work feed:** Client uses a single `WorkFeedProvider` poll — not duplicate `/api/tasks` fetchers.
- **Dev vs prod:** Use `npm run build && npm start` locally when testing perceived UI speed; `next dev` is slower.
- **Cold starts:** First request after idle on Vercel may add latency; Postgres + AI Gateway should be in the same region where possible.
