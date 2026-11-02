# Phase 1: stable development baseline

Status: technical implementation and automated release checks; owner end-to-end acceptance remains required. This is a synthetic-data development environment, not approval for a real-patient pilot or a completed telemedicine MVP.

## Delivered

- Per-account, per-login, per-tab drafts; legacy ownerless drafts discarded. Cross-tab account changes and late requests cannot restore the previous account's data.
- Coordinated session renewal, bounded retries, temporary failure preservation, and logout revocation.
- Personal, contact, medical history and funding steps saved by authenticated APIs. Fresh logins restore server state. The completion screen checks saved steps rather than trusting navigation history.
- Explicit required labels, styled country/nationality/language controls, all 16 German states, international phone and German postcode checks, conditional history validation. Format checks do not establish that an address, insurer or policy is genuine.
- Separate SELF_PAY, GKV and PKV choices; `coverage_verified=false`. No reimbursement promise or simulated insurance-card upload.
- Dashboard and care pages use authenticated account data with loading, empty and retry states. Sample prescriptions, referrals, consultation notes and recovery scores removed from these patient flows.
- Clinician prescription/care-plan mutations persist after reload, use unique IDs, and require an assigned doctor-patient relationship. These are recorded instructions, not a certified electronic prescribing system.
- Recovery links use the configured reset URL, otherwise the verification-email origin plus `/auth/reset-password`. Provider failure preserves the previous link. Public responses do not distinguish unknown, locked or eligible accounts. Successful recovery consumes the token and revokes refresh sessions.
- Admin status contract: `healthy`, `warning`, `critical`; a stable `by_specialty` object. This is operational exception/verification status, not infrastructure uptime monitoring.
- Disabled assessment fails closed; it does not invent urgency or video suitability. Enabling a real assessment/clinician review pathway belongs to the clinical journey work.
- Settings wait for the actual response and show retry on failure; saving preferences does not write stale medical history. Unsupported privacy toggles no longer imply effective consent withdrawal or access control.

## Data and contracts

The Platform API owns these changes. CWS and AI service deployments are unchanged. Onboarding uses the existing patient-owned `portal_page_data` row with `page_key=onboarding-v1`; canonical names, phone, emergency contact, insurance and health summary also use existing models. Each step commits atomically under a user lock. No new schema migration is introduced by these releases; the existing profile migration must already be applied.

`GET /api/v1/patient/settings/onboarding` returns completed steps, next step and saved values. `PUT` child routes `/contact`, `/health`, `/coverage` validate their complete step. Drafts remain unsaved until Continue/Complete succeeds. Patient-reported medication history is never added as a clinician prescription.

The new onboarding JSON is not a replacement for a longitudinal clinical record. Existing settings editors and the onboarding snapshot need continued consolidation in the clinical-data phase. In particular, downstream insurance edits require the same validation and eligibility workflow; format validation in onboarding alone is not insurer verification.

## Legal readiness — supplied drafts remain unpublished

Source package: `Qarevo_Rechtstexte_fuer_Sadiq_2026-10-01`, including the 26-page legal draft PDF. No confidential draft wording or open company fields have been copied into this public repository. `/privacy` and `/terms` explain development-only status.

Registration and onboarding acknowledgements are recorded as `TEST_ACK_*`, version `dev-test-20261101`; `legal_ready=false`. They are test evidence, not approved health-data or treatment consent. Existing historical records have not been relabelled. Marketing remains optional.

The draft assumes a free adult patient portal, Qarevo as intermediary, and legally independent treating practices. Those assumptions still require owner confirmation against the actual offer; no age gate or treatment-contract model has been inferred from them.

| Draft mapping / field register | Required before publication and real-patient use |
| --- | --- |
| A → privacy; B → patient terms; C → practice terms | Complete F01–F05: company, contacts, privacy contacts, scope, roles and contracts. Practice terms need their own approved destination, not a link to patient terms. |
| D → history/triage, video and paid booking | Contextual explanations, distinct required/optional choices, approved versions, evidence and withdrawal handling (F07, F09–F11). No automatic triage or recording claims. |
| E → cookies/footer/imprint | Actual storage/SDK inventory and controls, complete mandatory company and accessibility/consumer information (F12–F13). |
| Privacy annexes | Verify active vendors, regions, subprocessors, transfers, retention, backups/deletion and external data sources (F06, F08, F14). Hosting target AWS is not evidence of current deployment. |

