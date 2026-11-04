import {test,expect,type BrowserContext} from '@playwright/test'
const episode='77777777-7777-4777-8777-777777777777'
async function prepare(context:BrowserContext){
 await context.addInitScript(()=>{localStorage.setItem('qarevo_access_token','synthetic-patient');localStorage.setItem('qarevo_refresh_token','synthetic-refresh');localStorage.setItem('qarevo_user_id','synthetic-patient');localStorage.setItem('qarevo_role','PATIENT')})
 const state={created:0,saved:0,fail:true,finish:()=>{}}
 await context.route('**/api/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
  if(path.startsWith('/api/v1/session'))return route.fulfill({headers,json:{server_time:new Date().toISOString(),idle_expires_at:new Date(Date.now()+900000).toISOString(),absolute_expires_at:new Date(Date.now()+28800000).toISOString(),warning_seconds:120,idle_timeout_seconds:900}})
  if(path.endsWith('/patient/settings'))return route.fulfill({headers,json:{first_name:'Synthetic',last_name:'Patient',emergency_contacts:[]}})
  if(path.endsWith('/profile-image'))return route.fulfill({headers,json:{image:null}})
  if(path.endsWith('/patient/episodes')){state.created++;return route.fulfill({headers,json:{id:episode}})}
  if(path.endsWith(`/episodes/${episode}/intake/submit`)){
   state.saved++;expect(route.request().postDataJSON().field_values.chief_complaint).toBe('Synthetic concern for clinical review')
   if(state.fail)return route.fulfill({headers,status:503,json:{detail:'Synthetic clinical persistence unavailable. Please retry.'}})
   await new Promise<void>(resolve=>{state.finish=resolve})
   return route.fulfill({headers,json:{submitted_at:new Date().toISOString(),ai_draft:{status:'queued'}}})
  }
  if(path.includes('/patient/doctors/'))return route.fulfill({headers,json:{id:'synthetic-doctor',name:'Assigned Clinician',insurance:['Self pay'],languages:['English'],services:[{type:'video',duration:'30 min',price:50}]}})
  if(path.endsWith('/patient/appointments'))return route.fulfill({headers,json:{time_zone:'Europe/Berlin',appointments:[{id:'photo-a',provider_id:'doctor-a',provider_name:'Assigned Doctor Alpha',provider_image_url:'/synthetic-alpha.png',start_at:new Date(Date.now()+600000).toISOString(),end_at:new Date(Date.now()+2400000).toISOString(),status:'BOOKED'},{id:'photo-b',provider_id:'doctor-b',provider_name:'Assigned Doctor Beta',provider_image_url:'/synthetic-beta.png',start_at:new Date(Date.now()+4200000).toISOString(),end_at:new Date(Date.now()+6000000).toISOString(),status:'BOOKED'},{id:'photo-c',provider_id:'doctor-c',provider_name:'Assigned Doctor Gamma',provider_image_url:null,start_at:new Date(Date.now()+6600000).toISOString(),end_at:new Date(Date.now()+8400000).toISOString(),status:'BOOKED'}]}})
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
 await page.locator('#clinical-intake-form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
 expect(state.created).toBe(1);expect(state.saved).toBe(2)
 state.finish()
 await expect(page).toHaveURL(new RegExp(`/review\\?.*episode_id=${episode}`))
 expect(new URL(page.url()).searchParams.has('chief_complaint')).toBe(false)
})

test('appointment avatars belong to their assigned doctors and never substitute a third photo',async({page,context})=>{
 await prepare(context)
 await context.route('**/synthetic-*.png',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}))
 await page.goto('/patient/appointments')
 await expect(page.getByRole('img',{name:'Assigned Doctor Alpha, physician',exact:true})).toHaveAttribute('src','/synthetic-alpha.png')
 await expect(page.getByRole('img',{name:'Assigned Doctor Beta, physician',exact:true})).toHaveAttribute('src','/synthetic-beta.png')
 await expect(page.getByRole('img',{name:'Profile image unavailable for Assigned Doctor Gamma',exact:true})).toBeVisible()
 await expect(page.locator('img[src="/icons/profilePic.svg"]')).toHaveCount(0)
})
