import {expect,type BrowserContext} from '@playwright/test'
import {seedPortalSession,testSessionTiming} from './portal-session'

/** Browser contract fixtures use public metadata, never JavaScript bearer credentials. */
export async function patientApiFixture(context:BrowserContext) {
  const identity=await seedPortalSession(context,'patient')
  const state={insurance:null as Record<string,unknown>|null,insuranceWrites:0,timeZone:'Europe/Berlin',timezoneReads:0}
  await context.route('**/api/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname
    expect(request.headers()['authorization']).toBeUndefined()
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if(path.startsWith('/api/v1/session'))return route.fulfill({json:testSessionTiming(identity)})
    if(path.endsWith('/patient/settings'))return route.fulfill({json:{user_id:identity.user_id,first_name:'Synthetic',last_name:'Patient',email:'synthetic-patient@example.test',emergency_contacts:[],insurance:state.insurance,time_zone:state.timeZone}})
    if(path.endsWith('/patient/settings/health-info'))return route.fulfill({json:{blood_type:'',allergies:'',medical_conditions:''}})
    if(path.endsWith('/patient/settings/passkeys/status'))return route.fulfill({json:{available:false,enabled:false,credential_count:0,message:'Not enabled in synthetic fixture'}})
    if(path.endsWith('/profile-image'))return route.fulfill({json:{image:null}})
    if(path.endsWith('/patient/settings/insurance')&&['POST','PUT'].includes(request.method())){
      expect(request.headers()['x-qarevo-portal']).toBe('patient')
      expect(request.headers()['x-qarevo-csrf']).toBe('synthetic-csrf')
      state.insuranceWrites++
      state.insurance={id:'synthetic-insurance',...request.postDataJSON()}
      return route.fulfill({json:state.insurance})
    }
    if(path.endsWith('/patient/settings/timezone')){
      state.timezoneReads++
      return route.fulfill({json:{time_zone:state.timeZone}})
    }
    if(path.endsWith('/patient/doctors/synthetic-doctor'))return route.fulfill({json:{id:'synthetic-doctor',name:'Synthetic Clinician',specialty:'General medicine',insurance:['Self pay'],languages:['English'],services:[{type:'video',duration:'30 min',price:50}]}})
    if(path.endsWith('/booking-datetime/availability'))return route.fulfill({json:{provider_id:'synthetic-doctor',availability:[],working_hours:{start:'09:00',end:'17:00',timezone:state.timeZone},available_days:[]}})
    if(path.endsWith('/booking-datetime/slots'))return route.fulfill({json:{date:url.searchParams.get('date'),slots:[],slot_details:[],schedule_ready:true,working_hours:{timezone:state.timeZone}}})
    if(path.endsWith('/security'))return route.fulfill({json:{password_change_available:true,mfa:{available:false,enabled:false,message:'Not enabled in synthetic fixture'},sessions:[],sessions_total:0}})
    return route.fulfill({status:404,json:{detail:'No synthetic fixture: '+path}})
  })
  return state
}
