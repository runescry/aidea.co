# Known issues

Current limitations and verification gaps for aidea. Keep this list focused on reproducible behaviour or risks directly supported by the implementation. Move completed work to the roadmap history rather than retaining resolved items here.

**Last reviewed:** 2026-07-19

## New-user production journey is not fully smoke-tested

**Status:** Verification required  
**Impact:** A new demo session is expected to work, but the complete production Google journey has not been certified with a real Gmail and Calendar account after the signed-session rollout.

Complete the checks in [PROD_SMOKE.md](./PROD_SMOKE.md), including Google sign-in, both connections, onboarding persistence, Inbox, logout, and same-account re-entry.

## Local onboarding state can outlive the signed session

**Status:** Open  
**Impact:** The browser uses local storage to decide whether to show Login / Sign up. If the signed cookie is removed or expires without the normal logout flow, retained onboarding state can open the dashboard while protected APIs return `401`.

**Workaround:** Use Settings → Account → **Log out**, which clears the session and local caches together. If the cookie was cleared externally, clear site data and reload.

## Google completion depends on an identifiable first connection

**Status:** Needs live verification  
**Impact:** The welcome flow completes the app session on Nango's first `connect` event. Gmail normally exposes the Google email, but a Calendar-first connection may not provide identity with the configured scopes and can leave sign-in incomplete.

**Workaround:** Connect Gmail first. If completion reports that Google did not return an email address, close the flow and retry with Gmail before Calendar.

## Google logout is app-session logout, not integration deletion

**Status:** By design; lifecycle review pending  
**Impact:** Logging out clears the browser's aidea session but preserves Nango connections and tenant data. Signing in again starts with a temporary Nango owner before resolving the stable Google tenant, so the same account may need to authorize Google again and old temporary owners may remain in Nango.

**Workaround:** Use Settings integration controls when the intent is to disconnect Google. Confirm same-account re-entry and review temporary Nango owners during the production smoke test.

## Legacy tenant assignment requires an operational decision

**Status:** Open operation  
**Impact:** Existing rows under `default` or pre-hardening tenant IDs are not automatically assigned to a Google user. New sessions remain isolated, but an existing user's historical data may appear absent until the correct tenant is copied.

**Workaround:** Run `npm run tenant:report -- --from=default`, review the report, and only then use `npm run tenant:migrate` for the intended destination tenant.

## First request after idle can be slower

**Status:** Expected platform behaviour  
**Impact:** Vercel cold starts and initial Postgres connection setup can make the first request noticeably slower than subsequent requests.

**Workaround:** Re-test latency after the first request before diagnosing a persistent performance regression.
