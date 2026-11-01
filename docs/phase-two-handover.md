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

Remaining: full CWS audit/outbox atomicity and recovery, OTP/log privacy, hosted credential/rate-limit evidence, remaining UI consistency, and the final cross-role acceptance run. The video screen still contains prototype behavior; actual video integration remains Phase 3 and must not be represented as a completed clinical consultation.
