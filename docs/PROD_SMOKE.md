# Production smoke checklist

Run this after auth/session, tenant, integration, or onboarding changes are deployed to `aidea-co.vercel.app`.

## Preconditions

- Vercel env vars are configured: `DATABASE_URL`, `AI_GATEWAY_API_KEY`, `NANGO_SECRET_KEY`, `AIDEA_SESSION_SECRET`, `AIDEA_TENANT_DERIVATION_SECRET`, and `CRON_SECRET`.
- On an existing deployment, `AIDEA_TENANT_DERIVATION_SECRET` was initialized to the pre-upgrade `AIDEA_SESSION_SECRET` value so existing Google tenant ids remain unchanged.
- If migrating legacy tenant data, run `npm run tenant:report -- --from=default` first and decide whether to copy rows with `npm run tenant:migrate`.
- Use a browser profile where clearing app cookies/localStorage is acceptable.

## Login, demo, and logout

1. Clear site data for `aidea-co.vercel.app`.
2. Open `/` and verify the Log in / Sign up screen appears.
3. Click **Use Demo Login**.
4. Verify Home loads with sample Inbox approvals and no Google connection prompt is required.
5. Go to Settings → Account → **Log out**.
6. Confirm logout returns to the Log in / Sign up screen.

## Google onboarding

1. Clear site data again.
2. Open `/` and click **Continue with Google**.
3. Complete the Nango Google connect flow.
4. Call `GET /api/auth/session` in the same browser and verify `authenticated` is `true` and `userId` is an opaque `google:*` id that does not contain the email address.
5. Verify Quick Start opens and the Inbox & calendar step shows Gmail and Calendar connected.
6. If either service is missing, click **Connect now** and verify the page can continue without a manual refresh.
7. Finish onboarding and verify Home loads.
8. Log out, repeat Google entry with the same account, and verify the profile and prior activity resolve to the same tenant.

## Integrations and queue

1. Open Settings and verify connected Google accounts are listed under Google (Gmail & Calendar).
2. Disconnect and reconnect a non-critical test account if safe.
3. Run an inbox/daily action only against a test account.
4. Verify any proposed external action appears in Inbox for approval before sending or drafting.

## Activity reset

1. Settings → Danger zone → Reset activity history.
2. Confirm queue, audit, chat, runs, and latest brief clear.
3. Confirm profile/KB, settings, and Google/Strava connections remain.
4. Verify Home returns through the expected Log in / Sign up / onboarding flow if local onboarding cache is cleared.

## Expected warnings

- Local `npm run build` can fail when the environment cannot fetch Inter from `fonts.gstatic.com`; Vercel CI should still be the deployment gate.
- First request after idle may be slower due to Vercel cold start and Postgres connection setup.
