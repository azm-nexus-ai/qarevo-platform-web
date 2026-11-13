import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { expectEnabledControlContrast } from './helpers/contrast'

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', OWNER = '33333333-3333-4333-8333-333333333333', CLINICIAN = '44444444-4444-4444-8444-444444444444'
const SESSION = '55555555-5555-4555-8555-555555555555', CHALLENGE = '66666666-6666-4666-8666-666666666666', REF = '77777777-7777-4777-8777-777777777777'
const OWNER_TOKEN = 'synthetic_owner_invitation_'.repeat(3), CLINICIAN_TOKEN = 'synthetic_clinician_invitation_'.repeat(3)
const flags = { clinical_routing_enabled: false, billing_enabled: false, administrative_review_only: true }
const profile = (id = A, name = 'Synthetic Practice') => ({ id, name, status: 'DRAFT', version: 1, contact_email: null as string | null, phone: null as string | null, address_line1: null as string | null, address_line2: null as string | null, city: null as string | null, postcode: null as string | null, country: 'DE', ...flags })
const membership = (practiceId = A, clinician = false) => ({ id: clinician ? CLINICIAN : OWNER, practice_id: practiceId, user_id: clinician ? CLINICIAN : OWNER, role: clinician ? 'CLINICIAN' : 'OWNER', status: 'ACTIVE', version: 1, can_revoke: clinician, full_name: clinician ? 'Synthetic Clinician' : 'Synthetic Owner', email: clinician ? 'clinician@example.invalid' : 'owner@example.invalid' })
type Invite = { id: string; practice_id: string; email: string; role: string; status: string; version: number; expires_at: string; delivery_status: string }
const names = ['patient', 'doctor', 'admin', 'practice'] as const
type Portal = typeof names[number]
async function prepare(context: BrowserContext, page: Page, options: { practiceSession?: boolean; enabled?: boolean; empty?: boolean } = {}) {
  const identities = Object.fromEntries(names.map((portal, i) => [portal, { user_id: portal === 'doctor' ? CLINICIAN : OWNER, role: { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN', practice: 'PRACTICE' }[portal], session_id: `${i + 5}5555555-5555-4555-8555-555555555555`, ...(portal === 'doctor' ? { provider_id: CLINICIAN } : {}) }])) as Record<Portal, { user_id: string; role: string; session_id: string; provider_id?: string }>
  await context.addInitScript(({ identities, practiceSession }) => { for (const portal of ['patient', 'doctor', 'admin', 'practice'] as const) { if (portal === 'practice' && !practiceSession) continue; const marker = 'qarevo:test:practice-seeded:' + portal; if (!sessionStorage.getItem(marker)) { localStorage.setItem(`qarevo:${portal}:identity`, JSON.stringify(identities[portal])); sessionStorage.setItem(marker, 'true') } } }, { identities, practiceSession: options.practiceSession ?? false })
  const state = { identities, enabled: options.enabled ?? true, stored: !options.empty, practice: profile(), ownerMember: membership(), clinicianMember: membership(A, true), joined: false, canManage: true, foreignDetail: false, foreignMembers: false, firstCreateFailure: false,
    ownerInvites: [] as Invite[], clinicianInvites: [] as Invite[], writes: [] as { path: string; body: Record<string, unknown>; version: string | undefined; portal: string | undefined }[], requests: [] as string[], holdInvite: false, inviteStarted: false, releaseInvite: () => {}, inviteDelivered: Promise.resolve(), invalidInspection: false }
  const timing = (portal: Portal) => ({ ...state.identities[portal], browser_session: state.identities[portal], server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 900000).toISOString(), absolute_expires_at: new Date(Date.now() + 28800000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 })
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method(), portal = (request.headers()['x-qarevo-portal'] || 'patient') as Portal
    expect(request.headers()['authorization']).toBeUndefined(); state.requests.push(path)
    const respond = (body: unknown, status = 200) => route.fulfill({ status, headers: { 'X-Request-ID': REF }, json: body })
    if (path.endsWith('/browser-csrf')) return respond({ csrf_token: 'synthetic-practice-csrf' })
    if (path === '/api/v1/practice/capabilities') return respond({ enabled: state.enabled, ...flags })
    if (path.startsWith('/api/v1/session') || path.startsWith('/api/v1/practice/session')) return respond(timing(portal))
    if (path === '/api/v1/auth/social/providers') return respond({ google: { enabled: false }, apple: { enabled: false } })
    if (path === '/api/v1/auth/logout') return respond({ message: 'Practice session signed out.' })
    if (path === '/api/v1/auth/practice/login' || path === '/api/v1/auth/practice/resend') return respond({ challenge_id: CHALLENGE, expires_in: 300, resend_after: 60, message: 'If eligible, a code has been requested.' }, 202)
    if (path === '/api/v1/auth/practice/verify') { const body = request.postDataJSON(); state.writes.push({ path, body, portal, version: undefined }); if (body.code !== '123456') return respond({ detail: 'The verification code is invalid or expired.' }, 400); return respond({ role: 'PRACTICE', user_id: OWNER, session_id: state.identities.practice.session_id, browser_session: state.identities.practice }) }
    if (path === '/api/v1/auth/practice/invitations/inspect') { const body = request.postDataJSON(); if (state.invalidInspection) return respond({ detail: 'This invitation is invalid or expired.' }, 400); return respond({ practice_name: state.practice.name, role: body.token === CLINICIAN_TOKEN ? 'CLINICIAN' : 'OWNER', email_hint: body.token === CLINICIAN_TOKEN ? 'c***@example.invalid' : 'o***@example.invalid', existing_account: true, expires_at: '2035-01-01T10:00:00Z' }) }
    if (path === '/api/v1/auth/practice/invitations/accept-owner') { const body = request.postDataJSON(); state.writes.push({ path, body, portal, version: undefined }); return respond({ practice: state.practice, membership: state.ownerMember, role: 'PRACTICE', user_id: OWNER, session_id: state.identities.practice.session_id, browser_session: state.identities.practice }) }
    if (path === '/api/v1/doctor/practices/invitations/accept') { const body = request.postDataJSON(); state.writes.push({ path, body, portal, version: undefined }); state.joined = true; return respond({ practice: state.practice, membership: state.clinicianMember }) }
    if (path === '/api/v1/practice/workspace') return respond({ practices: [{ practice: state.practice, membership: state.ownerMember }] })
    if (path === '/api/v1/doctor/practices') return respond({ practices: state.joined ? [{ practice: state.practice, membership: state.clinicianMember }] : [] })
    if (path === '/api/v1/practice/security') return respond({ password_change_available: true, mfa: { available: true, enabled: true, method: 'email' }, sessions: [{ id: SESSION, current: true, device_name: 'Practice browser session', created_at: '2026-11-13T10:00:00Z', last_seen_at: new Date().toISOString(), expires_at: '2035-01-01T10:00:00Z' }], sessions_total: 1, has_more: false })
    if (path.startsWith('/api/v1/practice/security/')) { state.writes.push({ path, body: method === 'DELETE' ? {} : request.postDataJSON(), portal, version: undefined }); return respond({ message: 'Account security updated.', current_session_revoked: true }) }
    const pageBody = (key: string, rows: unknown[]) => { const limit = Number(url.searchParams.get('limit') || 25), requested = Number(url.searchParams.get('offset') || 0), offset = requested >= rows.length ? Math.max(0, Math.floor((rows.length - 1) / limit) * limit) : requested; return { [key]: rows.slice(offset, offset + limit), total: rows.length, limit, offset, has_next: offset + limit < rows.length, has_previous: offset > 0, can_manage: state.canManage } }
    if (path === '/api/v1/admin/practices' && method === 'GET') return respond(pageBody('practices', state.stored ? [state.practice] : []))
    if (path === '/api/v1/admin/practices' && method === 'POST') { const body = request.postDataJSON(); state.writes.push({ path, body, portal, version: request.headers()['if-match'] }); state.stored = true; state.practice = { ...state.practice, ...body }; if (state.firstCreateFailure) { state.firstCreateFailure = false; return respond({ detail: 'The saved practice could not be confirmed. Retry with the same creation request.' }, 503) }; return respond({ practice: state.practice }, 201) }
    const match = path.match(/^\/api\/v1\/(admin|practice)\/practices\/([^/]+)(.*)$/)
    if (match) {
      const admin = match[1] === 'admin', suffix = match[3], invitationRows = admin ? state.ownerInvites : state.clinicianInvites
      if (method === 'GET') { if (suffix === '/members') return respond(pageBody('members', [state.ownerMember, { ...state.clinicianMember, ...(state.foreignMembers ? { practice_id: B, email: 'foreign-secret@example.invalid' } : {}) }])); if (suffix === '/invitations') return respond(pageBody('invitations', invitationRows)); return respond({ practice: state.foreignDetail ? profile(B, 'Foreign Practice Secret') : state.practice, ...(admin ? {} : { membership: state.ownerMember }), can_manage: state.canManage }) }
      const body = request.postDataJSON() || {}, version = request.headers()['if-match']; state.writes.push({ path, body, portal, version })
      if (suffix === '/invitations') {
        const row: Invite = { id: crypto.randomUUID(), practice_id: A, email: body.email, role: admin ? 'OWNER' : 'CLINICIAN', status: 'PENDING', version: 1, expires_at: '2035-01-01T10:00:00Z', delivery_status: 'accepted' }; invitationRows.unshift(row)
        let delivered: (() => void) | undefined
        if (state.holdInvite) { state.holdInvite = false; state.inviteStarted = true; state.inviteDelivered = new Promise<void>(resolve => { delivered = resolve }); await new Promise<void>(resolve => { state.releaseInvite = resolve }) }
        try { return await respond({ invitation: row, delivery: { status: 'accepted', message: 'Accepted by provider; inbox not confirmed.' } }, 201) } finally { delivered?.() }
      }
      const invitationMatch = suffix.match(/^\/invitations\/([^/]+)\/(resend|revoke)$/)
      if (invitationMatch) { const row = invitationRows.find(item => item.id === invitationMatch[1]); if (!row) return respond({ detail: 'Invitation unavailable.' }, 404); if (version !== `"${row.version}"`) return respond({ detail: 'This record changed. Refresh before retrying.' }, 412); row.status = 'REVOKED'; row.version++; if (invitationMatch[2] === 'revoke') return respond({ invitation: row }); const replacement = { ...row, id: crypto.randomUUID(), status: 'PENDING', version: 1 }; invitationRows.unshift(replacement); return respond({ invitation: replacement, delivery: { status: 'accepted' } }) }
      if (suffix.startsWith('/members/')) { state.clinicianMember.status = 'REVOKED'; state.clinicianMember.version++; return respond({ membership: state.clinicianMember }) }
      if (version !== `"${state.practice.version}"`) return respond({ detail: { error_code: 'PRACTICE_RECORD_CHANGED', message: 'This record changed. Reload and review its saved details before retrying.' } }, 412)
      if (method === 'PATCH') state.practice = { ...state.practice, ...body }
      if (suffix === '/submit') state.practice.status = 'SUBMITTED'
      if (suffix === '/review') state.practice.status = 'REVIEWED'
      if (suffix === '/suspend') state.practice.status = 'SUSPENDED'
      if (suffix === '/reopen') state.practice.status = 'DRAFT'
      state.practice.version++; return respond({ practice: state.practice, membership: state.ownerMember, can_manage: state.canManage })
    }
    return respond({ detail: 'No synthetic fixture.' }, 404)
  })
  return state
}
async function openOwner(page: Page, context: BrowserContext) { const state = await prepare(context, page, { practiceSession: true }); await page.goto('/practice/dashboard'); await expect(page.getByRole('heading', { name: 'Practice workspace', exact: true })).toBeVisible(); await expect(page.getByRole('heading', { name: 'Practice team', exact: true })).toBeVisible(); return state }
async function decision(page: Page, label: string) { await page.getByRole('button', { name: label, exact: true }).click(); const form = page.getByRole('heading', { name: label, exact: true }).locator('..'); await form.getByLabel('Administrative reason (Required)').fill('Synthetic administrative reference 2026'); await form.getByRole('checkbox').check(); await form.getByRole('button', { name: 'Confirm ' + label.toLowerCase(), exact: true }).click() }

test('disabled practice capability is truthful and prevents onboarding mutations', async ({ page, context }) => {
  const state = await prepare(context, page, { enabled: false }); await page.goto('/auth/practice/login')
  await expect(page.getByRole('heading', { name: 'Practice workspaces are not enabled' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Continue securely' })).toHaveCount(0)
  await page.goto('/admin/practices'); await expect(page.getByRole('heading', { name: 'Practice workspaces are not enabled' })).toBeVisible(); expect(state.writes).toHaveLength(0); expect(state.requests.some(path => path === '/api/v1/admin/practices')).toBe(false)
})

test('mailbox OTP establishes a separate practice purpose without changing administrator identity', async ({ page, context }) => {
  const state = await prepare(context, page); await page.goto('/auth/practice/login'); await page.getByLabel('Email (Required)').fill('owner@example.invalid'); await page.getByLabel('Password (Required)', { exact: true }).fill('Synthetic-Password2026!'); await page.getByRole('button', { name: 'Continue securely' }).click()
  await expect(page.getByLabel('Verification code (Required)')).toBeVisible(); await expect(page.getByRole('button', { name: /Resend available in/ })).toBeDisabled()
  await page.getByLabel('Verification code (Required)').fill('123456'); await page.getByRole('button', { name: 'Verify and open practice workspace' }).click()
  await expect(page).toHaveURL(/\/practice\/dashboard$/); await expect(page.getByRole('heading', { name: 'Practice workspace', exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:admin:identity') || 'null')?.role)).toBe('ADMIN'); expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:practice:identity') || 'null')?.role)).toBe('PRACTICE')
  expect(state.writes.filter(item => item.path.endsWith('/verify'))).toHaveLength(1)
})

test('owner invitation is fragment-only, mailbox-bound and does not convert the global administrator role', async ({ page, context }) => {
  const state = await prepare(context, page); await page.goto('/auth/practice/accept-invitation#token=' + OWNER_TOKEN)
  await expect(page).toHaveURL(/\/auth\/practice\/accept-invitation$/); await expect(page.getByRole('heading', { name: 'Synthetic Practice', exact: true })).toBeVisible()
  const storage = await page.evaluate(() => JSON.stringify([Object.values(localStorage), Object.values(sessionStorage)])); expect(storage).not.toContain(OWNER_TOKEN)
  await page.getByLabel('Current account password (Required)').fill('Synthetic-Password2026!'); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Accept owner invitation' }).click()
  await expect(page).toHaveURL(/\/practice\/dashboard$/); expect(state.writes[0].body.token).toBe(OWNER_TOKEN); expect(state.writes[0].portal).toBe('practice')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('qarevo:admin:identity') || 'null')?.role)).toBe('ADMIN')
})

test('clinician accepts affiliation using the existing doctor session without a practice-owner grant', async ({ page, context }) => {
  const state = await prepare(context, page); await page.goto('/auth/doctor/practice-invitation#token=' + CLINICIAN_TOKEN)
  await expect(page).toHaveURL(/\/auth\/doctor\/practice-invitation$/); await expect(page.getByRole('heading', { name: 'Synthetic Practice', exact: true })).toBeVisible(); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Accept clinician membership' }).click()
  await expect(page).toHaveURL(/\/doctor\/practices$/); await expect(page.getByRole('heading', { name: 'My Practices', exact: true })).toBeVisible(); await expect(page.getByText(/clinician · active/)).toBeVisible()
  expect(state.writes[0].portal).toBe('doctor'); expect(await page.evaluate(() => localStorage.getItem('qarevo:practice:identity'))).toBeNull()
})

test('practice creation validates structured inputs and reuses one creation identity after an uncertain response', async ({ page, context }) => {
  const state = await prepare(context, page, { empty: true }); state.firstCreateFailure = true; await page.goto('/admin/practices'); await page.getByRole('button', { name: 'Add independent practice' }).click()
  await page.getByRole('button', { name: 'Create draft practice' }).click(); await expect(page.locator('#practice-name-error')).toContainText('2–160'); expect(state.writes).toHaveLength(0)
  await page.getByLabel('Practice name (Required)').fill('Synthetic Practice'); await page.getByLabel('Phone (Optional)', { exact: true }).fill('garbage'); await page.getByRole('button', { name: 'Create draft practice' }).click(); await expect(page.locator('#practice-phone-error')).toContainText('international')
  await page.getByLabel('Phone (Optional)', { exact: true }).fill('+493012345678'); await page.getByLabel('Postcode (Optional)').fill('10115'); await page.getByRole('button', { name: 'Create draft practice' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'The saved practice could not be confirmed.' })).toContainText('saved practice could not be confirmed'); await page.getByRole('button', { name: 'Create draft practice' }).click()
  await expect(page.getByRole('button', { name: 'Open practice Synthetic Practice' })).toBeVisible(); expect(state.writes).toHaveLength(2); expect(state.writes[0].body.creation_id).toBe(state.writes[1].body.creation_id)
})

test('owner invitations report provider acceptance precisely and resend with immutable generations', async ({ page, context }) => {
  const state = await prepare(context, page); await page.goto('/admin/practices'); await page.getByRole('button', { name: 'Open practice Synthetic Practice' }).click()
  const card = page.getByRole('heading', { name: 'Owner invitations', exact: true }).locator('..'); await card.getByLabel('Invitation email (Required)').fill('owner@example.invalid'); await card.getByRole('button', { name: 'Invite practice owner' }).click()
  await expect(card.getByRole('status').filter({ hasText: 'Inbox delivery is not confirmed.' })).toContainText('Inbox delivery is not confirmed.'); const first = state.ownerInvites[0].id
  await card.getByRole('button', { name: 'Resend invitation', exact: true }).click(); await expect.poll(() => state.ownerInvites.length).toBe(2); expect(state.ownerInvites[0].id).not.toBe(first); expect(state.ownerInvites[1].status).toBe('REVOKED')
})

test('administrative review, suspension and reopening use current saved versions without enabling clinical routes', async ({ page, context }) => {
  const state = await prepare(context, page); state.practice.status = 'SUBMITTED'; state.practice.version = 2; await page.goto('/admin/practices'); await page.getByRole('button', { name: 'Open practice Synthetic Practice' }).click()
  await decision(page, 'Record administrative review'); await expect(page.getByText('Administratively reviewed', { exact: true })).toBeVisible(); expect(state.writes[0].version).toBe('"2"')
  await decision(page, 'Suspend practice'); await expect(page.getByRole('button', { name: 'Reopen practice as draft', exact: true })).toBeVisible()
  await decision(page, 'Reopen practice as draft'); await expect(page.getByText('DRAFT', { exact: true })).toBeVisible(); expect(state.practice.clinical_routing_enabled).toBe(false); expect(state.practice.billing_enabled).toBe(false)
})

test('a profile edit keeps its original write version and refuses stale overwrites', async ({ page, context }) => {
  const state = await openOwner(page, context); await page.getByRole('button', { name: 'Edit practice profile' }).click(); await page.getByLabel('Practice name (Required)').fill('Unsaved local draft')
  state.practice.version = 2; state.practice.name = 'Newer saved practice'; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByRole('heading', { name: 'Newer saved practice', level: 2, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save practice profile' }).click(); await expect(page.getByRole('alert').filter({ hasText: 'This record changed.' })).toContainText('This record changed.'); expect(state.writes[0].version).toBe('"1"'); expect(state.practice.name).toBe('Newer saved practice')
})

test('foreign practice/member responses fail closed instead of rendering another tenant', async ({ page, context }) => {
  const state = await prepare(context, page, { practiceSession: true }); state.foreignDetail = true; await page.goto('/practice/dashboard'); await expect(page.getByRole('alert').filter({ hasText: 'The practice response could not be verified.' })).toContainText('practice response could not be verified'); await expect(page.getByText('Foreign Practice Secret', { exact: true })).toHaveCount(0)
  state.foreignDetail = false; await page.getByRole('button', { name: 'Retry practice details' }).click(); await expect(page.getByRole('heading', { name: 'Practice team', exact: true })).toBeVisible()
  state.foreignMembers = true; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByRole('alert').filter({ hasText: 'The practice response could not be verified.' })).toContainText('practice response could not be verified'); await expect(page.getByText('foreign-secret@example.invalid', { exact: true })).toHaveCount(0)
})

test('late invitation success cannot restore revoked management controls', async ({ page, context }) => {
  const state = await openOwner(page, context); state.holdInvite = true
  const card = page.getByRole('heading', { name: 'Clinician invitations', exact: true }).locator('..'); await card.getByLabel('Invitation email (Required)').fill('clinician@example.invalid'); await card.getByRole('button', { name: 'Invite clinician', exact: true }).click(); await expect.poll(() => state.inviteStarted).toBe(true)
  state.canManage = false; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByRole('button', { name: 'Invite clinician', exact: true })).toHaveCount(0); state.releaseInvite(); await state.inviteDelivered
  await expect(page.getByText('The email provider accepted the invitation. Inbox delivery is not confirmed.', { exact: true })).toHaveCount(0); expect(state.writes).toHaveLength(1)
})

for (const width of [320, 820, 1440]) test('practice workspace remains responsive and keyboard-accessible in both themes at ' + width, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 900 }); await openOwner(page, context)
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'Dark mode' : 'Light mode', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme); await expect(page.locator('html')).toHaveAttribute('data-theme-portal', 'practice')
    const edit = page.getByRole('button', { name: 'Edit practice profile' }); await edit.focus(); await expect(edit).toBeFocused(); await expectEnabledControlContrast(edit); await page.keyboard.press('Enter'); await expect(page.getByLabel('Practice name (Required)')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
})

