import { test, expect, type BrowserContext, type Request } from '@playwright/test'
import { seedPortalSession, testSessionTiming } from './helpers/portal-session'

const consultation = '66666666-6666-4666-8666-666666666666'
const episode = '88888888-8888-4888-8888-888888888888'
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']
type Portal = 'patient' | 'doctor'
function record(revision: number) {
  return { id: ids[revision - 1], episode_id: episode, consultation_id: consultation, revision, version: revision + 1, language: 'en', authored_by: 'synthetic-clinician', approved_by: 'synthetic-clinician', published_at: `2030-07-${String(revision + 10).padStart(2, '0')}T08:00:00Z`, created_at: '2030-07-10T07:45:00Z', updated_at: '2030-07-13T08:00:00Z', summary: `Synthetic published summary ${revision}`, history: 'Synthetic history', findings: 'Synthetic findings', assessment: 'Synthetic assessment', plan: `Synthetic care plan ${revision}`, safety_net: 'Synthetic safety advice', amendment_reason: revision > 1 ? 'Synthetic correction reason' : null }
}
function metadata(revision: number) {
  const value = record(revision)
  return Object.fromEntries(['id', 'episode_id', 'consultation_id', 'revision', 'version', 'language', 'approved_by', 'published_at'].map(key => [key, value[key as keyof typeof value]]))
}
const path = (portal: Portal, id?: string) => `${portal === 'doctor' ? '/doctor/clinical-records' : '/patient/consultation-summary'}?consultationId=${consultation}${id ? `&recordId=${id}` : ''}`
async function prepare(context: BrowserContext, portal: Portal) {
  const identity = await seedPortalSession(context, portal)
  const state = { identity, latest: 3, detailLatest: 3, latestBody: 3, listFailure: false, invalidCursor: false, unavailable: false, draftResponse: false, holdRecord: '', heldRequest: null as Request | null, heldDelivery: Promise.resolve(), release: () => {}, holdHistoryBefore: 0, heldHistory: null as Request | null, releaseHistory: () => {}, requests: [] as string[], details: [] as string[], writes: 0, editorDraft: null as ReturnType<typeof record> | null }
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), pathname = url.pathname
    if (route.request().method() !== 'GET' && !pathname.startsWith('/api/v1/session') && !pathname.endsWith('/browser-csrf')) state.writes++
    if (pathname.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (pathname.startsWith('/api/v1/session')) return route.fulfill({ json: testSessionTiming(state.identity) })
    if (pathname.endsWith('/publications')) {
      state.requests.push(url.search)
      if (state.listFailure) return route.fulfill({ status: 503, json: { detail: 'Synthetic published-version service unavailable' } })
      const before = Number(url.searchParams.get('before_revision') || '0')
      const revisions = before ? [1] : [3, 2].filter(revision => revision <= state.latest)
      if (before && before === state.holdHistoryBefore) {
        state.holdHistoryBefore = 0; state.heldHistory = route.request()
        await new Promise<void>(resolve => { state.releaseHistory = resolve })
      }
      return route.fulfill({ json: { items: revisions.map(metadata), latest_published_revision: state.latest, has_more: !before, next_before_revision: !before ? state.invalidCursor ? 1 : 2 : null } })
    }
    if (pathname.includes('/publications/')) {
      const id = pathname.split('/').at(-1)!, revision = ids.indexOf(id) + 1
      state.details.push(id)
      const body = { record: state.draftResponse ? { ...record(revision), summary: 'Synthetic unpublished draft sentinel', approved_by: null, published_at: null } : record(revision), latest_published_revision: state.detailLatest, is_current: revision === state.detailLatest }
      let deliveryFinished: (() => void) | undefined
      if (state.holdRecord === id) {
        state.holdRecord = ''
        state.heldDelivery = new Promise<void>(resolve => { deliveryFinished = resolve })
        state.heldRequest = route.request()
        await new Promise<void>(resolve => { state.release = resolve })
      }
      try { return await (state.unavailable ? route.fulfill({ status: 410, json: { detail: 'Synthetic publication access unavailable' } }) : route.fulfill({ json: body })) }
      finally { deliveryFinished?.() }
    }
    if (pathname.endsWith('/patient/consultation-summary')) return route.fulfill({ json: record(state.latestBody) })
    if (pathname.endsWith('/clinical-record')) return route.fulfill({ json: { draft: state.editorDraft, published: record(3) } })
    if (pathname === `/api/v1/doctor/workspace/${consultation}`) return route.fulfill({ json: { consultation: { consultation_id: consultation, episode_id: null, patient_name: 'Synthetic Patient', patient_id: 'synthetic-patient', status: 'ENDED', started_at: '2030-07-10T07:00:00Z' }, can_join_video: false, can_complete: false } })
    if (pathname.endsWith('/doctor/profile')) return route.fulfill({ json: { full_name: 'Synthetic Doctor', specialty: 'General medicine' } })
    if (pathname.endsWith('/patient/settings')) return route.fulfill({ json: { first_name: 'Synthetic', last_name: 'Patient', emergency_contacts: [] } })
    if (pathname.endsWith('/patient/settings/health-info')) return route.fulfill({ json: {} })
    if (pathname.endsWith('/profile-image')) return route.fulfill({ json: { image: null } })
    if (pathname.endsWith('/patient/medical-records')) return route.fulfill({ json: { records: [], timeline: [] } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
  return state
}
async function settle(request: Request) {
  const response = await request.response()
  if (response) await response.finished()
  else expect(request.failure()).not.toBeNull()
}

for (const portal of ['patient', 'doctor'] as const) {
  test(`${portal}: explicit historical selection, refresh and return to current never change a draft`, async ({ page, context }) => {
    const state = await prepare(context, portal)
    await page.goto(path(portal))
    const article = page.getByRole('article', { name: 'Published consultation summary', exact: true })
    await expect(article).toContainText('Synthetic published summary 3')
    await expect(article.getByRole('heading', { name: 'Latest published revision', exact: true })).toBeVisible()
    expect(state.details).not.toContain(ids[1])
    await page.getByRole('link', { name: 'View revision 2', exact: true }).click()
    await expect(article).toContainText('Synthetic published summary 2')
    await expect(article.getByRole('heading', { name: 'Superseded published revision', exact: true })).toBeVisible()
    await expect(article.getByText('Synthetic correction reason', { exact: true })).toBeVisible()
    await page.reload()
    await expect(article).toContainText('Synthetic published summary 2')
    await article.getByRole('link', { name: 'Return to current summary', exact: true }).click()
    await expect(article).toContainText('Synthetic published summary 3')
    expect(state.writes).toBe(0)
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic published summary')
  })

  test(`${portal}: bounded keyset paging does not replace the document or prefetch old bodies`, async ({ page, context }) => {
    const state = await prepare(context, portal)
    await page.goto(path(portal))
    const article = page.getByRole('article'), history = page.getByRole('region', { name: 'Published summary versions', exact: true })
    await expect(article).toContainText('Synthetic published summary 3')
    await history.getByRole('button', { name: 'Older revisions', exact: true }).click()
    await expect(history.getByRole('link', { name: 'View revision 1', exact: true })).toBeVisible()
    await expect(article).toContainText('Synthetic published summary 3')
    expect(state.details).not.toContain(ids[0]); expect(state.details).not.toContain(ids[1])
    expect(state.requests.some(query => new URLSearchParams(query).get('limit') === '20' && new URLSearchParams(query).get('before_revision') === '2')).toBe(true)
    await expect(history.getByRole('button', { name: 'Older revisions', exact: true })).toBeDisabled()
    await history.getByRole('button', { name: 'Newer revisions', exact: true }).click()
    await expect(history.getByRole('link', { name: 'View revision 3', exact: true })).toBeVisible()
    await expect(history.getByRole('button', { name: 'Newer revisions', exact: true })).toBeDisabled()
  })

  test(`${portal}: unavailable and unpublished selected records fail closed with a current-summary recovery route`, async ({ page, context }) => {
    const state = await prepare(context, portal); state.unavailable = true
    await page.goto(path(portal, ids[1]))
    await expect(page.getByRole('alert').filter({ hasText: 'This published revision is no longer available through this portal' })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Return to current summary', exact: true })).toHaveAttribute('href', path(portal))
    state.unavailable = false; state.draftResponse = true
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'A published summary could not be confirmed' })).toBeVisible()
    await expect(page.getByText('Synthetic unpublished draft sentinel', { exact: true })).toHaveCount(0)
    state.draftResponse = false
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(page.getByRole('article')).toContainText('Synthetic published summary 2')
  })

  test(`${portal}: a late historical response cannot cross selection of the current revision`, async ({ page, context }) => {
    const state = await prepare(context, portal); state.holdRecord = ids[1]
    await page.goto(path(portal, ids[1]))
    await expect.poll(() => Boolean(state.heldRequest)).toBe(true)
    const completed = settle(state.heldRequest!)
    await page.getByRole('link', { name: 'View revision 3', exact: true }).click()
    await expect(page.getByRole('article')).toContainText('Synthetic published summary 3')
    state.release(); await completed
    await expect(page.getByRole('article')).toContainText('Synthetic published summary 3')
    await expect(page.getByText('Synthetic published summary 2', { exact: true })).toHaveCount(0)
  })

  test(`${portal}: malformed record links and unsafe cursors never create unbound reads`, async ({ page, context }) => {
    const state = await prepare(context, portal)
    await page.goto(`${path(portal)}&recordId=javascript%3Aexample`)
    await expect(page.getByRole('heading', { name: 'This summary link is invalid', exact: true })).toBeVisible()
    expect(state.requests).toHaveLength(0); expect(state.details).toHaveLength(0)
    state.invalidCursor = true
    await page.goto(path(portal, ids[2]))
    const history = page.getByRole('region', { name: 'Published summary versions', exact: true })
    await expect(history.getByRole('alert')).toContainText('The published-version list could not be confirmed')
    await expect(history.getByRole('button', { name: 'Older revisions', exact: true })).toBeDisabled()
    state.invalidCursor = false
    await history.getByRole('button', { name: 'Retry published versions', exact: true }).click()
    await expect(history.getByRole('link', { name: 'View revision 2', exact: true })).toBeVisible()
  })

  test(`${portal}: known-superseded status survives a delayed history page and an older detail snapshot`, async ({ page, context }) => {
    const state = await prepare(context, portal); state.detailLatest = 2; state.holdHistoryBefore = 2
    await page.goto(path(portal, ids[1]))
    const article = page.getByRole('article'), history = page.getByRole('region', { name: 'Published summary versions', exact: true })
    await expect(article.getByRole('heading', { name: 'Superseded published revision', exact: true })).toBeVisible()
    await history.getByRole('button', { name: 'Older revisions', exact: true }).click()
    await expect.poll(() => Boolean(state.heldHistory)).toBe(true)
    const completed = settle(state.heldHistory!)
    await expect(history.getByText('Loading published versions…', { exact: true })).toBeVisible()
    await expect(article.getByRole('heading', { name: 'Superseded published revision', exact: true })).toBeVisible()
    state.releaseHistory(); await completed
    await expect(history.getByRole('link', { name: 'View revision 1', exact: true })).toBeVisible()
    await expect(article.getByRole('heading', { name: 'Superseded published revision', exact: true })).toBeVisible()
    await expect(article.getByRole('heading', { name: 'Latest published revision', exact: true })).toHaveCount(0)
  })

  for (const width of [320, 820, 1440]) test(`${portal}: historical record supports both themes and keyboard navigation at ${width}px`, async ({ page, context }) => {
    await prepare(context, portal)
    await page.setViewportSize({ width, height: 900 }); await page.goto(path(portal, ids[1]))
    const article = page.getByRole('article'), history = page.getByRole('region', { name: 'Published summary versions', exact: true })
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme)
      await expect(article.getByRole('heading', { name: 'Superseded published revision', exact: true })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      const current = article.getByRole('link', { name: 'Return to current summary', exact: true })
      await current.focus(); await expect(current).toBeFocused()
      const older = history.getByRole('button', { name: 'Older revisions', exact: true })
      await older.focus(); await expect(older).toBeFocused(); await page.keyboard.press('Enter')
      await expect(history.getByRole('link', { name: 'View revision 1', exact: true })).toBeVisible()
      await history.getByRole('button', { name: 'Newer revisions', exact: true }).click()
      await expect(history.getByRole('link', { name: 'View revision 2', exact: true })).toBeVisible()
    }
    await expect(page.locator(portal === 'doctor' ? "[data-portal-main='doctor']" : '.patient-portal-shell').first()).toBeVisible()
  })
}

