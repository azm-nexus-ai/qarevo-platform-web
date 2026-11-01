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
