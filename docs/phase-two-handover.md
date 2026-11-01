# Phase 2: identity, privacy and clinical-data integrity

Status: in progress. This is the agreed second phase, not the later booking/video completion phase.

## Release 1: explicit clinician approval

- Login never grants licence approval, activates a pending clinician or invents phone verification.
- Clinical access requires an active, email-verified provider with an approval flag and an `APPROVE_DOCTOR` admin audit record. Existing automatic flags without this evidence require review in Admin → Doctors → Pending.
- Email verification and professional approval are separate. Phone remains unverified until a real phone check succeeds.
- Admin → Doctors opens a real review dialog. Approval requires an explicit review confirmation and a 4–500-character evidence reference; rejection/suspension require a reason. This records an administrator's decision; it does not automatically validate a professional licence with an external registry.
- Approval, rejection and suspension audit records commit with the business change. Audit failure rolls back the decision.
- Existing Platform API access/refresh tokens stop granting clinical access after suspension. Patient directory/matching/booking and cached availability also check current eligibility.
- Changing a professional licence clears the approval flag and requires review again. Changing a phone clears phone verification.
- Clinician verification resends now call the actual email endpoint.

No database migration is required. Deploy API and frontend from development, verify the exact commits and both CI workflows, then use a synthetic clinician in the admin review dialog. Do not approve real clinicians from automated tests. Previously auto-approved synthetic doctors may require your explicit administrative review before your end-to-end rehearsal.

Regression evidence: backend tests cover legacy auto-approval, pending/suspended/rejected login, approval provenance, rollback on audit failure, current-token denial after suspension, directory/cache eligibility, HTTP validation and existing booking behavior. Browser fixture tests cover opening review, visible errors, approval and suspension. These are not external credential verification or legal approval.

## Remaining Phase 2 work

- CWS direct access tokens and cross-service identity/assignment boundaries, including suspension enforcement.
- Internal draft-submission authorization and consent before any AI processing.
- Remove clinical text from navigation URLs and operational logs.
- Transactional CWS audit/event delivery; PostgreSQL rollback/restart evidence.
- Service credential/rate-limit verification and the final cross-role negative-access matrix.

Booking/video completion, billing/insurance integration and AWS migration retain their later-phase scope. Legal source documents remain drafts and must not be published as approved policy.

## Release 2: current authority and assignment

Platform API resolves current accounts for CWS using scoped, signed service credentials. CWS rechecks human authority on every request and maps provider-user tokens to provider IDs. Authority outages return 503. Booking delegates PATIENT identity rather than impersonating ADMIN; only the owning patient's Platform API booking delegate or an administrator can create an assignment. A clinician cannot claim an unrelated episode.

The API deployment workflow now runs PostgreSQL 16 tests in an isolated CI database: approval plus audit survive new connections, failed audit writes roll back approve/reject/suspend, and another transaction cannot read uncommitted changes. CWS deployment `5ff37b15-418b-4871-b171-653701c841ef` passed cloud deployment and database readiness checks. CWS CI currently tests but does not automatically deploy; this release was deployed through the authenticated CLI.

## Release 3: consent and clinical URL privacy

Intake requires an explicit development data-processing acknowledgement before submission. Optional AI is unchecked by default; backend eligibility uses persisted episode choices, not frontend assertions. Direct AI submission verifies episode ownership/assignment and both consent flags. The clinical consumer requires the AI service identity, consent, physician review and successful validation. AI delivery forwards actual validation results instead of labelling every result passed.

Booking review reads the signed-in patient's profile and saved intake. Clinical narrative is retrieved through the authenticated API, not forwarded in query strings. Legacy `notes` parameters are discarded by booking navigation. Existing browser history or external logs are not retroactively erased. These acknowledgements remain `dev-test-20261101`; they do not publish or approve the supplied legal drafts.

Remaining: hosted credential/rate-limit evidence, AI authority deployment checks, remaining UI consistency, and the final cross-role acceptance run. The video screen still contains prototype behavior; actual video integration remains Phase 3 and must not be represented as a completed clinical consultation.


## Release 4: durable activity and log privacy

Platform API `f2df2d94` passes 627 local tests including real PostgreSQL receipt concurrency and rollback; deployment workflow `41350339010` passed. CWS `d0ac4400` passes 177 tests including seven PostgreSQL recovery scenarios; workflow `41350414064` passed and cloud deployment `6b45a1cc-cc8d-443a-9099-f2df8618e476` succeeded. The CWS worker requires `OUTBOX_PUBLISHER_ENABLED=true`; activation and live signed delivery still require verification. One audited clinical transaction now owns its durable delivery record. Failed/expired external acknowledgements are retried using a stable event ID. Email idempotency has Resend's 24-hour bound; the runbook does not claim exactly-once external email.

API `0cdaeb7c` removed debug OTP logging and false debug-delivery success. SMS development mode reports unavailable without generating or consuming an OTP. Its deployment workflow `41349480916` passed. The full web privacy suite at `f3fdc106` passed (`41349489769`), and Vercel marked that exact SHA ready.

## Release 5: truthful UI and visible theme controls

The shared theme control is visibly labelled Dark mode in the main navigation, clinician/admin desktop headers and mobile navigation, and patient headers. One root theme and persisted key serve every route; browser coverage checks refresh, routes, logout/new session and cross-tab changes. The patient video screens no longer simulate doctor chat, SOAP notes, recordings, vitals or successful device tests. Real local camera/microphone checks remain accessible. The existing meeting APIs and Chime adapter are preserved for Phase 3 integration. Patient and clinician video availability use the same shared component.

