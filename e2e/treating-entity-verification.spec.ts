import { test, expect, type BrowserContext, type Page } from '@playwright/test'

// Synthetic identities and documents only.
const PRACTICE = '11111111-1111-4111-8111-111111111111', INDEPENDENT = '22222222-2222-4222-8222-222222222222'
const OWNER = '33333333-3333-4333-8333-333333333333', CLINICIAN = '44444444-4444-4444-8444-444444444444', MEMBERSHIP = '55555555-5555-4555-8555-555555555555'
const CHALLENGE = '66666666-6666-4666-8666-666666666666', SUBMISSION = '77777777-7777-4777-8777-777777777777', REF = '88888888-8888-4888-8888-888888888888'
const SHA = 'a'.repeat(64)
const flags = { clinical_routing_enabled: false, billing_enabled: false, administrative_review_only: true }
const names = ['patient', 'doctor', 'admin', 'practice'] as const
type Portal = typeof names[number]

const practiceRules = {
  key: 'DE-PRACTICE-2026-11', jurisdiction: 'DE', entity_type: 'PRACTICE', effective_from: '2026-11-19', pending_input: 'PENDING-INPUT(13)', notes: [],
  entity_fields: [
    { key: 'legal_name', label: 'Legal name of the treating entity', required: true, group: null, choices: [], max_length: 200, hint: '', pattern: null },
    { key: 'bsnr', label: 'Betriebsstättennummer (BSNR)', required: true, group: null, choices: [], max_length: 160, hint: 'use the 9 digits.', pattern: '[0-9]{9}' },
    { key: 'kv_region', label: 'Kassenärztliche Vereinigung', required: true, group: null, choices: ['Berlin', 'Bayern'], max_length: 160, hint: '', pattern: null },
  ],
  clinician_fields: [{ key: 'lanr', label: 'Lebenslange Arztnummer (LANR)', required: true, group: null, choices: [], max_length: 160, hint: 'use the 9 digits.', pattern: '[0-9]{9}' }],
  documents: [
    { key: 'LIABILITY_INSURANCE', label: 'Certificate of professional liability insurance', per_clinician: false, required: true, required_with: null },
    { key: 'APPROBATION', label: 'Approbation certificate', per_clinician: true, required: true, required_with: null },
  ],
}
const independentRules = {
  ...practiceRules, key: 'DE-INDEPENDENT-2026-11', entity_type: 'INDEPENDENT', pending_input: 'PENDING-INPUT(16)', clinician_fields: [],
  entity_fields: [
    practiceRules.entity_fields[0],
    { key: 'lanr', label: 'Lebenslange Arztnummer (LANR)', required: false, group: 'statutory', choices: [], max_length: 160, hint: 'use the 9 digits.', pattern: '[0-9]{9}' },
    { key: 'bsnr', label: 'Betriebsstättennummer (BSNR)', required: false, group: 'statutory', choices: [], max_length: 160, hint: 'use the 9 digits.', pattern: '[0-9]{9}' },
  ],
  documents: [
    { key: 'APPROBATION', label: 'Approbation certificate', per_clinician: false, required: true, required_with: null },
    { key: 'KV_APPROVAL', label: 'KV approval (Zulassung or Ermächtigung)', per_clinician: false, required: false, required_with: 'statutory' },
  ],
}
const kinds = ['PLATFORM_AGREEMENT', 'DATA_PROCESSING_AGREEMENT'] as const

type Evidence = { id: string; requirement_key: string; subject_user_id: string | null; original_filename: string; content_type: string; size_bytes: number; sha256: string; created_at: string; removed_at: null }
type Entity = { id: string; type: 'PRACTICE' | 'INDEPENDENT'; status: string; version: number; accepted: Set<string>; evidence: Evidence[]; submission: Record<string, unknown> | null; verified: boolean }