test('practice sign-out and theme preferences preserve all three existing portal markers', async ({ page, context }) => {
  const state = await openOwner(page, context); await page.getByRole('button', { name: 'Dark mode', exact: true }).click(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page).toHaveURL(/\/auth\/practice\/login$/)
  expect(await page.evaluate(() => localStorage.getItem('qarevo:practice:identity'))).toBeNull()
  for (const portal of ['patient', 'doctor', 'admin'] as const) expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.session_id, `qarevo:${portal}:identity`)).toBe(state.identities[portal].session_id)
})

test('an open administrative decision cannot silently adopt a newer practice version', async ({ page, context }) => {
  const state = await prepare(context, page); state.practice.status = 'SUBMITTED'; state.practice.version = 2
  await page.goto('/admin/practices'); await page.getByRole('button', { name: 'Open practice Synthetic Practice' }).click()
  await page.getByRole('button', { name: 'Record administrative review', exact: true }).click()
  const form = page.getByRole('heading', { name: 'Record administrative review', exact: true }).locator('..')
  await form.getByLabel('Administrative reason (Required)').fill('Synthetic review of original version two'); await form.getByRole('checkbox').check()
  state.practice.version = 3; state.practice.name = 'Changed practice metadata'
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading', { name: 'Changed practice metadata', level: 2, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm record administrative review', exact: true })).toHaveCount(0)
  expect(state.writes).toHaveLength(0)
  await page.getByRole('button', { name: 'Record administrative review', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Record administrative review', exact: true }).locator('..').getByRole('checkbox')).not.toBeChecked()
})
