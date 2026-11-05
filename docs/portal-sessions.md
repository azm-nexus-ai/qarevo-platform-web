# Portal sessions and rollout

FastAPI remains the authority for identity, account state, clinician approval, roles and bounded sessions. The Next.js same-origin `/api/v1/[...path]` boundary holds credentials in separate patient/doctor/admin host-only HttpOnly cookies. HTTPS cookies use the `__Host-qarevo_{portal}_` prefix, Secure, Path=/ and SameSite=Lax; no Domain attribute. Only loopback HTTP uses unprefixed local-development cookies.

Browser storage holds public identity/session markers and portal preferences, never access, refresh or MFA credentials. Public metadata is not authorization. Every protected API request is still authenticated and authorized by FastAPI. A verified `/session` response gates private rendering. An old tab's session marker cannot mutate or revoke a newer cookie session.

Same-portal login, MFA completion, renewal, logout, password changes and session revocation share a browser Web Lock. Verified metadata is published inside that lock so late credential responses cannot overwrite a newer login. Other portals have independent locks, cookies, drafts, timeout activity and themes. HTTPS/localhost and a current Web Locks-capable browser are required. Large/sensitive clinical payloads stay out of URLs and persistent shared browser storage.

Themes: `qarevo:patient:theme`, `qarevo:doctor:theme`, `qarevo:admin:theme`. Sidebar preferences are separately scoped. Clearing appearance removes only the active portal's settings. Logging out clears only that portal's private browser state. Legacy shared credentials are retired on upgrade; users sign in again separately in each portal.

## Environment

- WEB `API_BASE_URL`: fixed server-side Platform API origin; loopback HTTP or HTTPS only. Never point it to the web application itself. `NEXT_PUBLIC_API_BASE_URL` is a legacy fallback, not the browser request destination.
- WEB/API `BROWSER_PROXY_SECRET`: matching server-only random secret, at least32 characters, stored in hosting secret stores. Vercel's overwritten client-IP header is signed with timestamp/method/target/IP; FastAPI validates it before using that IP for audit/rate limits. Unsigned/spoofed context falls back to normal trusted-proxy rules. Do not log the secret or add NEXT_PUBLIC variables.
- WEB optional `PORTAL_PATIENT_ORIGIN`, `PORTAL_DOCTOR_ORIGIN`, `PORTAL_ADMIN_ORIGIN`: exact HTTPS origin per portal. When configured, a portal host rejects another portal's requested cookie scope.
- Current synthetic development remains on the existing Vercel URL. Production destination is `patient.qarevohealth.com`, `doctor.qarevohealth.com`, `admin.qarevohealth.com` (Spaceship DNS). No production DNS or custom-domain activation is included in this release. qarevo-health.de is managed separately at Hetzner.
- Deployment order: additive API metadata/image/clinical fixes first; full backend tests and exact-revision readiness; web browser/security/build checks on a review branch; then development promotion. No database migration is required by this session release.

## Acceptance

Sign in as three synthetic identities in separate tabs in one browser. Verify each dashboard, independent light/dark preferences and refresh, then log out each role independently; the other two remain usable. Attempt a patient URL with doctor scope: server denies access. Replace an account in a second tab: the first tab refuses stale data/actions rather than silently adopting the new identity. Password changes and revoke-all invalidate the intended account sessions; recovery uses mailbox-controlled flows.

Doctor-created prescriptions and lab requests are read from their authoritative patient-owned sources; medical records do not copy them into another writable store. Patient records refresh on focus, explicit retry and bounded visible-page intervals. Validate ownership with two synthetic patients and two doctors. Clinical drafts remain reviewable drafts; no automated prescription authorization or insurer eligibility is inferred.

Vercel function request payload limit is4.5MB; the BFF bounds requests to4MiB. Current document-upload UI explicitly accepts up to3MiB to leave multipart overhead. Profile images are limited to2MiB and safely re-encoded. Larger medical documents require a separately authorized direct-upload ticket/storage integration; do not introduce JS access tokens to bypass the boundary.
