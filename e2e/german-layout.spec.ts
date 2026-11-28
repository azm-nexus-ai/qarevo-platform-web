import { expect, test, type BrowserContext } from '@playwright/test'

/** German compounds must wrap: no page scrolls sideways and no control leaves the screen on small phones. */
const ROLE = { patient: 'PATIENT', doctor: 'PROVIDER', admin: 'ADMIN', practice: 'PRACTICE' } as const
const PAGES = [
  '/', '/auth', '/auth/sign-in', '/auth/sign-up', '/auth/verify-email', '/auth/otp', '/auth/forgot-password', '/auth/admin/forgot-password',
  '/auth/doctor/login', '/auth/doctor-register', '/auth/doctor-verify-phone', '/auth/admin/login', '/auth/practice/login', '/auth/profile-setup',
  '/patient/dashboard', '/patient/find-doctor', '/patient/medical-records', '/patient/billing', '/patient/settings',
  '/doctor/dashboard', '/doctor/workspace', '/doctor/profile', '/admin/dashboard', '/practice/dashboard', '/support',
]

async function prepare(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: 'qarevo_locale', value: 'de', url: baseURL }])
  await context.addInitScript(roles => {
    const portal = location.pathname.split('/')[1]
    if (portal in roles) { localStorage.setItem(`qarevo:${portal}:identity`, JSON.stringify({ user_id: `synthetic-${portal}`, role: (roles as Record<string, string>)[portal], session_id: `synthetic-${portal}-session`, provider_id: 'synthetic-provider' })); sessionStorage.setItem('qarevo:active-portal', portal) }
  }, ROLE)
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname, portal = route.request().headers()['x-qarevo-portal'] || 'patient'
    const identity = { user_id: `synthetic-${portal}`, role: (ROLE as Record<string, string>)[portal] || 'PATIENT', session_id: `synthetic-${portal}-session`, provider_id: 'synthetic-provider' }
    if (path.endsWith('/browser-csrf')) return route.fulfill({ json: { csrf_token: 'synthetic-csrf' } })
    if (path.startsWith('/api/v1/session') || path.startsWith('/api/v1/practice/session')) return route.fulfill({ json: { ...identity, browser_session: identity, server_time: new Date().toISOString(), idle_expires_at: new Date(Date.now() + 900_000).toISOString(), absolute_expires_at: new Date(Date.now() + 28_800_000).toISOString(), warning_seconds: 120, idle_timeout_seconds: 900 } })
    if (path === '/api/v1/practice/capabilities') return route.fulfill({ json: { enabled: true, clinical_routing_enabled: false, billing_enabled: false, administrative_review_only: true } })
    if (path === '/api/v1/auth/social/providers') return route.fulfill({ json: { google: { enabled: false }, apple: { enabled: false }, microsoft: { enabled: false } } })
    return route.fulfill({ status: 404, json: { detail: 'No synthetic fixture' } })
  })
}

const GROUPS = { public: PAGES.filter(path => !/^\/(patient|doctor|admin|practice)\//.test(path)), portals: PAGES.filter(path => /^\/(patient|doctor|admin|practice)\//.test(path)) }
for (const width of [320, 390]) for (const [group, paths] of Object.entries(GROUPS)) test(`German ${group} pages fit a ${width}px phone`, async ({ browser, baseURL }) => {
  test.setTimeout(180_000)
  const context = await browser.newContext({ viewport: { width, height: 800 } }); await prepare(context, baseURL!)
  const page = await context.newPage(), problems: string[] = []
  for (const path of paths) {
    await page.goto(path, { waitUntil: 'load' }).catch(() => undefined)
    await page.waitForTimeout(700)
    const result = await page.evaluate(() => {
      const vw = innerWidth, skip = (el: Element) => el.closest('[aria-hidden=true],[inert],dialog:not([open]),[hidden]') || (el.closest('details:not([open])') && !el.closest('summary'))
      const scroller = (el: Element) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true } return false }
      const outside = [...document.querySelectorAll('button, a[href], input, select, textarea, h1, h2, label')].filter(el => {
        if (skip(el)) return false
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
        return r.width > 0 && cs.visibility !== 'hidden' && cs.position !== 'fixed' && (r.right > vw + 1 || r.left < -1) && !scroller(el)
      }).map(el => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}"`)
      return { overflow: document.documentElement.scrollWidth - vw, outside: outside.slice(0, 3) }
    })
    if (result.overflow > 0 || result.outside.length) problems.push(`${path}: overflow ${result.overflow}px ${result.outside.join(', ')}`)
  }
  await context.close()
  expect(problems).toEqual([])
})