Unverified HIPAA, SOC 2, ISO and CE badges were removed from public acquisition/authentication screens. The old technical whitepaper is withheld from its public route pending factual review; its source remains in version control. Cookie information now carries the same unapproved-development status as privacy/terms. This is not a legal approval.

## Next requested phases and external dependencies

The owner requested continuing directly through Phases 3 and 4 after Phase 2 validation. Phase 3 is the complete booking/video/approved-record journey, not an extension of a simulated video UI. Phase 4 includes automated payment/invoicing and insurance workflows. On 2026-11-01 the owner confirmed payment/provider accounts are not yet arranged and commercial fees/insurance arrangements remain pending; continue technical integration work without asserting payment or insurance readiness. No real charges or insurance submissions are authorized by test configuration.

## Current verification and Phase 3 overlap — 2026-11-01

The older “remaining” lists above are release history. Current automated evidence includes 672 Platform API tests (PostgreSQL booking races, audit rollback and restart), 213 CWS tests, 101 AI tests, 36 web unit tests and the production frontend build. Browser coverage at the previous web release passed 31 scenarios; the calendar release adds a separate-browser-timezone booking scenario and must pass CI before acceptance.

Live-dev API forwarding was measured, not guessed: this deployment appends four addresses. `TRUST_PROXY_HEADERS=true` / `TRUSTED_PROXY_COUNT=4` keeps one auth budget despite rotating internal proxies and forged leading headers. The live probe returned ten validation responses followed by 429 with Retry-After/CORS; refresh remained exempt. Bounded opt-in proxy diagnostics are disabled. The limiter is still per process; a shared edge/store limit is required before multi-replica production.

CWS and AI readiness now check their signed downstream authority services. Late AI results are refused after consent removal, closure, expiry or account suspension. Raw AI drafts cannot be published directly as patient recommendations through the legacy endpoints. Service delegation to human actors is restricted to Platform API. Separate cryptographic identities between services still require a reviewed key-isolation rollout; claims alone do not isolate services that share signing material.

Phase 3 booking integrity has begun: patient/provider row locks prevent competing reservations; CWS linkage failure rolls back the local booking; assignment retries no longer duplicate events. Cancel/reschedule and video join share lifecycle checks. Calendar selection and confirmation now carry exact server-provided UTC instants and use the clinician's configured timezone, duration, buffer and working days. Berlin summer/winter and DST edge cases are tested. Empty or incomplete schedules never invent slots. Payment prices and cancellation fees are not represented as approved commercial terms.

Still outstanding before declaring the phases complete: controlled live outbox activation and delivery; full cross-role clinical rehearsal; consolidation of legacy scheduling paths; recovery of remote clinical creation after partial network failure; actual video UI and two-party call evidence; clinician-approved record publication; payment/invoicing provider and commercial agreement decisions; final visual/regression acceptance. The owner authorized test notifications to sadiq@qarevo-health.de and supplied info@qarevohealth.com for the rehearsal; its exact account role and approval must be checked. Do not enable delivery of the historical outbox backlog indiscriminately.

### Appointment management increment — 1 November 2026

Patient appointment details now read the owned database record, including the assigned clinician and actual start/end times. Rescheduling reads the same published clinician calendar as booking, rechecks the chosen UTC slot, submits it to the transactional lifecycle endpoint and reloads the saved appointment. Cancellation reasons travel in the JSON body; failed cancellation stays visible in the dialog. Cancellation no longer invents a refund. The details screen no longer fabricates insurance verification, documents, care-team messages or fees. Video navigation carries the consultation identifier, not join credentials.

Validation: Platform API 688 tests (including detail ownership, JSON cancellation validation, PostgreSQL calendar/concurrency and lifecycle checks); frontend unit tests, typecheck and production build pass. Added browser scenarios cover persisted rescheduling, stale availability, cancellation outage/retry and absence of false refund claims; CI result is tracked with this commit. Phase 3 remains in progress: actual video media/reconnect, finalised clinical records, outbox delivery and distributed recovery are still acceptance requirements.

Synthetic rehearsal: clinician **sadiq@qarevo-health.de** (user correction); AWS account **185236887692**, Frankfurt **eu-central-1**, approved for synthetic testing. Do not infer clinician approval from an email address. Commercial provider, approved pricing and insurance arrangement remain pending.

### Development cost boundary — 2 November 2026

Owner clarification: development should cost as little as possible, ideally nothing; production spending is a separate decision. Continue local tests and existing free-tier deployment, avoiding unapproved paid upgrades and recurring resources. Routine AI/video/payment regression fixtures must not call chargeable providers. Real provider rehearsals need a bounded cost estimate before execution; do not present fixture success as a live integration pass.

Verified account UI: GitHub organization is Free, current Actions billable usage $0, $0.36 of $12 included compute consumed, and a $0 Actions overage budget blocks paid usage. Vercel azmnexus-projects is Hobby, no payment method, AI Gateway auto-reload off. FastAPI Cloud AZM Nexus is Hobby/Free, with 3 apps and automatic scale-to-zero; the account explicitly says usage-based billing is not being invoiced during beta. These observations are dated and must be rechecked if a plan changes. Neon, Resend, AI-provider and existing AWS account-wide charges are not yet verified.

AWS: a dedicated IAM user `qarevo-live-dev-chime` was provisioned in approved account 185236887692 with only create/get/attendee/delete meeting permissions in eu-central-1. The credential was stored directly as secret FastAPI Cloud variables, never in source. The provider creation rehearsal returned ClientError before any meeting ID was obtained; no media attendee joined. Following the cost request, its access key was made inactive and verified inactive. Do not enable video until that credential/provider setup is reviewed. No AWS compute, storage or recording resources were provisioned by this increment. No account-wide zero-charge claim is made.
