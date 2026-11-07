import {test,expect,type BrowserContext} from '@playwright/test'
import {seedPortalSession,testSessionTiming} from './helpers/portal-session'

async function portal(context:BrowserContext,role:'patient'|'doctor') {
  const identity=await seedPortalSession(context,role)
  await context.route('**/api/v1/**',route=>{
    const request=route.request(),path=new URL(request.url()).pathname
    expect(request.headers()['authorization']).toBeUndefined()
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if(path.startsWith('/api/v1/session'))return route.fulfill(request.headers()['x-qarevo-portal']===role?{json:testSessionTiming(identity)}:{status:401,json:{detail:'This portal has no synthetic session'}})
    if(path.endsWith('/patient/billing'))return route.fulfill({json:{status:'not_configured',payment_provider_enabled:false,invoices:[],payment_methods:[],payment_history:[],upcoming_charges:[],insurance_summary:{status:'unverified'}}})
    if(path.endsWith('/doctor/profile'))return route.fulfill({json:{full_name:'Synthetic Clinician'}})
    if(path.endsWith('/doctor/workspace'))return route.fulfill({json:{consultations:[],total_count:0,filtered_count:0,page:1,has_next:false,has_previous:false}})
    if(path.endsWith('/doctor/episodes'))return route.fulfill({json:{episodes:[],total_count:0,filtered_count:0,page:1,has_next:false,has_previous:false}})
    if(path.endsWith('/auth/social/providers'))return route.fulfill({json:{google:{enabled:false},apple:{enabled:false}}})
    return route.fulfill({status:404,json:{detail:'No synthetic fixture'}})
  })
  return identity
}

for(const [role,path,title]of[['patient','/patient/billing','Billing & Payments'],['doctor','/doctor/workspace','Physician Workspace']]as const){
  test(`${role} portal retains only public identity metadata, never bearer credentials`,async({page,context})=>{
    const identity=await portal(context,role)
    await page.goto(path)
    await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible()
    const stored=await page.evaluate(portal=>JSON.parse(localStorage.getItem(`qarevo:${portal}:identity`)||'null'),role)
    expect(stored).toEqual(identity)
    expect(await page.evaluate(()=>localStorage.getItem('qarevo_access_token'))).toBeNull()
    expect(await page.evaluate(()=>localStorage.getItem('qarevo_refresh_token'))).toBeNull()
  })
}

for(const [role,target,signIn]of[['patient','/doctor/workspace','/auth/doctor/login'],['doctor','/patient/billing','/auth/sign-in']]as const){
  test(`${role} identity does not grant entry to an independently authenticated portal`,async({page,context})=>{
    const identity=await portal(context,role)
    await page.goto(target)
    await expect(page).toHaveURL(new RegExp(signIn+'\\?next='))
    const retained=await page.evaluate(portal=>JSON.parse(localStorage.getItem(`qarevo:${portal}:identity`)||'null'),role)
    expect(retained).toEqual(identity)
  })
}
