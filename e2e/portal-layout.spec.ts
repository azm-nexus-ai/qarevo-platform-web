import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/** The fixed primary sidebar never covers the header, the page or the footer, in either language, at desktop widths. */
const ID = { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN', practice: 'PRACTICE' } as const
type Portal = keyof typeof ID
const PAGES: [Portal, string][] = [['doctor', '/doctor/dashboard'], ['admin', '/admin/dashboard'], ['practice', '/practice/dashboard']]

async function prepare(context: BrowserContext, portal: Portal, locale: 'de' | 'en', baseURL: string) {
  const identity = { user_id: `synthetic-${portal}`, role: ID[portal], session_id: `synthetic-${portal}-session`, ...(portal === 'doctor' ? { provider_id: 'synthetic-provider' } : {}) }
  await context.addCookies([{ name: 'qarevo_locale', value: locale, url: baseURL }])
  await context.addInitScript(({ portal, identity }) => {
    localStorage.setItem(`qarevo:${portal}:identity`, JSON.stringify(identity)); sessionStorage.setItem('qarevo:active-portal', portal)
  }, { portal, identity })
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session') || path.startsWith('/api/v1/practice/session')) return route.fulfill({ json: { ...identity, browser_session: identity, server_time: new Date().toISOString(),
      idle_expires_at: new Date(Date.now() + 900_000).toISOString(), absolute_expires_at: new Date(Date.now() + 28_800_000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path === '/api/v1/practice/capabilities') return route.fulfill({ json: { enabled: true, clinical_routing_enabled: false, billing_enabled: false, administrative_review_only: true } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
}

async function geometry(page: Page, portal: Portal) {
  return page.evaluate(portal => {
    const box = (element: Element | null) => element ? element.getBoundingClientRect() : null
    const aside = box(document.getElementById(`${portal}-primary-sidebar`)), header = box(document.querySelector('.portal-desktop-navbar'))
    const footer = box(document.querySelector('footer.corporate-footer')), main = box(document.querySelector(`[data-portal-main=${portal}]`))
    return { aside, header, footer, main, overflow: document.documentElement.scrollWidth - window.innerWidth }
  }, portal)
}

for (const locale of ['en', 'de'] as const) for (const width of [1024, 1280, 1440]) for (const [portal, path] of PAGES) {
  test(`${portal} sidebar stays clear of header, page and footer at ${width}px (${locale})`, async ({ page, context, baseURL }) => {
    await prepare(context, portal, locale, baseURL!)
    await page.setViewportSize({ width, height: 800 })
    await page.goto(path)
    await expect(page.locator(`#${portal}-primary-sidebar`)).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const g = await geometry(page, portal)
    expect(g.overflow, 'no horizontal page scroll').toBeLessThanOrEqual(0)
    expect(g.aside!.top, 'sidebar starts below the header').toBeGreaterThanOrEqual(g.header!.bottom - 1)
    expect(g.main!.left, 'page content starts after the sidebar').toBeGreaterThanOrEqual(g.aside!.right - 1)
    expect(g.footer!.left, 'footer starts after the sidebar').toBeGreaterThanOrEqual(g.aside!.right - 1)
  })
}
