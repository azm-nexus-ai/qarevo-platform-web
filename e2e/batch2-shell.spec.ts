import {test,expect,type BrowserContext} from '@playwright/test'
import type {PatientDoctor} from '../lib/api'

async function prepare(context:BrowserContext,role:'PATIENT'|'PROVIDER'|'ADMIN') {
  await context.addInitScript(role=>{localStorage.setItem('qarevo_access_token','synthetic-brand-access');localStorage.setItem('qarevo_refresh_token','synthetic-brand-refresh');localStorage.setItem('qarevo_user_id','synthetic-brand-user');localStorage.setItem('qarevo_role',role)},role)
  await context.route('**/api/v1/**',route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
    const path=new URL(route.request().url()).pathname
    if(path.startsWith('/api/v1/session'))return route.fulfill({headers,json:{server_time:new Date().toISOString(),idle_expires_at:new Date(Date.now()+900000).toISOString(),absolute_expires_at:new Date(Date.now()+28800000).toISOString(),warning_seconds:120,idle_timeout_seconds:900}})
    if(path.endsWith('/settings'))return route.fulfill({headers,json:{user_id:'synthetic-brand-user',first_name:'Synthetic',last_name:'Patient',email:'synthetic@example.com',emergency_contacts:[]}})
    if(path.endsWith('/profile'))return route.fulfill({headers,json:{full_name:'Synthetic Clinician'}})
    if(path.endsWith('/profile-image'))return route.fulfill({headers,json:{image:null}})
    if(path.includes('/doctors'))return route.fulfill({headers,json:{doctors:Array.from({length:24},(_,index)=>({id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12,'0')}`,name:`Synthetic Physician ${index+1}`,specialty:'General Medicine',verification:'Verified',tags:['Primary care'],imageUrl:'',rating:0,reviews:0,experienceYears:5,nextAvailable:'Review availability',languages:['English'],hospital:'Synthetic Practice',consultationFee:0,insurance:['Self-pay'],gender:'other',consultationTypes:['video'],distanceKm:0,conditions:[]} satisfies PatientDoctor)),total:24,filtered_count:24,page:1,page_size:24,has_next:false,has_previous:false}})
    if(path.endsWith('/dashboard'))return route.fulfill({headers,json:{patient_name:'Synthetic Patient',upcoming_appointments:[],health_summary:{},notifications:[],recommended_doctors:[]}})
    return route.fulfill({headers,json:{}})
  })
}

for(const [role,portal,home] of [['PATIENT','patient','/patient/dashboard'],['PROVIDER','doctor','/doctor/dashboard'],['ADMIN','admin','/admin/dashboard']] as const) {
  test(`${portal} places its approved linked brand at the left of desktop and mobile navigation`,async({page,context})=>{
    await prepare(context,role)
    await page.setViewportSize({width:1440,height:1000})
    await page.goto('/support')
    const header=portal==='patient'?page.getByRole('navigation',{name:'Patient appearance'}):page.getByRole('banner',{name:portal==='doctor'?'Doctor main navigation':'Admin main navigation'})
    const brand=header.getByRole('link',{name:new RegExp(`Qarevo Health ${portal} dashboard`,'i')})
    await expect(brand).toHaveAttribute('href',home)
    const menu=header.getByRole('button',{name:'Hide sidebar',exact:true})
    expect((await brand.boundingBox())!.x).toBeLessThan((await menu.boundingBox())!.x)
    await expect(brand.locator('img:visible')).toHaveAttribute('src',/qarevo-logo-light\.svg/)
    await page.getByRole('button',{name:'Dark mode',exact:true}).click()
    await expect(brand.locator('img:visible')).toHaveAttribute('src',/qarevo-logo-dark\.svg/)
    await expect(page.getByRole('contentinfo').getByRole('link',{name:'Qarevo Health home',exact:true})).toHaveAttribute('href',home)
    for(const width of [820,390,320]) {
      await page.setViewportSize({width,height:900})
      const mobile=page.locator(portal==='patient'?'.pmn-topbar':portal==='doctor'?'.dmn-topbar':'.admin-mobile-navigation')
      await expect(mobile).toBeVisible()
      const logo=mobile.getByRole('link',{name:portal==='admin'?'Admin dashboard':new RegExp(`Qarevo Health ${portal} dashboard`,'i')})
      expect((await logo.boundingBox())!.x).toBeLessThan(30)
      await expect(logo).toHaveAttribute('href',home)
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    }
  })
}

for(const route of ['/patient/dashboard','/patient/find-doctor']) {
  test(`${route} holds both desktop rails below the navbar and within the footer boundary`,async({page,context})=>{
    await prepare(context,'PATIENT')
    await page.setViewportSize({width:1600,height:900})
    await page.goto(route)
    if(route==='/patient/find-doctor')await expect(page.getByText('Page 1 · Showing 24 of 24',{exact:true})).toBeVisible()
    const rail=page.locator('#patient-secondary-sidebar > .portal-sidebar-content')
    await expect(rail).toBeVisible()
    const heading=page.locator('.patient-application h2').first()
    await expect(heading).toHaveCSS('font-size','20px')
    await expect(heading).toHaveCSS('font-weight','800')
    await expect(heading).toHaveCSS('margin-bottom','14px')
    await expect(heading).toHaveCSS('margin-top','0px')
    const nav=page.getByRole('navigation',{name:'Patient appearance'})
    const start=await rail.boundingBox()
    expect(start!.y).toBeGreaterThanOrEqual((await nav.boundingBox())!.height)
    await page.evaluate(()=>window.scrollTo(0,420))
    await expect.poll(async()=>Math.round((await rail.boundingBox())!.y)).toBe(Math.round(start!.y))
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
    const footer=await page.getByRole('contentinfo').boundingBox()
    const end=await rail.boundingBox()
    expect(end!.y+end!.height).toBeLessThanOrEqual(footer!.y+1)
    await page.evaluate(()=>window.scrollTo(0,0))
    await page.getByRole('button',{name:'Hide right sidebar',exact:true}).click()
    await expect(page.locator('#patient-secondary-sidebar')).toBeHidden()
    await expect(page.locator('#patient-primary-sidebar')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button',{name:'Show right sidebar',exact:true})).toBeVisible()
    await page.setViewportSize({width:820,height:900})
    await expect(page.locator('#patient-secondary-sidebar')).toBeHidden()
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  })
}

test('doctor cards use brand tokens and accessible contrast in both themes',async({page,context})=>{
  await prepare(context,'PATIENT')
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto('/patient/find-doctor')
  await expect(page.getByText('Page 1 · Showing 24 of 24',{exact:true})).toBeVisible()
  const card=page.locator('.doctor-card').first()
  await expect(card).toBeVisible()
  const color=()=>card.evaluate(node=>({background:getComputedStyle(node).backgroundColor,text:getComputedStyle(node.querySelector('.doctor-card-name')!).color,border:getComputedStyle(node).borderTopColor,font:getComputedStyle(node).fontFamily}))
  const light=await color()
  expect(light.font.toLowerCase()).toContain('public')
  await page.getByRole('button',{name:'Dark mode',exact:true}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  await expect.poll(async()=> (await color()).background).not.toBe(light.background)
  const dark=await color()
  expect(dark.background).not.toBe(light.background)
  expect(dark.text).not.toBe(light.text)
  await card.hover()
  await expect.poll(async()=> (await color()).background).not.toBe(dark.background)
  await page.mouse.move(0,0)
  await expect.poll(async()=> (await color()).background).toBe(dark.background)
  const luminance=(rgb:string)=>{
    const channels=rgb.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n=>{const s=n/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)})
    return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]
  }
  const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
  expect(contrast(light.text,light.background)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(dark.text,dark.background)).toBeGreaterThanOrEqual(4.5)
})
