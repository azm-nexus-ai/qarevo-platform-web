import {seedPortalSession} from './helpers/portal-session'
import { test, expect, type BrowserContext } from '@playwright/test'

async function prepare(context: BrowserContext, role: 'PATIENT' | 'PROVIDER' | 'ADMIN') {
  const identity = await seedPortalSession(context, ({PATIENT:'patient',PROVIDER:'doctor',ADMIN:'admin'} as const)[role], {user_id:'synthetic-qa-user'})
  const state={fail:false,requests:0,profileReads:0}
  await context.route('**/api/v1/**',async route=>{
    const path=new URL(route.request().url()).pathname
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
    if(path.startsWith('/api/v1/session'))return route.fulfill({headers,json:{browser_session:identity,server_time:new Date().toISOString(),idle_expires_at:new Date(Date.now()+900000).toISOString(),absolute_expires_at:new Date(Date.now()+28800000).toISOString(),warning_seconds:120,idle_timeout_seconds:900}})
    if(path.endsWith('/audit-logs/clinical-access'))return route.fulfill({headers,json:{can_view:false,events:[],total_count:0,limit:25,offset:0,has_next:false,has_previous:false}})
    if(path.includes('/exceptions')||path.includes('/audit-logs')) {
      state.requests++
      if(state.fail)return route.fulfill({status:503,headers,json:{detail:'Synthetic service unavailable'}})
      if(path.endsWith('/stats/summary'))return route.fulfill({headers,json:{total:1,by_status:{open:1},by_severity:{high:1},by_type:{routing:1}}})
      if(path.endsWith('/summary/actions'))return route.fulfill({headers,json:{actions:[{action:'UPDATE_PROFILE',count:1}]}})
      if(path.includes('/exceptions'))return route.fulfill({headers,json:{total:1,limit:50,offset:0,exceptions:[{id:'synthetic-exception-1234',type:'routing',severity:'high',status:'open',source:'synthetic',source_type:'test',created_at:'2030-01-01T00:00:00Z'}]}})
      return route.fulfill({headers,json:{total:1,limit:50,offset:0,logs:[{id:'synthetic-audit-1234',admin_user_id:'synthetic-owner',action:'UPDATE_PROFILE',target_type:'user',created_at:'2030-01-01T00:00:00Z',changes:{status:'ACTIVE'}}]}})
    }
    if(path.includes('/patient/doctors'))return route.fulfill({headers,json:{doctors:[],total:0,filtered_count:0,page:1,page_size:20,has_next:false,has_previous:false}})
    if(path.endsWith('/settings'))return route.fulfill({headers,json:{user_id:'synthetic-qa-user',first_name:'Synthetic',last_name:'Patient',emergency_contacts:[]}})
    if(path.endsWith('/profile')) { state.profileReads++; await new Promise(resolve=>setTimeout(resolve,200)); return route.fulfill({headers,json:{full_name:'Synthetic Clinician'}}) }
    if(path.endsWith('/billing'))return route.fulfill({headers,json:{status:'not_configured',invoices:[],payment_methods:[],payment_history:[],upcoming_charges:[],insurance_summary:{status:'unverified'}}})
    return route.fulfill({headers,json:{}})
  })
  return state
}

