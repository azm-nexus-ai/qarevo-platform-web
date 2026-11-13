import {seedPortalSession} from './helpers/portal-session'
import { test, expect, type BrowserContext } from '@playwright/test'
const id='11111111-1111-4111-8111-111111111111'
const appt='22222222-2222-4222-8222-222222222222'
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
const doctor={id,name:'Dr. Synthetic Clinician',specialty:'General Medicine',hospital:'Synthetic Practice',imageUrl:'/icons/missing-synthetic.png',consultationFee:0,experienceYears:5,rating:0,reviews:0,languages:['German'],insurance:['Self pay'],gender:'female',consultationTypes:['video'],distanceKm:0,conditions:[],verification:'Verified',tags:[]}
async function signedIn(context:BrowserContext){
  const identity = await seedPortalSession(context, 'patient', {user_id:'synthetic-patient'})
  const control={appointmentFails:false,doctorsFail:false,emptyDoctors:false,reads:0}
  await context.route('**/api/v1/**',route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors})
    const path=new URL(route.request().url()).pathname
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if(path==='/api/v1/session'||path==='/api/v1/session/activity')return route.fulfill({headers:cors,json:{browser_session:identity,server_time:new Date().toISOString(),idle_expires_at:new Date(Date.now()+900000).toISOString(),absolute_expires_at:new Date(Date.now()+28800000).toISOString(),warning_seconds:120,idle_timeout_seconds:900}})
    if(path==='/api/v1/patient/settings')return route.fulfill({headers:cors,json:{user_id:'synthetic-patient',first_name:'Synthetic',last_name:'Patient',email:'synthetic@example.com',emergency_contacts:[]}})
    if(path.endsWith('/settings/onboarding'))return route.fulfill({headers:cors,json:{complete:true,next_step:null,completed_steps:['personal','contact','health','coverage'],personal:{},contact:{},health:{},coverage:{}}})
    if(path===`/api/v1/patient/appointments/${appt}`){control.reads++;return route.fulfill({headers:cors,status:control.appointmentFails?503:200,json:control.appointmentFails?{detail:'Synthetic appointment read unavailable'}:{id:appt,provider_id:id,provider_name:doctor.name,specialty:doctor.specialty,consultation_id:'33333333-3333-4333-8333-333333333333',start_at:'2030-07-10T07:00:00Z',end_at:'2030-07-10T07:30:00Z',time_zone:'Europe/Berlin',status:'BOOKED'}})}
    if(path==='/api/v1/patient/doctors')return route.fulfill({headers:cors,status:control.doctorsFail?503:200,json:control.doctorsFail?{detail:'Synthetic physician search unavailable'}:{doctors:control.emptyDoctors?[]:[doctor],total:control.emptyDoctors?0:1,filtered_count:control.emptyDoctors?0:1,has_next:false,has_previous:false}})
    if(path.endsWith('/patient/doctors/recommended'))return route.fulfill({headers:cors,json:{doctors:[]}})
    if(path===`/api/v1/patient/doctors/${id}`)return route.fulfill({headers:cors,json:doctor})
    return route.fulfill({headers:cors,status:404,json:{detail:'Synthetic fixture missing: '+path}})
  })
  return control
}

for(const [portal,path] of [['patient','/auth/sign-in'],['clinician','/auth/doctor/login']] as const){
  test(`${portal} social controls fail closed without provider configuration`,async({page,context})=>{
    await context.route(url=>url.pathname==='/api/v1/auth/social/providers',route=>route.fulfill({json:{google:{enabled:false,message:'pending'},apple:{enabled:false,message:'pending'}}}))
    await page.goto(path)
    await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeDisabled()
    await expect(page.getByRole('button',{name:'Continue with Apple',exact:true})).toBeDisabled()
    await expect(page.getByRole('status').filter({hasText:'company provider configuration'})).toBeVisible()
    await expect(page).toHaveURL(new RegExp(path+'$'))
  })
}

test('provider callback rejects missing browser transaction and scrubs credentials from URL',async({page,context})=>{
  let exchanges=0
  await context.route('**/api/v1/auth/social/**/finish',route=>{exchanges++;return route.fulfill({status:400,json:{detail:'unexpected request'}})})
  await page.goto('/auth/social/callback?code=synthetic-secret-code&state=unmatched-state')
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Start again in this browser tab')
  await expect(page).toHaveURL(/\/auth\/social\/callback$/)
  expect(exchanges).toBe(0)
})

test('provider cancellation is visible and never fabricates a signed-in session',async({page})=>{
  await page.goto('/auth/social/callback#error=access_denied&state=synthetic-cancelled')
  await expect(page.getByRole('main').getByRole('alert')).toContainText('cancelled or declined')
  expect(await page.evaluate(()=>localStorage.getItem('qarevo_access_token'))).toBeNull()
  await expect(page).toHaveURL(/\/auth\/social\/callback$/)
})

for(const width of [320,820,1440]){
  test(`saved booking confirmation is authoritative and responsive at ${width}px`,async({page,context})=>{
    const control=await signedIn(context)
    await page.setViewportSize({width,height:1000})
    await page.goto(`/patient/consultation-booking/success?appointmentId=${appt}&physicianName=Forged&date=1999-01-01&slot=1PM`)
    await expect(page.getByRole('heading',{name:'Your consultation is booked',exact:true})).toBeVisible()
    await expect(page.getByRole('heading',{name:doctor.name,exact:true})).toBeVisible()
    await expect(page.getByText(appt,{exact:true})).toBeVisible()
    await expect(page.getByRole('link',{name:'View appointment details',exact:true})).toHaveAttribute('href',`/patient/appointment-details?appointmentId=${appt}`)
    await expect(page.locator('body')).not.toContainText('Forged')
    await expect(page.locator('body')).not.toContainText('email has been sent')
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    expect(control.reads).toBe(1)
    const download=page.waitForEvent('download')
    await page.getByRole('button',{name:'Download calendar event'}).click()
    expect((await download).suggestedFilename()).toBe('qarevo-appointment.ics')
  })
}

test('booking confirmation never trusts URL-only claims and retries a failed saved record',async({page,context})=>{
  const control=await signedIn(context)
  await page.goto(`/patient/consultation-booking/success?physicianId=${id}&date=2030-07-10&slot=9AM`)
  await expect(page.getByRole('heading',{name:'Booking confirmation unavailable',exact:true})).toBeVisible()
  await expect(page.getByText('No saved appointment was selected.',{exact:false})).toBeVisible()
  control.appointmentFails=true
  await page.goto(`/patient/consultation-booking/success?appointmentId=${appt}`)
  await expect(page.getByRole('alert').filter({hasText:'Synthetic appointment read unavailable'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Your consultation is booked',exact:true})).toHaveCount(0)
  control.appointmentFails=false
  await page.getByRole('button',{name:'Retry loading booking'}).click()
  await expect(page.getByRole('heading',{name:'Your consultation is booked',exact:true})).toBeVisible()
  expect(control.reads).toBe(2)
})

test('physicians list uses accessible fallback and bounded booking URLs',async({page,context})=>{
  await signedIn(context)
  await page.goto('/patient/physicians')
  await expect(page.getByRole('img',{name:`Profile image unavailable for ${doctor.name}`})).toBeVisible()
  const hrefs=await page.locator('a[href*="consultation-booking"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')||''))
  expect(hrefs.length).toBeGreaterThan(0)
  for(const href of hrefs){expect(href.length).toBeLessThan(700);expect(href).not.toMatch(/physicianImageUrl|physicianName|data%3A|medicalHistory/)}
})
