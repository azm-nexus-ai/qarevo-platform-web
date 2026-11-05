import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { seedPortalSession, testSessionTiming, type TestPortal } from './helpers/portal-session'

async function isolateThemeFixtures(context: BrowserContext) {
  const identities = {
    patient: await seedPortalSession(context, 'patient'),
    doctor: await seedPortalSession(context, 'doctor'),
    admin: await seedPortalSession(context, 'admin'),
  }
  await context.route('**/api/v1/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname
    if(path==='/api/v1/browser-csrf')return route.fallback()
    const portal=(request.headers()['x-qarevo-portal']||'patient') as TestPortal
    if(path.startsWith('/api/v1/session'))return route.fulfill({json:testSessionTiming(identities[portal])})
    if(path.endsWith('/auth/social/providers'))return route.fulfill({json:{google:{enabled:false},apple:{enabled:false}}})
    if(path==='/api/v1/doctor/profile')return route.fulfill({json:{user_id:identities.doctor.user_id,provider_id:identities.doctor.provider_id,full_name:'Synthetic Clinician',specialty:'General practice',avatar_url:null}})
    if(path==='/api/v1/patient/settings')return route.fulfill({json:{user_id:identities.patient.user_id,first_name:'Synthetic',last_name:'Patient',emergency_contacts:[]}})
    if(path==='/api/v1/patient/profile-image')return route.fulfill({json:{image:null}})
    return route.fulfill({status:404,json:{detail:'No synthetic theme fixture'}})
  })
}
const appearance=(page:Page)=>page.getByRole('navigation',{name:'Account appearance',exact:true})

async function selectTheme(page:Page,theme:'light'|'dark') {
  const action=theme==='dark'?'Dark mode':'Light mode'
  const toggle=appearance(page).getByRole('button',{name:action,exact:true})
  if(await page.locator('html').getAttribute('data-theme')!==theme)await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme)
  const opposite=theme==='dark'?'Light mode':'Dark mode'
  await expect(appearance(page).getByRole('button',{name:opposite,exact:true})).toHaveAttribute('title',`Switch to ${opposite.toLowerCase()}`)
}

test('patient, doctor and admin themes remain independent across tabs, client routes, refresh and a new browser session',async({page,context,browser})=>{
  await isolateThemeFixtures(context)
  const doctor=await context.newPage(),admin=await context.newPage()
  await Promise.all([page.goto('/auth/sign-in'),doctor.goto('/auth/doctor/login'),admin.goto('/auth/admin/login')])
  await selectTheme(page,'dark')
  await expect(doctor.locator('html')).toHaveAttribute('data-theme','light')
  await expect(admin.locator('html')).toHaveAttribute('data-theme','light')
  await selectTheme(admin,'dark')
  await expect(doctor.locator('html')).toHaveAttribute('data-theme','light')
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  // Next.js client navigation must apply the destination portal's own theme.
  await page.getByRole('link',{name:'Physician sign-in',exact:false}).click()
  await expect(page).toHaveURL(/\/auth\/doctor\/login$/)
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await selectTheme(doctor,'dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await page.getByRole('link',{name:'Patient sign-in',exact:false}).click()
  await expect(page).toHaveURL(/\/auth\/sign-in$/)
  await selectTheme(page,'light')
  await expect(doctor.locator('html')).toHaveAttribute('data-theme','dark')
  await expect(admin.locator('html')).toHaveAttribute('data-theme','dark')
  await doctor.getByRole('contentinfo').getByRole('link',{name:'Privacy',exact:true}).click()
  await expect(doctor).toHaveURL(/\/privacy$/)
  await expect(doctor.locator('html')).toHaveAttribute('data-theme-portal','doctor')
  await expect(doctor.locator('html')).toHaveAttribute('data-theme','dark')
  await doctor.reload()
  await expect(doctor.locator('html')).toHaveAttribute('data-theme','dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  const state=await context.storageState()
  const fresh=await browser.newContext({storageState:{cookies:[],origins:state.origins.map(origin=>({...origin,localStorage:origin.localStorage.filter(item=>/^qarevo:(patient|doctor|admin):theme$/.test(item.name))}))}})
  await fresh.route('**/api/**',route=>route.fulfill({json:{google:{enabled:false},apple:{enabled:false}}}))
  const freshPage=await fresh.newPage()
  await freshPage.goto('/auth/doctor/login')
  await expect(freshPage.locator('html')).toHaveAttribute('data-theme','dark')
  await freshPage.goto('/auth/sign-in')
  await expect(freshPage.locator('html')).toHaveAttribute('data-theme','light')
  await fresh.close()
  const preferences=await page.evaluate(()=>({patient:localStorage.getItem('qarevo:patient:theme'),doctor:localStorage.getItem('qarevo:doctor:theme'),admin:localStorage.getItem('qarevo:admin:theme'),legacy:localStorage.getItem('qarevo.theme.v1')}))
  expect(preferences).toEqual({patient:'light',doctor:'dark',admin:'dark',legacy:null})
})

test('footer clears only its current portal appearance and preserves other role themes, sidebars and identities',async({page,context})=>{
  await isolateThemeFixtures(context)
  await context.addInitScript(()=>{
    if(sessionStorage.getItem('qarevo:test:appearance-seed'))return
    localStorage.setItem('qarevo:patient:theme','dark')
    localStorage.setItem('qarevo:doctor:theme','dark')
    localStorage.setItem('qarevo:admin:theme','dark')
    for(const portal of ['patient','patient-right','doctor','admin'])localStorage.setItem(`qarevo.sidebar.${portal}`,'collapsed')
    sessionStorage.setItem('qarevo:test:appearance-seed','true')
  })
  await page.goto('/auth/doctor/login')
  const before=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.endsWith(':identity'))))
  await page.getByRole('button',{name:'Cookie preferences',exact:true}).click()
  const preferences=page.getByRole('dialog',{name:'Cookie & storage preferences',exact:true})
  await preferences.getByRole('button',{name:'Clear appearance preferences',exact:true}).click()
  await expect(preferences.getByRole('status')).toContainText('This portal’s appearance preferences were cleared.')
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
  await expect(page.locator('html')).toHaveAttribute('data-doctor-sidebar','expanded')
  for(const portal of ['patient','patient-right','admin'])await expect(page.locator('html')).toHaveAttribute(`data-${portal}-sidebar`,'collapsed')
  const after=await page.evaluate(()=>({identities:Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.endsWith(':identity'))),patient:localStorage.getItem('qarevo:patient:theme'),doctor:localStorage.getItem('qarevo:doctor:theme'),admin:localStorage.getItem('qarevo:admin:theme')}))
  expect(after).toEqual({identities:before,patient:'dark',doctor:null,admin:'dark'})
  await preferences.getByRole('button',{name:'Close preferences',exact:true}).click()
  await expect(page.getByRole('button',{name:'Cookie preferences',exact:true})).toBeFocused()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme','light')
})