for(const [role,portal,home] of [
  ['PATIENT','patient','/patient/dashboard'],['PROVIDER','doctor','/doctor/dashboard'],['ADMIN','admin','/admin/dashboard'],
] as const) {
  test(`${portal} shared support retains its navigation, role-aware logo and theme action`,async({page,context})=>{
    await prepare(context,role)
    await page.setViewportSize({width:1440,height:1000})
    await page.goto('/support')
    await expect(page.locator(`#${portal}-primary-sidebar`)).toBeVisible()
    await expect(page.getByRole('link',{name:`Return to ${portal} dashboard`,exact:true})).toHaveAttribute('href',home)
    await expect(page.getByRole('contentinfo').getByRole('link',{name:'Qarevo Health home',exact:true})).toHaveAttribute('href',home)
    const theme=page.getByRole('button',{name:'Dark mode',exact:true})
    await theme.click()
    await expect(page.getByRole('button',{name:'Light mode',exact:true})).toHaveAttribute('title','Switch to light mode')
    await page.reload()
    await expect(page.getByRole('button',{name:'Light mode',exact:true})).toBeVisible()
    const header=portal==='patient'?page.getByRole('navigation',{name:'Patient appearance'}):page.getByRole('banner',{name:portal==='doctor'?'Doctor main navigation':'Admin main navigation'})
    const brand=header.getByRole('link',{name:new RegExp(`Qarevo Health ${portal} dashboard`,'i')})
    const left=header.getByRole('button',{name:'Hide sidebar',exact:true})
    expect((await brand.boundingBox())!.x).toBeLessThan((await left.boundingBox())!.x)
    if(portal!=='patient') {
      const bounds=await header.boundingBox(),sidebar=await page.locator(`#${portal}-primary-sidebar`).boundingBox()
      expect(bounds!.x).toBe(0)
      expect(bounds!.width).toBe(1440)
      expect(sidebar!.y).toBeGreaterThanOrEqual(bounds!.y+bounds!.height)
    }
    for(const width of [820,390,320]) {
      await page.setViewportSize({width,height:900})
      await expect(page.getByRole('heading',{name:'Help & Support',exact:true})).toBeVisible()
      await expect(page.getByRole('button',{name:'Light mode',exact:true})).toBeVisible()
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    }
    await page.goto('/support/nonexistent-synthetic-reference')
    await expect(page.getByRole('link',{name:'Back to Support',exact:true})).toHaveAttribute('href','/support')
    await expect(page.getByText('No ticket data is available',{exact:false})).toBeVisible()
  })
}

for(const [path,heading] of [['/admin/exceptions','Exceptions Management'],['/admin/audit','Audit Logs']] as const) {
  test(`${path} renders canonical identifiers and retries the failed operation`,async({page,context})=>{
    const state=await prepare(context,'ADMIN');state.fail=true
    await page.goto(path)
    await expect(page.getByRole('alert').filter({hasText:'Unable to load'})).toBeVisible()
    const before=state.requests
    state.fail=false
    await page.getByRole('button',{name:'Try again',exact:true}).click()
    await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible()
    expect(state.requests).toBeGreaterThan(before)
    await expect(page.locator('body')).not.toContainText('This page could not be displayed')
    await expect(page.locator('#admin-primary-sidebar')).toBeVisible()
    if(path.endsWith('audit'))await expect(page.getByText('synthetic-owner',{exact:true})).toBeVisible()
    else await expect(page.getByText('#ion-1234',{exact:false})).toBeVisible()
  })
}

test('patient right and left rails collapse independently and survive reload',async({page,context})=>{
  await prepare(context,'PATIENT')
  await page.setViewportSize({width:1600,height:1000})
  await page.goto('/patient/find-doctor')
  await expect(page.locator('#patient-primary-sidebar')).toBeVisible()
  await expect(page.locator('#patient-secondary-sidebar')).toBeVisible()
  await page.getByRole('button',{name:'Hide right sidebar',exact:true}).click()
  await expect(page.locator('#patient-secondary-sidebar')).toBeHidden()
  await expect(page.locator('#patient-primary-sidebar')).toBeVisible()
  await page.getByRole('button',{name:'Hide sidebar',exact:true}).click()
  await expect(page.locator('#patient-primary-sidebar')).toBeHidden()
  await page.reload()
  await expect(page.getByRole('button',{name:'Show right sidebar',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Show sidebar',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Show right sidebar',exact:true}).click()
  await expect(page.locator('#patient-secondary-sidebar')).toBeVisible()
  await expect(page.locator('#patient-primary-sidebar')).toBeHidden()
})


test('doctor layout coalesces desktop and mobile profile reads without a response cache',async({page,context})=>{
  const state=await prepare(context,'PROVIDER')
  await page.goto('/support')
  await expect(page.getByRole('heading',{name:'Welcome, Synthetic Clinician',exact:true})).toBeVisible()
  expect(state.profileReads).toBe(1)
  await page.reload()
  await expect(page.getByRole('heading',{name:'Welcome, Synthetic Clinician',exact:true})).toBeVisible()
  expect(state.profileReads).toBe(2)
})
