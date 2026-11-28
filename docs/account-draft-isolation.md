# Account draft isolation

This change separates onboarding and booking drafts by authenticated user and login-session revision. Drafts use sessionStorage, survive reload in the same tab, and are discarded on logout or a new login. Ownerless legacy localStorage drafts are discarded rather than attributed to the next user. Database records are not deleted.

Signup email is held only in that tab until authentication. Contact email comes from the authenticated settings API. Emergency contacts are no longer inferred from the patient's own name.

The browser account guard rejects stale request results, refresh responses and logout completions after an account change. Other tabs return to the appropriate sign-in screen. This is browser-state isolation; backend authorization remains necessary.

## Session renewal

Concurrent requests share a renewal promise; the browser's Web Locks API serializes refresh-token rotation across same-origin tabs. After waiting, each caller checks whether another request already renewed the tokens. The original request retries once with the latest access token and its original method/body. Auth endpoints and explicitly supplied temporary credentials are excluded.

- Refresh HTTP 401/403 ends the session and clears private browser drafts.
- Network errors, timeouts, rate limits, other server errors and malformed responses raise a separate temporary error. They preserve credentials and drafts instead of propagating the initial access-token 401 to logout handlers.
- Renewal has a 15-second deadline. Temporary failures apply a shared 5-second backoff, respecting `Retry-After` up to 60 seconds. A subsequent user request can retry after that delay; there is no background retry loop.
- Refresh cannot change the account, role or draft ownership. Late responses remain subject to the account guard.
- Automatic renewal requires Web Locks (current browsers on HTTPS or localhost). Without it, the client reports an error and keeps drafts instead of attempting uncoordinated token rotation.

Backend token rotation and reuse detection are unchanged. If the server rotates successfully but its response is lost, a later retry may require signing in again; this change does not provide server-side idempotent recovery. Different deployment origins and old tabs still running the previous JavaScript do not share the new coordination; reload live-dev tabs after deployment.

## Checks

- `pnpm run test:privacy`: Node regressions covering legacy cleanup, draft ownership, session changes, stale responses/bodies, concurrent renewal, temporary failures, timeout, malformed responses, terminal rejection and logout.
- `pnpm run build`: runs those regressions before the production build.
- `pnpm run test:e2e:privacy`: Chromium browser tests with intercepted synthetic API responses; no local patient database, real registration or email delivery is required.
- Install the test browser with `pnpm exec playwright install chromium`.
- To test an already-running server: `E2E_EXTERNAL_SERVER=1 E2E_BASE_URL=http://127.0.0.1:3100 pnpm run test:e2e:privacy`.

GitHub Actions installs Chromium and tests the production build with synthetic fixtures, including real Web Locks across two tabs, outage recovery and expiry cleanup. Its browser check runs alongside Vercel; a successful Vercel build alone is not acceptance of the browser flow.

## Live-dev acceptance

Use the development branch URL and existing synthetic patients.

1. Enter a distinctive unsaved onboarding draft as A; reload and confirm it is restored.
2. Sign in as B in a second tab. A's old tab must leave the private form; B must never see A's draft.
3. Confirm contact email belongs to the signed-in patient and no emergency contact is invented.
4. Exercise logout; repeat the draft check in a later login.
5. At the next fresh-registration checkpoint, verify signup email, OTP completion and clean onboarding together.

Do not submit personal/clinical test values into another patient's record. Browser autosave is not a database save.

## Recovery and follow-up

Revert this release's commit on development to redeploy the previous code. A revert cannot recover discarded browser drafts; saved database records are unaffected.

Server-backed onboarding persistence, honest dashboard states and removal of fabricated clinical content have since been implemented. Server-side recovery for a lost rotation response remains follow-up work. See [Phase 1 handover](phase-one-handover.md) for current scope, acceptance and limitations.
