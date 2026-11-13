import {seedPortalSession} from './helpers/portal-session'
import {test,expect,type BrowserContext} from '@playwright/test'

const appointmentId='88888888-8888-4888-8888-888888888888'
const consultationId='99999999-9999-4999-8999-999999999999'
const episodeId='77777777-7777-4777-8777-777777777777'
async function prepare(context:BrowserContext) {
  const identity = await seedPortalSession(context, 'doctor', {user_id:'synthetic-clinician'})
  const state={joins:0,metadata:0,release:()=>{},hold:false}
  await context.route('**/api/v1/**',async route=>{
    const path=new URL(route.request().url()).pathname
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
    if(path.startsWith('/api/v1/session'))return route.fulfill({headers,json:{browser_session:identity,server_time:new Date().toISOString(),idle_expires_at:new Date(Date.now()+900000).toISOString(),absolute_expires_at:new Date(Date.now()+28800000).toISOString(),warning_seconds:120,idle_timeout_seconds:900}})
    if(path.endsWith('/doctor/profile'))return route.fulfill({headers,json:{full_name:'Synthetic Clinician',specialty:'General Medicine'}})
    if(path.endsWith('/doctor/dashboard'))return route.fulfill({headers,json:{stats:{today_appointments:1,pending_patients:0,assigned_episodes:0,ai_drafts_ready:0},recent_appointments:[{appointment_id:appointmentId,patient_name:'Synthetic Patient',scheduled_time:'2030-07-10T08:00:00Z',status:'BOOKED'}],recent_consultations:[]}})
    if(path.endsWith('/doctor/episodes'))return route.fulfill({headers,json:{episodes:[],total_count:0,page:1,page_size:25,has_next:false,has_previous:false}})
    if(path.endsWith(`/doctor/appointments/${appointmentId}`))return route.fulfill({headers,json:{appointment_id:appointmentId,patient_id:'synthetic-patient',patient_name:'Synthetic Patient',status:'BOOKED',start_at:'2030-07-10T08:00:00Z',end_at:'2030-07-10T08:30:00Z',created_at:'2030-07-09T08:00:00Z',consultation_id:consultationId,episode_id:episodeId,ai_draft_ready:true,ai_available:true,chief_complaint:'Synthetic intake',clinical_context_available:true}})
    if(path.endsWith(`/workspace/${consultationId}`))return route.fulfill({headers,json:{consultation:{consultation_id:consultationId,episode_id:episodeId,patient_name:'Synthetic Patient',status:'STARTED',patient_id:'synthetic-patient',scheduled_time:'2030-07-10T08:00:00Z'},can_join_video:true,can_complete:true}})
    if(path.endsWith('/clinical-record'))return route.fulfill({headers,json:{draft:null,published:null}})
    if(path.endsWith(`/consultations/${consultationId}`)){state.metadata++;return route.fulfill({headers,json:{consultation_id:consultationId,status:'SCHEDULED',scheduled_at:'2030-07-10T08:00:00Z',patient_name:'Synthetic Patient',provider_names:['Synthetic Clinician'],episode_id:episodeId}})}
    if(path.endsWith('/video-session/join')){state.joins++;if(state.hold)await new Promise<void>(resolve=>{state.release=resolve});return route.fulfill({headers,status:503,json:{detail:'Synthetic video provider unavailable. Retry or return to appointments.'}})}
    return route.fulfill({headers,status:404,json:{detail:'No synthetic record'}})
  })
  return state
}

test('recent appointment dark hover returns to its actual normal state and supports keyboard focus',async({page,context})=>{
  await prepare(context);await page.goto('/doctor/dashboard')
  await page.getByRole('button',{name:'Dark mode',exact:true}).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  const row=page.getByRole('button').filter({hasText:'Synthetic Patient'})
  await expect(row).toBeVisible()
  await page.mouse.move(0,0)
  const colors=await row.evaluate(element=>{
    const probe=document.createElement('span')
    probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none'
    element.append(probe)
    probe.style.backgroundColor='var(--surface-subtle)'
    const normal=getComputedStyle(probe).backgroundColor
    probe.style.backgroundColor='var(--surface-hover)'
    const hover=getComputedStyle(probe).backgroundColor
    probe.remove()
    return {normal,hover}
  })
  // A theme change animates the row's background. Capture the resting state
  // only after it reaches the new semantic color, rather than during transition.
  await expect(row).toHaveCSS('background-color',colors.normal)
  const normal=await row.evaluate(element=>getComputedStyle(element).backgroundColor)
  await row.hover()
  await expect(row).toHaveCSS('background-color',colors.hover)
  expect(colors.hover).not.toBe(normal)
  await page.mouse.move(0,0)
  await expect.poll(()=>row.evaluate(element=>getComputedStyle(element).backgroundColor)).toBe(normal)
  await row.focus();await expect(row).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/doctor/appointments/${appointmentId}$`))
})

test('saved AI draft action survives navigation, reload and workspace reentry',async({page,context})=>{
  await prepare(context);await page.goto(`/doctor/appointments/${appointmentId}`)
  const action=page.getByRole('button',{name:'View AI Draft',exact:true})
  await expect(action).toBeVisible();await page.reload();await expect(action).toBeVisible()
  await page.goto(`/doctor/workspace/${consultationId}`)
  const review=page.getByRole('button',{name:'View Intake & AI Draft',exact:true})
  await expect(review).toBeVisible();await page.reload();await expect(review).toBeVisible()
  await review.click();await expect(page).toHaveURL(new RegExp(`/doctor/episodes/${episodeId}$`))
})

for(const width of [320,820,1440]) {
  test(`video room at ${width}px retains role context, theme and no automatic video join`,async({page,context})=>{
    const state=await prepare(context);await page.setViewportSize({width,height:1000})
    await page.goto(`/doctor/video-consultation?consultationId=${consultationId}`)
    await expect(page.getByRole('heading',{name:'Consultation video room',exact:true})).toBeVisible()
    await expect(page.getByText('Synthetic Patient',{exact:true}).first()).toBeVisible()
    await expect(page.getByRole('button',{name:'Join consultation',exact:true})).toBeVisible()
    await expect(page.getByRole('link',{name:'View AI Draft & Intake',exact:true})).toHaveAttribute('href',`/doctor/episodes/${episodeId}`)
    expect(state.joins).toBe(0);expect(state.metadata).toBe(1)
    await page.getByRole('button',{name:'Dark mode',exact:true}).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    await page.getByRole('button',{name:'Join consultation',exact:true}).focus()
    await expect(page.getByRole('button',{name:'Join consultation',exact:true})).toBeFocused()
  })
}

test('video joins once during pending handshake and failures expose a genuine retry',async({page,context})=>{
  const state=await prepare(context);state.hold=true
  await page.goto(`/doctor/video-consultation?consultationId=${consultationId}`)
  await page.getByRole('button',{name:'Join consultation',exact:true}).click()
  await expect.poll(()=>state.joins).toBe(1)
  await expect(page.getByRole('button',{name:'Join consultation',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Leave call',exact:true})).toBeVisible()
  state.hold=false;state.release()
  await expect(page.getByRole('alert').filter({hasText:'Synthetic video provider unavailable'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Join consultation',exact:true})).toBeEnabled()
  expect(state.joins).toBe(1)
})