test('a newer history snapshot never labels an older latest-body response current', async ({ page, context }) => {
  const state = await prepare(context, 'patient'); state.latestBody = 2
  await page.goto(path('patient'))
  const article = page.getByRole('article')
  await expect(article).toContainText('Synthetic published summary 2')
  await expect(article.getByRole('heading', { name: 'Superseded published revision', exact: true })).toBeVisible()
  state.latestBody = 3
  await page.getByRole('button', { name: 'Refresh summary', exact: true }).click()
  await expect(article).toContainText('Synthetic published summary 3')
  await expect(article.getByRole('heading', { name: 'Latest published revision', exact: true })).toBeVisible()
})

test('a changed doctor session returns to physician sign-in and cannot revive a held historical body', async ({ page, context }) => {
  const state = await prepare(context, 'doctor'); state.holdRecord = ids[1]
  await page.goto(path('doctor', ids[1]))
  await expect.poll(() => Boolean(state.heldRequest)).toBe(true)
  // Full sign-in navigation may abandon the intercepted browser request. The
  // exact route-handler delivery attempt still has a deterministic completion.
  const completed = state.heldDelivery
  state.identity = { user_id: 'synthetic-different-doctor', role: 'PROVIDER', session_id: 'synthetic-different-session', provider_id: 'synthetic-different-provider' }
  try {
    await page.evaluate(identity => {
      const key = 'qarevo:doctor:identity', value = JSON.stringify(identity)
      localStorage.setItem(key, value); window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
    }, state.identity)
    await expect(page).toHaveURL(/\/auth\/doctor\/login$/)
  } finally { state.release() }
  await completed
  await expect(page).toHaveURL(/\/auth\/doctor\/login$/)
  await expect(page.getByRole('article')).toHaveCount(0)
  await expect(page.getByText('Synthetic published summary 2', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('Synthetic published summary 2')
})

test('opening published versions preserves the editor unsaved-navigation safeguard', async ({ page, context }) => {
  const state = await prepare(context, 'doctor')
  await page.goto(`/doctor/workspace/${consultation}`)
  await page.getByRole('button', { name: 'Create amendment', exact: true }).click()
  await page.locator('#record-summary').fill('Synthetic unsaved amendment text')
  await page.getByRole('link', { name: 'View published versions', exact: true }).click()
  const guard = page.getByRole('dialog', { name: 'Keep your clinical notes?', exact: true })
  await expect(guard).toBeVisible()
  await guard.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.locator('#record-summary')).toHaveValue('Synthetic unsaved amendment text')
  // The already known publication must remain readable even when its metadata
  // index is unavailable; opening it must not wait for a successful list read.
  state.listFailure = true
  await page.getByRole('link', { name: 'View published versions', exact: true }).click()
  await guard.getByRole('button', { name: 'Discard and leave', exact: true }).click()
  await expect(page).toHaveURL(path('doctor', ids[2]))
  await expect(page.getByRole('article')).toContainText('Synthetic published summary 3')
  expect(state.writes).toBe(0)
})
