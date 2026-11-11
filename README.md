This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Vercel Test Run
# Clinician access review

The administrator clinician list distinguishes account status from backend-reported clinical access. Blocked access shows the server's reason; missing eligibility data is not treated as approval. The review dialog only presents decision controls when the backend returns `can_review=true`; the API independently enforces super/operations administrator authority. Mobile cards, dark-mode persistence, explicit form errors, approval/suspension changes and read-only inspection are covered by the browser privacy suite. Deploy the corresponding Platform API eligibility/permissions contract before this UI change. No live clinician is automatically approved.

## Clinical notices and result uploads

`/patient/notifications` shows up to 50 recent account and care updates; the
dashboard shows five. Published-summary links use validated immutable record
references. `/admin/dashboard` includes metadata-only publication delivery recovery;
the API decides which administrators may retry. These notices send no email/SMS.

`/doctor/notifications` is an ordering-clinician lab-result inbox with bounded
cursor pagination. Its links select an authorized patient, order and exact current
file on `/doctor/lab-orders`; replaced/unavailable files cannot open a substitute.
Opening a file still requires the existing explicit secure-download flow. Marking
a notification read never records clinical review or a treatment decision.

Both result-upload forms retain an opaque upload UUID in component memory across
identical retries. The server binds that UUID to the file, note, actor and order;
an unconfirmed response offers recovery using the same intent. A changed intent
gets a new UUID. Replaying an old saved upload cannot replace a newer result.
No medical content or upload fingerprint is stored in browser storage.

Deploy the Platform API inbox contract **after** applying its additive migration
`20261107_0100`, then deploy this frontend. Consult the backend README for rollback
and access rules. Do not downgrade a used inbox table during a code rollback.

For production-build browser regressions, set both `API_BASE_URL` and
`NEXT_PUBLIC_API_BASE_URL` to the isolated fixture upstream
`http://127.0.0.1:3101` during **both build and server startup**. Run the web server
on port 3100 with `E2E_EXTERNAL_SERVER=1`, `E2E_PRODUCTION=1` and
`E2E_BASE_URL=http://127.0.0.1:3100`. The cookie-isolation spec starts its own
synthetic upstream; all other clinical tests intercept their API calls. Never
point this synthetic regression server at a deployed API. CI fails on flakes;
use `--retries=0` when reproducing a failure locally.

## Clinical instruction integrity

Doctor medication and care-plan pages share one authoring component and safe read
adapters. Historical missing values remain “Not recorded”; malformed schedules and
ambiguous identifiers require review. Corrections send only changed fields through
the existing PUT APIs, preserving untouched historical data and explicit optional
clears. Episode associations are creation-only. Medication schedules accept the
recorded dayparts or exact 24-hour `HH:MM` values without translating one into the
other; optional care-plan progress distinguishes unknown from an explicit zero.
Patient adherence is a separate patient-reported event addressed by medication ID;
it never changes clinician status or progress, and medication names are never put
in navigation URLs. Run `node --test tests/clinical-authoring-integrity.test.cjs`
and, against the isolated production-build fixture server described above,
`./node_modules/.bin/playwright test e2e/clinical-authoring-integrity.spec.ts --workers=1 --retries=0`.
The shared clinician patient selector uses explicit-submit search and 25-row pages
through the assigned-patient API's read-only POST search. Name, email and phone
searches stay in JSON bodies and are never added to request/navigation URLs;
background focus refresh does not record session activity. The selected patient remains independent
of the visible search/page and is rechecked with an exact relationship lookup before
clinical actions. Search terms, pages and selected clinical details remain in component
memory; list results never grant access beyond server authorization. Failed access
rechecks block clinical actions and offer a retry. Losing selected access during a
write invalidates its UI continuation. If a create outcome cannot be confirmed,
its draft stays visible after recovery, and creating again requires a successful
authorized list reload plus an explicit review/discard/reset of that uncertain
draft; a refresh alone never enables a blind duplicate create. Regression commands:
`node --test tests/clinical-patient-directory.test.cjs` and
`./node_modules/.bin/playwright test e2e/clinical-patient-directory.spec.ts --workers=1 --retries=0`.
These browser tests also use the isolated fixture server described above.

Release order: deploy the Platform API revision that implements
`POST /api/v1/doctor/patients/search`, verify that exact revision is **READY** and
that the authenticated read-only route responds correctly, then promote this
frontend to live development. A GET-only API revision returns 404 for the new
search requests. Frontend review/CI may run in parallel; frontend development
promotion must wait for API readiness. The previous frontend remains compatible
while the additive API route is deployed.


## Exact-file lab result review

`/doctor/lab-orders` records result review only through explicit clinician
confirmation tied to the current patient, order and file. Uploading, issuing a
download, reading an inbox update or selecting Completed does not record review.
Review receipts are idempotent for the same file, with in-memory retry recovery;
a replacement starts without a review and cannot inherit an earlier file's receipt.
Server capabilities govern review, edit and delete actions. Lab Orders reuses the
bounded private patient selector and a separate exact relationship lookup, so
patients beyond the first page remain reachable and search/page changes do not
change the selected review target. Patient Lab Requests
and Medical Records display only matched review metadata, without inferring a
result interpretation or changing clinical instructions. Request-specific links
contain validated UUIDs; patient file access uses an explicit expiring download
link, with no automatic popup or medical content in URLs/browser storage.

Deploy the additive review-receipt migration, verify the new API revision READY
and its result-review contract, then promote this frontend. Missing new fields
remain unavailable; legacy Completed statuses are never migrated into reviews.
Run `node --test tests/lab-result-review.test.cjs` and the isolated production
browser suite `./node_modules/.bin/playwright test e2e/lab-result-review.spec.ts --workers=1 --retries=0`.


## Safe request diagnostics

The browser boundary generates a fresh UUIDv4 for each HTTP request, discards any
browser-provided request ID and sends its own `X-Request-ID` to Platform API. The
same reference is returned for successful responses, API failures and local
boundary failures; login and its identity verification share that reference.
API/CWS and the UI accept canonical lowercase UUID references of any version.
References are diagnostic metadata, never access credentials or idempotency keys.
Existing cookie, CSRF, role, private-cache and timing-header behavior is preserved.
BFF failures and responses taking at least one second emit one bounded diagnostic
to the existing server log: reference, status, duration, finite portal/method and
the static route template only. No raw path, query, headers, body or exception text
is logged. A failed logging sink cannot change the response or its cookies.

Shared patient/doctor clinical errors and administrator clinical audit errors show
a copyable reference when one exists. Copying includes only the UUID; denial
offers manual selection. References clear on retry/success or context change and
are not stored in browser storage. Runtime errors without a server reference do
not receive an invented one. Raw non-JSON responses and error stacks are not used
as UI copy; structured backend validation remains visible. Search this reference
in API/CWS diagnostic logs when investigating a failed attempt.

Validation: `node --test tests/portal-bff.test.cjs tests/account-storage.test.cjs`
and the isolated production browser suites
`./node_modules/.bin/playwright test e2e/request-diagnostics.spec.ts e2e/qa-portal-cookies.spec.ts --workers=1 --retries=0`.
No telemetry vendor, logging resource, schema or authentication policy is added.