Qualified medical/privacy legal review is still required. Strict input validation and acknowledgement timestamps do not resolve these legal prerequisites.

## Build and release

Repositories: `qarevo-platform-api` and `qarevo-platform-web`, branch `development` in `azm-nexus-ai`. Do not promote to main or change production databases as part of this acceptance.

Backend, from its repository:

```sh
.venv/bin/python -m pip install -r requirements.txt
QAREVO_LOAD_DOTENV=false ENVIRONMENT=development DEBUG=false DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/unused .venv/bin/python -m pytest -q tests
```

The database URL above is deliberately unused by fixture-based tests. `QAREVO_LOAD_DOTENV=false` prevents local credentials and flags from contaminating tests. Normal runtime still loads `.env` by default. The asyncio dependency includes greenlet for Apple Silicon.

Frontend uses Node 22 and pnpm 10.28.0:

```sh
npx --yes pnpm@10.28.0 install --frozen-lockfile
npx --yes pnpm@10.28.0 run build
npx --yes pnpm@10.28.0 exec playwright install chromium
npx --yes pnpm@10.28.0 run test:e2e:privacy
```

Backend CI runs all tests before FastAPI Cloud deployment and checks `/health`. Frontend CI runs Node regressions, a production build and Chromium with synthetic API fixtures. These browser fixtures do not prove live email delivery or live database integration. Browser checks run alongside Vercel and are not currently a promotion gate.

For each release verify the exact Git SHA, CI result and Vercel READY deployment. A GitHub ref update through a connector may require explicitly deploying that SHA through Vercel; a green GitHub Pages job is not a Vercel deployment. Do not deploy uncommitted local changes.

Live-dev frontend: https://qarevo-platform-web-git-development-azmnexus-projects.vercel.app

Live-dev API: https://qarevo-platform-api-a20d63c3.fastapicloud.dev

Keep API/Resend/Neon secrets in their existing secret stores. Confirm `EMAIL_VERIFICATION_LINK_BASE` and optional `PASSWORD_RESET_LINK_BASE` point to this environment. An explicitly configured old reset URL takes precedence and must be corrected in hosting settings. No secrets are needed in this document.

## Owner acceptance checkpoint

Reload existing tabs first so all use the new session coordination.

1. Create one new synthetic patient; check received OTP and email link, expired/reused-code rejection and post-verification navigation. This is the promised fresh-registration checkpoint.
2. Complete all four profile forms, including an invalid phone/postcode, Other under four characters and invalid GKV format. Required fields should be visibly labelled. Try SELF_PAY and insured paths; neither must claim verified coverage.
3. Log out, sign back in and confirm saved values; open unfinished completion URLs and confirm they do not show success.
4. Use two test accounts/tabs; verify no prior-account drafts, names or clinical records leak. Refresh an empty dashboard and prescriptions page: loading then genuine empty state, never sample treatment.
5. Request a reset email and complete it yourself. Check its host, old-password rejection and single-use link behavior. Access JWTs and refresh tokens now share a server-validated session family. Password reset invalidates both at the next authenticated request.
6. Change notification preferences, save and reload. Force a temporary API outage in browser developer tools and check retry rather than editable defaults. Optional health-data editing and attachment workflows remain separate work.
7. Sign in as the existing admin and inspect real totals, specialty summary and operational status. Clinician record persistence is covered automatically; verify with an assigned synthetic patient if available.

## Recovery and remaining work

Revert the affected commit(s) on development, rerun CI and deploy the exact reverted SHA. For paired contracts revert the frontend before the API. No database rollback is required for these additive JSON changes; retain saved records and acknowledgement history. Browser draft cleanup is irreversible, so rollbacks cannot recover old unsaved browser drafts.

Known limits: bearer tokens remain browser-accessible; this is not a completed penetration test. Lost refresh responses after token rotation can still require a new login. Existing dependency/deprecation warnings need a separate upgrade cycle. Open old tabs must be reloaded.

Next phases retain booking/availability, document-upload integration, editable medical records, video consultation, consent withdrawal, real insurer eligibility, automated invoicing, complete German/English localisation, observability/alerting and AWS production migration. No claim of full clinical operation, approved legal text or insurance-funded launch is made by Phase 1.


