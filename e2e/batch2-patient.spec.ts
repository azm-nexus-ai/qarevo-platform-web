import {seedPortalSession} from './helpers/portal-session'
import {test,expect,type BrowserContext} from '@playwright/test'
import type {PatientDoctor} from '../lib/api'
const episode='77777777-7777-4777-8777-777777777777'
async function prepare(context:BrowserContext, now=Date.now()){
 const identity = await seedPortalSession(context, 'patient', {user_id:'synthetic-patient'})
 const state={created:0,saved:0,fail:true,finish:()=>{}}
 await context.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname
  if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  if(path.startsWith('/api/v1/session'))return route.fulfill({headers,json:{browser_session:identity,server_time:new Date(now).toISOString(),idle_expires_at:new Date(now+900000).toISOString(),absolute_expires_at:new Date(now+28800000).toISOString(),warning_seconds:120,idle_timeout_seconds:900}})
  if(path.endsWith('/patient/settings'))return route.fulfill({headers,json:{first_name:'Synthetic',last_name:'Patient',emergency_contacts:[]}})
  if(path.endsWith('/profile-image'))return route.fulfill({headers,json:{image:null}})
  if(path.endsWith('/patient/episodes')){state.created++;return route.fulfill({headers,json:{id:episode}})}
  if(path.endsWith(`/episodes/${episode}/intake/submit`)){
   state.saved++;expect(route.request().postDataJSON().field_values.chief_complaint).toBe('Synthetic concern for clinical review')
   if(state.fail)return route.fulfill({headers,status:503,json:{detail:'Synthetic clinical persistence unavailable. Please retry.'}})
   await new Promise<void>(resolve=>{state.finish=resolve})
   return route.fulfill({headers,json:{submitted_at:new Date(now).toISOString(),ai_draft:{status:'queued'}}})
  }
  if(path.includes('/patient/doctors/'))return route.fulfill({headers,json:{id:'synthetic-doctor',name:'Assigned Clinician',insurance:['Self pay'],languages:['English'],services:[{type:'video',duration:'30 min',price:50}]}})
  if(path.endsWith('/patient/appointments'))return route.fulfill({headers,json:{time_zone:'Europe/Berlin',appointments:[{id:'photo-a',provider_id:'doctor-a',provider_name:'Assigned Doctor Alpha',provider_image_url:'/synthetic-alpha.png',start_at:new Date(now+600000).toISOString(),end_at:new Date(now+2400000).toISOString(),status:'BOOKED'},{id:'photo-b',provider_id:'doctor-b',provider_name:'Assigned Doctor Beta',provider_image_url:'/synthetic-beta.png',start_at:new Date(now+4200000).toISOString(),end_at:new Date(now+6000000).toISOString(),status:'BOOKED'},{id:'photo-c',provider_id:'doctor-c',provider_name:'Assigned Doctor Gamma',provider_image_url:null,start_at:new Date(now+6600000).toISOString(),end_at:new Date(now+8400000).toISOString(),status:'BOOKED'}]}})
  return route.fulfill({headers,status:404,json:{detail:'No synthetic fixture'}})
 })
 return state
}