async function prepare(context: BrowserContext, options: { practiceSession?: boolean; independentExists?: boolean } = {}) {
  const identities = Object.fromEntries(names.map((portal, i) => [portal, { user_id: portal === 'doctor' ? CLINICIAN : OWNER, role: { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN', practice: 'PRACTICE' }[portal], session_id: `${i + 1}9999999-9999-4999-8999-999999999999`, ...(portal === 'doctor' ? { provider_id: CLINICIAN } : {}) }])) as Record<Portal, { user_id: string; role: string; session_id: string }>
  await context.addInitScript(({ identities, practiceSession }) => {
    for (const portal of ['patient', 'doctor', 'admin', 'practice'] as const) {
      if (portal === 'practice' && !practiceSession) continue
      const marker = 'qarevo:test:verification-seeded:' + portal
      if (!sessionStorage.getItem(marker)) { localStorage.setItem(`qarevo:${portal}:identity`, JSON.stringify(identities[portal])); sessionStorage.setItem(marker, 'true') }
    }
  }, { identities, practiceSession: options.practiceSession ?? true })
  const entities: Record<string, Entity> = {
    [PRACTICE]: { id: PRACTICE, type: 'PRACTICE', status: 'DRAFT', version: 1, accepted: new Set(), evidence: [], submission: null, verified: false },
  }
  if (options.independentExists) entities[INDEPENDENT] = { id: INDEPENDENT, type: 'INDEPENDENT', status: 'DRAFT', version: 1, accepted: new Set(), evidence: [], submission: null, verified: false }
  const state = { entities, writes: [] as { path: string; body: unknown; ifMatch?: string }[], adminDecisions: 0, fourEyes: false }
  const timing = (portal: Portal) => ({ ...identities[portal], browser_session: identities[portal], server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 900000).toISOString(), absolute_expires_at: new Date(Date.now() + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 })
  const practiceView = (entity: Entity) => ({
    id: entity.id, name: entity.type === 'PRACTICE' ? 'Synthetic Praxis Mitte' : 'Synthetic Independent', status: entity.status, version: entity.version,
    contact_email: null, phone: null, address_line1: null, address_line2: null, city: 'Berlin', postcode: '10115', country: 'DE', ...flags,
    entity: { entity_type: entity.type, jurisdiction: 'DE', currency: 'EUR', time_zone: 'Europe/Berlin', locale: 'de-DE', verification_status: entity.verified ? 'VERIFIED' : 'UNVERIFIED', verified_at: entity.verified ? '2026-11-19T10:00:00Z' : null, public_insurance_eligible: entity.verified && entity.type === 'PRACTICE' },
    bookable: entity.verified,
  })
  const overview = (entity: Entity) => ({
    practice: practiceView(entity), requirements: entity.type === 'PRACTICE' ? practiceRules : independentRules,
    clinicians: [{ user_id: CLINICIAN, membership_id: MEMBERSHIP, full_name: 'Synthetic Clinician', email: 'clinician@example.invalid' }],
    evidence: entity.evidence, legal: kinds.map(kind => ({ kind, version: '2026-11-19-draft', review_status: 'DRAFT_NOT_LEGALLY_REVIEWED', accepted: entity.accepted.has(kind), accepted_at: entity.accepted.has(kind) ? '2026-11-19T09:00:00Z' : null, accepted_locale: entity.accepted.has(kind) ? 'de' : null, sha256: entity.accepted.has(kind) ? SHA : null })),
    latest_submission: entity.submission, missing_documents: [], can_submit: entity.accepted.size === 2,
  })
  const submission = (entity: Entity, status: string, version: number) => ({
    id: SUBMISSION, practice_id: entity.id, entity_type: entity.type, jurisdiction: 'DE', requirement_set: entity.type === 'PRACTICE' ? practiceRules.key : independentRules.key,
    status, version, public_insurance_eligible: entity.type === 'PRACTICE', submitted_at: '2026-11-19T09:30:00Z', first_approved_at: status === 'SUBMITTED' ? null : '2026-11-19T09:40:00Z',
    second_approved_at: status === 'APPROVED' ? '2026-11-19T09:50:00Z' : null, rejected_at: null, rejection_reason: null, declaration_sha256: SHA,
  })
  const detail = (entity: Entity) => ({
    submission: { ...(entity.submission as object), declaration: { requirement_set: practiceRules.key, entity_fields: { legal_name: 'Synthetic Praxis Mitte GmbH', bsnr: '721234500', kv_region: 'Berlin' },
      clinicians: [{ user_id: CLINICIAN, membership_id: MEMBERSHIP, full_name: 'Synthetic Clinician', fields: { lanr: '123456701' } }],
      evidence: entity.evidence.map(item => ({ id: item.id, requirement_key: item.requirement_key, sha256: item.sha256, subject_user_id: item.subject_user_id })),
      legal: kinds.map(kind => ({ kind, version: '2026-11-19-draft', sha256: SHA, accepted_locale: 'de', accepted_at: '2026-11-19T09:00:00Z' })) },
      submitted_by_user_id: OWNER, first_approved_by_user_id: null, second_approved_by_user_id: null, rejected_by_user_id: null, first_approval_reason: null, second_approval_reason: null },
    practice: practiceView(entity), evidence: entity.evidence, clinician_approval: { [CLINICIAN]: true }, requirements: practiceRules,
  })
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method(), portal = (request.headers()['x-qarevo-portal'] || 'patient') as Portal
    expect(request.headers()['authorization']).toBeUndefined()
    const respond = (body: unknown, status = 200) => route.fulfill({ status, headers: { 'X-Request-ID': REF }, json: body })
    if (path.endsWith('/browser-csrf')) return respond({ csrf_token: 'synthetic-verification-csrf' })
    if (path === '/api/v1/practice/capabilities') return respond({ enabled: true, ...flags })
    if (path.startsWith('/api/v1/session') || path.startsWith('/api/v1/practice/session')) return respond(timing(portal))
    if (path === '/api/v1/auth/social/providers') return respond({ google: { enabled: false }, apple: { enabled: false } })
    if (path === '/api/v1/auth/practice/register') { state.writes.push({ path, body: request.postDataJSON() }); return respond({ challenge_id: CHALLENGE, expires_in: 300, resend_after: 60, message: 'Check your inbox.' }, 202) }
    if (path === '/api/v1/auth/practice/verify') { const body = request.postDataJSON(); state.writes.push({ path, body }); return body.code === '123456' ? respond({ role: 'PRACTICE', user_id: OWNER, session_id: identities.practice.session_id, browser_session: identities.practice }) : respond({ detail: 'Invalid or expired code.' }, 401) }
    if (path === '/api/v1/practice/workspace') return respond({ practices: [{ practice: practiceView(entities[PRACTICE]), membership: { id: MEMBERSHIP, practice_id: PRACTICE, user_id: OWNER, role: 'OWNER', status: 'ACTIVE', version: 1, can_revoke: false } }] })
    const legal = path.match(/^\/api\/v1\/legal\/documents\/([A-Z_]+)$/)
    if (legal) return respond({ kind: legal[1], version: '2026-11-19-draft', locale: 'de', effective_from: '2026-11-19', review_status: 'DRAFT_NOT_LEGALLY_REVIEWED', title: 'Synthetic agreement', body: '# Synthetic agreement\n\nDRAFT – NOT LEGALLY REVIEWED. Synthetic placeholder text.', sha256: SHA })
    if (path === '/api/v1/doctor/independent-practice') {
      if (method === 'POST') { const body = request.postDataJSON(); state.writes.push({ path, body }); entities[INDEPENDENT] = { id: INDEPENDENT, type: 'INDEPENDENT', status: 'DRAFT', version: 1, accepted: new Set(), evidence: [], submission: null, verified: false }; return respond({ practice: practiceView(entities[INDEPENDENT]) }, 201) }
      return respond({ practice: entities[INDEPENDENT] ? practiceView(entities[INDEPENDENT]) : null })
    }
    const scoped = path.match(/^\/api\/v1\/(?:practice\/practices|doctor\/independent-practice)\/([^/]+)\/(.+)$/)
    if (scoped && entities[scoped[1]]) {
      const entity = entities[scoped[1]], suffix = scoped[2]
      if (suffix === 'verification') return respond(overview(entity))
      if (suffix === 'legal/acceptances') { const body = request.postDataJSON(); state.writes.push({ path, body }); expect(body.sha256).toBe(SHA); entity.accepted.add(body.kind); return respond({ legal: overview(entity).legal }) }
      if (suffix === 'verification/evidence') {
        const raw = request.postData() || '', key = raw.match(/name="requirement_key"\r\n\r\n([A-Z_]+)/)?.[1] ?? '', subject = raw.match(/name="subject_user_id"\r\n\r\n([0-9a-f-]{36})/)?.[1] ?? null
        const item: Evidence = { id: crypto.randomUUID(), requirement_key: key, subject_user_id: entity.type === 'INDEPENDENT' ? CLINICIAN : subject, original_filename: 'synthetic-certificate.pdf', content_type: 'application/pdf', size_bytes: 2048, sha256: SHA, created_at: '2026-11-19T09:10:00Z', removed_at: null }
        state.writes.push({ path, body: { key, subject } }); entity.evidence.push(item); return respond({ evidence: item }, 201)
      }
      if (suffix === 'verification/submissions') { const body = request.postDataJSON(); state.writes.push({ path, body }); entity.status = 'SUBMITTED'; entity.submission = submission(entity, 'SUBMITTED', 1); return respond({ submission: entity.submission }, 201) }
    }
    if (path === '/api/v1/admin/verifications') return respond({ submissions: Object.values(entities).filter(e => e.submission).map(e => ({ ...(e.submission as object), practice_name: practiceView(e).name, practice_status: e.status })), total: Object.values(entities).filter(e => e.submission).length, limit: 25, offset: 0, has_next: false })
    const admin = path.match(/^\/api\/v1\/admin\/verifications\/([^/]+)(?:\/(approve|reject))?$/)
    if (admin) {
      const entity = Object.values(entities).find(e => e.submission?.id === admin[1])
      if (!entity) return respond({ detail: 'Not found' }, 404)
      if (method === 'GET') return respond(detail(entity))
      const ifMatch = request.headers()['if-match'], body = request.postDataJSON(); state.writes.push({ path, body, ifMatch })
      if (ifMatch !== `"${(entity.submission as { version: number }).version}"`) return respond({ detail: { error_code: 'VERIFICATION_CHANGED', message: 'This submission changed.' } }, 412)
      if (state.fourEyes) return respond({ detail: { error_code: 'VERIFICATION_FOUR_EYES', message: 'A second, different administrator must give the final approval.' } }, 403)
      const current = entity.submission as { status: string; version: number }
      const next = admin[2] === 'reject' ? 'REJECTED' : current.status === 'SUBMITTED' ? 'FIRST_APPROVED' : 'APPROVED'
      entity.submission = submission(entity, next, current.version + 1); if (next === 'APPROVED') entity.verified = true
      return respond(detail(entity))
    }
    return respond({ detail: 'No synthetic fixture.' }, 404)
  })
  return state
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

const pdf = { name: 'synthetic-certificate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic') }

test('a practice owner registers, confirms the mailbox and lands on verification', async ({ page, context }) => {
  const state = await prepare(context, { practiceSession: false })
  await page.goto('/auth/practice/register')
  await page.getByRole('button', { name: 'Create practice account' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Please check the following' })).toContainText('Enter your first name.')
  await expect(page.getByLabel('First name (Required)')).toBeFocused()
  await page.getByLabel('First name (Required)').fill('Synthetic')
  await page.getByLabel('Last name (Required)').fill('Owner')
  await page.getByLabel('Practice name (Required)').fill('Synthetic Praxis Mitte')
  await page.getByLabel('Work email (Required)').fill('owner@example.invalid')
  await page.getByLabel('Password (Required)', { exact: true }).fill('weak')
  await page.getByRole('button', { name: 'Create practice account' }).click()
  await expect(page.getByText('Use 8–128 characters with an uppercase letter').first()).toBeVisible()
  await page.getByLabel('Password (Required)', { exact: true }).fill('Synthetic-Owner2026!')
  await page.getByRole('button', { name: 'Create practice account' }).click()
  await expect(page.getByLabel('Verification code (Required)')).toBeVisible()
  await page.getByLabel('Verification code (Required)').fill('123456')
  await page.getByRole('button', { name: 'Confirm email and continue' }).click()
  await expect(page).toHaveURL(/\/practice\/verification$/)
  await expect(page.getByRole('heading', { name: 'Verification of practice' })).toBeVisible()
  const registration = state.writes.find(item => item.path.endsWith('/register'))?.body as Record<string, string>
  expect(registration).toMatchObject({ email: 'owner@example.invalid', practice_name: 'Synthetic Praxis Mitte', country: 'DE' })
})

test('the owner accepts agreements, enters details, uploads evidence and submits', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/practice/verification')
  await expect(page.getByText('Not yet submitted')).toBeVisible()
  await page.getByRole('button', { name: 'Submit for verification' }).click()
  const summary = page.getByRole('alert').filter({ hasText: 'Please check the following' })
  await expect(summary).toContainText('Enter the Legal name of the treating entity.')
  await expect(summary).toContainText('Accept the platform agreement.')
  for (const label of ['Platform agreement', 'Data processing agreement (AVV)']) {
    await page.getByRole('button', { name: `Read ${label.toLowerCase()}` }).click()
    await expect(page.getByRole('region', { name: label })).toContainText('DRAFT – NOT LEGALLY REVIEWED')
    await page.getByRole('button', { name: `Accept ${label.toLowerCase()}` }).click()
    await expect(page.getByText('Confirm that you have read the agreement.')).toBeVisible()
    await page.getByLabel(`I have read the ${label.toLowerCase()} and accept it on behalf of the treating entity.`).check()
    await page.getByRole('button', { name: `Accept ${label.toLowerCase()}` }).click()
  }
  await expect(page.getByText(/^Accepted/)).toHaveCount(2)
  await page.getByLabel('Legal name of the treating entity (Required)').fill('Synthetic Praxis Mitte GmbH')
  await page.getByLabel('Betriebsstättennummer (BSNR) (Required)').fill('12')
  await page.getByLabel('Kassenärztliche Vereinigung (Required)').selectOption('Berlin')
  await page.getByLabel('Lebenslange Arztnummer (LANR) (Required)').fill('123456701')
  await page.getByRole('button', { name: 'Submit for verification' }).click()
  await expect(summary).toContainText('Betriebsstättennummer (BSNR): use the 9 digits.')
  await page.getByLabel('Betriebsstättennummer (BSNR) (Required)').fill('721234500')
  const insurance = page.getByRole('listitem').filter({ hasText: 'Certificate of professional liability insurance' })
  await insurance.getByLabel('Choose file').setInputFiles({ ...pdf, mimeType: 'text/html', name: 'page.html' })
  await insurance.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(insurance.getByText('Upload a PDF, JPEG or PNG file.')).toBeVisible()
  await insurance.getByLabel('Choose file').setInputFiles(pdf)
  await insurance.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(insurance.getByText('Uploaded', { exact: true })).toBeVisible()
  const approbation = page.getByRole('listitem').filter({ hasText: 'Approbation certificate — Synthetic Clinician' })
  await approbation.getByLabel('Choose file').setInputFiles(pdf)
  await approbation.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(approbation.getByText('Uploaded', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Submit for verification' }).click()
  await expect(page.getByText('Waiting for the first review')).toBeVisible()
  await expect(page.getByText(/You can’t change it while it is under review/)).toBeVisible()
  const submitted = state.writes.find(item => item.path.endsWith('/verification/submissions'))?.body as Record<string, Record<string, unknown>>
  expect(submitted.entity_fields).toMatchObject({ legal_name: 'Synthetic Praxis Mitte GmbH', bsnr: '721234500', kv_region: 'Berlin' })
  expect(submitted.clinician_fields[CLINICIAN]).toEqual({ lanr: '123456701' })
  expect(state.writes.filter(item => item.path.endsWith('/verification/evidence')).map(item => item.body)).toEqual([
    { key: 'LIABILITY_INSURANCE', subject: null }, { key: 'APPROBATION', subject: CLINICIAN }])
})

test('an independent practitioner creates the entity and needs KV approval only with statutory details', async ({ page, context }) => {
  const state = await prepare(context)
  await page.goto('/doctor/independent-practice')
  await expect(page.getByRole('heading', { name: 'Set up your independent practice' })).toBeVisible()
  await page.getByRole('button', { name: 'Create independent practice' }).click()
  await expect(page.getByText('Confirm that you will act as the treating party.').first()).toBeVisible()
  await page.getByLabel(/I will act as the treating party/).check()
  await page.getByRole('button', { name: 'Create independent practice' }).click()
  await expect(page.getByRole('heading', { name: 'Verification of independent practice' })).toBeVisible()
  expect((state.writes.find(item => item.path === '/api/v1/doctor/independent-practice')?.body as Record<string, string>).country).toBe('DE')
  await expect(page.getByText('KV approval (Zulassung or Ermächtigung)')).toHaveCount(0)
  await page.getByLabel('Lebenslange Arztnummer (LANR) (Optional)').fill('123456701')
  await expect(page.getByText('KV approval (Zulassung or Ermächtigung)')).toBeVisible()
  await page.getByRole('button', { name: 'Submit for verification' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Please check the following' })).toContainText('Provide all statutory-insurance details together')
})

test('admins review one queue and the decision carries the submission version', async ({ page, context }) => {
  const state = await prepare(context, { independentExists: true })
  state.entities[PRACTICE].evidence.push({ id: crypto.randomUUID(), requirement_key: 'LIABILITY_INSURANCE', subject_user_id: null, original_filename: 'synthetic-certificate.pdf', content_type: 'application/pdf', size_bytes: 2048, sha256: SHA, created_at: '2026-11-19T09:10:00Z', removed_at: null })
  state.entities[PRACTICE].submission = { id: SUBMISSION, practice_id: PRACTICE, entity_type: 'PRACTICE', jurisdiction: 'DE', requirement_set: practiceRules.key, status: 'SUBMITTED', version: 1, public_insurance_eligible: true, submitted_at: '2026-11-19T09:30:00Z', first_approved_at: null, second_approved_at: null, rejected_at: null, rejection_reason: null, declaration_sha256: SHA }
  await page.goto('/admin/verifications')
  await expect(page.getByRole('heading', { name: 'Verifications', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Synthetic Praxis Mitte' }).click()
  await expect(page.getByRole('heading', { name: 'Synthetic Praxis Mitte' })).toBeVisible()
  await expect(page.getByText('721234500')).toBeVisible()
  await expect(page.getByText('Clinician account: approved')).toBeVisible()
  const approve = page.locator('form').filter({ hasText: 'Approve (first of two)' })
  await approve.getByRole('button', { name: 'Approve (first of two)' }).click()
  await expect(approve.getByText('Enter a reason using 4–500 characters.').first()).toBeVisible()
  await approve.getByLabel('What you checked (Required)').fill('Synthetic: BSNR and insurance match the documents')
  await approve.getByLabel('I checked every document against the declared details.').check()
  await approve.getByRole('button', { name: 'Approve (first of two)' }).click()
  await expect(page.getByRole('heading', { name: 'Final review' })).toBeVisible()
  expect(state.writes.at(-1)?.ifMatch).toBe('"1"')
  state.fourEyes = true
  const final = page.locator('form').filter({ hasText: 'Approve and verify' })
  await final.getByLabel('What you checked (Required)').fill('Synthetic: same administrator tries again')
  await final.getByLabel('I checked every document against the declared details.').check()
  await final.getByRole('button', { name: 'Approve and verify' }).click()
  await expect(final.getByText('A second, different administrator must give the final approval.')).toBeVisible()
})

test('verification reads in German, with German legal names and validation', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'qarevo_locale', value: 'de', url: baseURL! }])
  const state = await prepare(context, { independentExists: true })
  await page.goto('/practice/verification')
  await expect(page.getByText('Noch nicht eingereicht')).toBeVisible()
  await page.getByRole('button', { name: 'Zur Verifizierung einreichen' }).click()
  const summary = page.getByRole('alert').filter({ hasText: 'Bitte prüfen Sie Folgendes' })
  await expect(summary).toBeVisible()
  await expect(summary).toContainText('Plattformvereinbarung')
  await page.getByRole('button', { name: '„Plattformvereinbarung“ lesen' }).click()
  await expect(page.getByRole('region', { name: 'Plattformvereinbarung' })).toBeVisible()
  // German regulatory names come from the API and stay as sent.
  await expect(page.getByLabel('Betriebsstättennummer (BSNR) (Pflichtfeld)')).toBeVisible()
  state.entities[PRACTICE].submission = { id: SUBMISSION, practice_id: PRACTICE, entity_type: 'PRACTICE', jurisdiction: 'DE', requirement_set: practiceRules.key, status: 'SUBMITTED', version: 1, public_insurance_eligible: true, submitted_at: '2026-11-19T09:30:00Z', first_approved_at: null, second_approved_at: null, rejected_at: null, rejection_reason: null, declaration_sha256: SHA }
  await page.goto('/admin/verifications')
  await expect(page.getByRole('heading', { name: 'Verifizierungen', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Alle Arten' })).toBeAttached()
  await expect(page.getByText(/Approve|Submitted|Waiting for/)).toHaveCount(0)
})

for (const width of [320, 1440]) for (const scheme of ['light', 'dark'] as const) {
  test(`verification screens fit ${width}px in ${scheme} mode`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: scheme })
    const state = await prepare(context, { independentExists: true })
    state.entities[PRACTICE].submission = { id: SUBMISSION, practice_id: PRACTICE, entity_type: 'PRACTICE', jurisdiction: 'DE', requirement_set: practiceRules.key, status: 'SUBMITTED', version: 1, public_insurance_eligible: true, submitted_at: '2026-11-19T09:30:00Z', first_approved_at: null, second_approved_at: null, rejected_at: null, rejection_reason: null, declaration_sha256: SHA }
    state.entities[INDEPENDENT].accepted.add('PLATFORM_AGREEMENT')
    for (const [path, heading] of [['/auth/practice/register', 'Register your practice'], ['/practice/verification', 'Verification of practice'], ['/doctor/independent-practice', 'Verification of independent practice'], ['/admin/verifications', 'Verifications'], [`/admin/verifications/${SUBMISSION}`, 'Synthetic Praxis Mitte']] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
      await noHorizontalOverflow(page)
    }
  })
}