## UI and validation extension — November 2026

Shared semantic colour tokens now cover patient, clinician, admin and public layouts, including legacy Tailwind surfaces. A single root theme provider applies the browser preference before paint and synchronises tabs. `qarevo.theme.v1` stores only light/dark; it survives logout and never contains health or identity data. Patient appearance settings use that same preference; delayed profile responses cannot reverse a new choice. Browser persistence is unavailable when storage is blocked. High contrast and font size retain their existing patient preferences.

Inter 4.1 is bundled with its OFL licence in `public/fonts`; builds and visitors no longer need Google Fonts. Source: https://github.com/rsms/inter/releases/tag/v4.1 . Loading follows Next.js local-font support: https://nextjs.org/docs/app/api-reference/components/font . Small labels use a 13px minimum, controls retain visible keyboard focus, mobile fields use 16px, reduced-motion preferences are respected, and native select controls inherit the current theme. Admin now has mobile navigation.

Onboarding Continue is available once data loads; invalid submissions expose a summary, inline messages and focus. Germany postcodes require five digits (including leading zero), telephone numbers require + and 7–15 digits after formatting is removed, and addresses require a street name and house number. Optional invalid contact fields are expanded on submission. Format checks do not verify a real address or subscriber. The server enforces the address requirement.

Clinician registration displays required labels and expected formats; clinician service editors reject fractional/truncated price or duration values. The existing service contract stores whole currency units; currency/decimal billing changes remain a coordinated contract change. Admin creation validates name, email and role inline and on the API. Emergency-contact settings use the same international-phone format as onboarding. These changes do not replace insurer eligibility or clinical validation.

Regression additions cover invalid-Continue feedback, physician registration, admin creation, mobile doctor/admin layouts, theme persistence after reload and a fresh browser session, and cross-tab appearance changes. The full service and clinical-integration audit is recorded in the private architecture repository; confidential infrastructure details do not belong here.

## Session and navigation increment — 2 November 2026

All human roles now use server-validated sessions with a 15-minute inactivity limit, a 2-minute warning and an 8-hour absolute limit. Only explicit foreground activity extends inactivity. Background reads and refresh-token rotation do not extend it. Expiry clears private browser state and returns to the appropriate role sign-in; authority outages hide private content with retry/sign-out controls. Logout revokes the entire session family, including after rotation, without revoking another device. CWS checks that same session authority for direct human calls. Old signed-in tabs must sign in again after deployment. Tokens remain browser-readable: a BFF/HttpOnly migration is a separate coordinated change, not an implied XSS fix.

Every authentication/onboarding route has the shared theme toggle. Desktop sidebars use `qarevo.sidebar.patient`, `.doctor` and `.admin`; these are appearance-only browser preferences, independent from account data. The patient brand sits at the top-right on desktop and mobile. Mobile navigation remains available when the desktop sidebar is collapsed. The shared corporate footer is mounted once, has keyboard-accessible browser preference controls, and links to the explicit unapproved Impressum/privacy/terms status. No legal details or social profile URLs are invented. Admin sign-in links to the existing password-reset flow; it does not bypass approval or change passwords.

Coverage fields use semantic surfaces, responsive spacing, visible format guidance and screen-reader-linked errors. Test acknowledgements remain synthetic-only and are not publication-approved consent. Dashboard portal composition uses one owner-scoped query for five page records; mobile chrome no longer requests the whole dashboard. Concurrent settings reads are coalesced per account/session and discarded on completion, with no completed-response cache.

Validation: unit/account-isolation tests, TypeScript, production build and targeted lint pass locally. Browser CI exercises each role's collapse/reload/route/theme/reset flow and coverage at 320/820/1440 pixels; the workflow retains only synthetic screenshots for three days. Verify its final result before deployment promotion. Live clinical, payment and legal acceptance gates remain documented in the architecture index.

Browser QA follow-up: inline layout styles were preventing desktop collapse and hiding too few mobile controls; the targeted CSS now overrides only those primary navigation elements. Coverage saves its account-owned tab draft on pagehide, so refreshing before the debounce does not lose the latest input. Administrator/clinician sign-in and recovery fields expose required labels and linked inline errors. Recovery no longer disables empty submissions silently, claims end-to-end encryption, or implies acceptance of draft legal text. The shared recovery links let users return to the correct role's sign-in without inferring their account type.