test('intake sends fields once, reuses the episode after failure, and blocks duplicate submissions',async({page,context})=>{
 const state=await prepare(context)
 await page.goto('/patient/consultation-booking/intake?physicianId=synthetic-doctor&service=video')
 await page.locator('textarea').first().fill('Synthetic concern for clinical review')
 await page.locator('input[type=checkbox]').first().check()
 await page.getByRole('button',{name:'Continue to Review',exact:true}).click()
 await expect(page.getByText('Synthetic clinical persistence unavailable. Please retry.',{exact:true})).toBeVisible()
 expect(state.created).toBe(1);expect(state.saved).toBe(1)
 state.fail=false
 await page.getByRole('button',{name:'Continue to Review',exact:true}).click()
 await expect(page.getByRole('status').filter({hasText:'Saving and submitting your intake'})).toBeVisible()
 await expect(page.locator('#clinical-intake-form')).toHaveAttribute('aria-busy','true')
 // aria-busy becomes visible before CSRF/request scheduling reaches the API.
 // Hold the actual retry in-flight before injecting another submit event.
 await expect.poll(()=>state.saved).toBe(2)
 await page.locator('#clinical-intake-form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 expect(state.created).toBe(1);expect(state.saved).toBe(2)
 state.finish()
 await expect(page).toHaveURL(new RegExp(`/review\\?.*episode_id=${episode}`))
 expect(new URL(page.url()).searchParams.has('chief_complaint')).toBe(false)
})

test('appointment avatars belong to their assigned doctors and never substitute a third photo',async({page,context})=>{
 // Both API fixtures and browser rendering use the same daytime clock so all
 // three bookings exercise today's list, including the second/third booking.
 const fixed=new Date('2030-06-10T10:00:00Z')
 await page.clock.install({time:fixed})
 await prepare(context,fixed.getTime())
 await context.route('**/api/v1/patient/appointments',async route=>route.fulfill({json:{time_zone:'Europe/Berlin',appointments:['Alpha','Beta','Gamma'].map((name,index)=>({id:`photo-${index}`,provider_id:`doctor-${index}`,provider_name:`Assigned Doctor ${name}`,provider_image_url:index===2?null:`/synthetic-${name.toLowerCase()}.png`,start_at:new Date(fixed.getTime()+(index+1)*3600000).toISOString(),end_at:new Date(fixed.getTime()+(index+1)*3600000+1800000).toISOString(),status:'BOOKED'}))}}))
 await context.route('**/synthetic-*.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}))
 await page.goto('/patient/appointments')
 const alpha=page.getByRole('img',{name:'Assigned Doctor Alpha, physician',exact:true})
 await expect(alpha).toHaveCount(2)
 for (const image of await alpha.all()) await expect(image).toHaveAttribute('src','/synthetic-alpha.png')
 await expect(page.getByRole('img',{name:'Assigned Doctor Beta, physician',exact:true})).toHaveAttribute('src','/synthetic-beta.png')
 await expect(page.getByRole('heading',{name:'Assigned Doctor Beta',exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'Assigned Doctor Gamma',exact:true})).toBeVisible()
 await expect(page.getByRole('img',{name:'Profile image unavailable for Assigned Doctor Gamma',exact:true})).toBeVisible()
 await expect(page.locator('img[src="/icons/profilePic.svg"]')).toHaveCount(0)
})

for (const width of [320, 820]) test(`intake actions and headings remain usable in both themes at ${width}px`, async ({page,context})=>{
 await prepare(context)
 await page.setViewportSize({width,height:900})
 await page.goto('/patient/consultation-booking/intake?physicianId=synthetic-doctor&service=video')
 for (const theme of ['light','dark']) {
  await page.evaluate(value=>document.documentElement.setAttribute('data-theme',value),theme)
  await expect(page.getByRole('heading',{name:'Tell us about your health concern',exact:true})).toHaveCSS('font-size','20px')
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  const submit=page.getByRole('button',{name:'Continue to Review',exact:true})
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeVisible()
  const bounds=await submit.boundingBox()
  expect(bounds).toBeTruthy()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width)
 }
})

for (const legacy of [true, false]) for (const width of [390, 1440]) {
 test(`patient navigation retains nonempty ${legacy ? 'legacy' : 'canonical'} recommendations and recent doctors at ${width}px`, async ({page,context})=>{
  await prepare(context)
  await page.setViewportSize({width,height:1000})
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  // These are the actual optional-field omissions in the previous recommended
  // and recent endpoints, rather than an idealised search result used for all.
  const base = {id:'11111111-1111-4111-8111-111111111111',name:'Dr. Synthetic Search',specialty:'General Practice',hospital:'Synthetic Practice',experienceYears:0,rating:0,reviews:0,consultationFee:0,nextAvailable:'Review availability',languages:[],insurance:[],gender:'other',consultationTypes:['video'],services:[],imageUrl:null,distanceKm:null} satisfies Omit<PatientDoctor,'verification'|'tags'|'conditions'>
  const search = {...base,verification:'Verified',tags:['Verified'],conditions:[]}
  const sparse = legacy ? {} : {verification:'Verified',tags:['Verified'],conditions:[]}
  const recent = {...base,...sparse,id:'22222222-2222-4222-8222-222222222222',name:'Dr. Synthetic Recent',lastBookingDate:'2026-11-01T10:00:00Z'}
  const recommended = {...base,...sparse,id:'33333333-3333-4333-8333-333333333333',name:'Dr. Synthetic Recommended',recommendationScore:60,recommendationReason:'Available clinician'}
  await context.route('**/api/v1/**',async route=>{
   const path=new URL(route.request().url()).pathname
   if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
   if(path==='/api/v1/patient/doctors/recommended')return route.fulfill({headers,json:{doctors:[recommended],recommendations:[recommended],total:1,filters:{}}})
   if(path==='/api/v1/patient/doctors/recent')return route.fulfill({headers,json:{recent_doctors:[recent],total:1}})
   if(path==='/api/v1/patient/doctors')return route.fulfill({headers,json:{doctors:[search],total:1,filtered_count:1,page:1,page_size:8,has_next:false,has_previous:false,filters:{}}})
   if(path==='/api/v1/patient/dashboard')return route.fulfill({headers,json:{patient_name:'Synthetic Patient',upcoming_appointments:[],health_summary:{},notifications:[]}})
   if(path==='/api/v1/patient/health-info')return route.fulfill({headers,json:{}})
   return route.fallback()
  })
  const recentCard=page.locator('.doctor-card').filter({hasText:'Dr. Synthetic Recent'})
  const recommendation=page.locator('.doctor-card').filter({hasText:'Dr. Synthetic Recommended'})
  await page.goto('/patient/dashboard')
  await expect(recentCard).toBeVisible()
  if(legacy){await expect(recentCard).toContainText('Verification unavailable');await expect(recentCard.locator('.doctor-card-verified')).toHaveCount(0)}
  await page.getByRole('button',{name:'Dark mode',exact:true}).click()
  for(let visit=0;visit<2;visit++){
   await page.getByRole('link',{name:'Open discovery →',exact:true}).click()
   await expect(page).toHaveURL(/\/patient\/find-doctor$/)
   await expect(recommendation).toBeVisible()
   if(legacy){await expect(recommendation).toContainText('Verification unavailable');await expect(recommendation.locator('.doctor-card-verified')).toHaveCount(0)}
   await expect(page.getByRole('heading',{name:'This page could not be displayed',exact:true})).toHaveCount(0)
   await page.getByRole('link',{name:/^Qarevo Health patient dashboard$/i}).filter({visible:true}).click()
   await expect(recentCard).toBeVisible()
   await page.reload()
   await expect(recentCard).toBeVisible()
   await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  }
  expect(errors).toEqual([])
 })
}
