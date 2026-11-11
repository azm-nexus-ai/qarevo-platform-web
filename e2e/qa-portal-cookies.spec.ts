import { test, expect, type Page } from '@playwright/test'
import http from 'node:http'
import { randomUUID } from 'node:crypto'

// Real browser -> Next route -> isolated synthetic HTTP identity service.
// Backend JWT/role authority is tested separately in the FastAPI integration suite.
test.describe.configure({mode:'serial'})
const families=new Map<string,{portal:string;user_id:string;session_id:string;provider_id?:string}>()
const refreshes=new Map<string,string>()
const forwardedReferences:string[]=[]
const roles:Record<string,string>={patient:'PATIENT',doctor:'PROVIDER',admin:'ADMIN'}
let server:http.Server
function issue(portal:string) {
  const session_id=randomUUID(),user_id=`synthetic-${portal}`
  families.set(session_id,{portal,user_id,session_id,...(portal==='doctor'?{provider_id:'synthetic-provider'}:{})})
  return rotate(session_id)
}
function rotate(sid:string) {
  const refresh=randomUUID();refreshes.set(refresh,sid)
  return {access_token:`header.${Buffer.from(JSON.stringify({sid})).toString('base64url')}.synthetic-private-signature`,refresh_token:refresh,expires_in:900}
}
test.beforeAll(async()=>{
  server=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk
    const body=raw?JSON.parse(raw):{},path=new URL(req.url!,'http://localhost').pathname
    res.setHeader('Content-Type','application/json')
    const reference=String(req.headers['x-request-id']||'');forwardedReferences.push(reference);res.setHeader('X-Request-ID',reference)
    const finish=(data:unknown,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data))}
    if(path==='/api/v1/auth/social/providers')return finish({google:{enabled:false,message:'Synthetic fixture'},apple:{enabled:false,message:'Synthetic fixture'}})
    if(path==='/api/v1/auth/login')return finish(issue('patient'))
    if(path==='/api/v1/auth/admin/login')return finish(issue('admin'))
    if(path==='/api/v1/auth/doctor/login')return finish({temp_token:'synthetic-mfa-private',expires_in:300,identifier:'synthetic@example.test'})
    if(path==='/api/v1/auth/mfa/verify-email')return req.headers.authorization==='Bearer synthetic-mfa-private'?finish(issue('doctor')):finish({detail:'Invalid challenge'},401)
    if(path==='/api/v1/auth/logout'){const sid=refreshes.get(body.refresh_token);if(sid)families.delete(sid);return finish({message:'Signed out'})}
    if(path==='/api/v1/auth/refresh'){const sid=refreshes.get(body.refresh_token);if(!sid||!families.has(sid))return finish({detail:'Expired'},401);refreshes.delete(body.refresh_token);return finish(rotate(sid))}
    const token=req.headers.authorization?.replace('Bearer ','')
    let sid='';try{sid=JSON.parse(Buffer.from(token!.split('.')[1],'base64url').toString()).sid}catch{}
    const identity=families.get(sid)
    if(!identity)return finish({detail:'Authentication required'},401)
    return finish({...identity,role:roles[identity.portal],server_time:new Date().toISOString(),idle_expires_at:new Date(Date.now()+900000).toISOString(),absolute_expires_at:new Date(Date.now()+28800000).toISOString(),warning_seconds:120,idle_timeout_seconds:900})
  })
  await new Promise<void>(resolve=>server.listen(3101,'127.0.0.1',resolve))
})
test.afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()))})
async function call(page:Page,portal:string,path:string,method='GET',body?:unknown,session?:string) {
  return page.evaluate(async({portal,path,method,body,session})=>{
    const headers:Record<string,string>={'X-Qarevo-Portal':portal,'X-Request-ID':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}
    if(session)headers['X-Qarevo-Session']=session
    if(method!=='GET'){
      const csrf=await fetch('/api/v1/browser-csrf',{headers:{'X-Qarevo-Portal':portal}}).then(r=>r.json())
      headers['X-Qarevo-CSRF']=csrf.csrf_token;headers['Content-Type']='application/json'
    }
    const response=await fetch(path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})})
    return {status:response.status,requestId:response.headers.get('X-Request-ID'),body:await response.json()}
  },{portal,path,method,body,session})
}
test('three HttpOnly portal sessions coexist; logout and refresh affect only their own family',async({context,page})=>{
  await page.goto('/auth/sign-in')
  const identities:Record<string,{session_id:string}>= {}
  for(const portal of ['patient','doctor','admin']){
    const path=portal==='patient'?'/api/v1/auth/login':`/api/v1/auth/${portal}/login`
    let result=await call(page,portal,path,'POST',{email:'synthetic@example.test',password:'synthetic-test-only'})
    if(portal==='doctor'){
      expect(result.body.mfa_pending).toBe(true);expect(result.body.temp_token).toBeUndefined()
      result=await call(page,portal,'/api/v1/auth/mfa/verify-email','POST',{code:'123456'})
    }
    expect(result.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);expect(result.requestId).not.toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');expect(forwardedReferences).toContain(result.requestId)
    expect(result.status).toBe(200);expect(result.body.access_token).toBeUndefined();expect(result.body.refresh_token).toBeUndefined()
    identities[portal]=result.body.browser_session
  }
  const cookies=await context.cookies()
  for(const portal of ['patient','doctor','admin']){
    const own=cookies.filter(cookie=>cookie.name===`qarevo_${portal}_access`||cookie.name===`qarevo_${portal}_refresh`)
    expect(own).toHaveLength(2);expect(own.every(cookie=>cookie.httpOnly&&cookie.path==='/'&&cookie.sameSite==='Lax')).toBe(true)
    expect((await call(page,portal,'/api/v1/session')).status).toBe(200)
  }
  expect(await page.evaluate(()=>document.cookie)).not.toMatch(/_(?:access|refresh|mfa)=/)
  const renewed=await call(page,'patient','/api/v1/auth/refresh','POST',{},identities.patient.session_id)
  expect(renewed.status).toBe(200);expect(renewed.body.browser_session.session_id).toBe(identities.patient.session_id)
  expect((await call(page,'patient','/api/v1/auth/logout','POST',{},identities.patient.session_id)).status).toBe(200)
  expect((await call(page,'patient','/api/v1/session')).status).toBe(401)
  expect((await call(page,'doctor','/api/v1/session')).status).toBe(200)
  expect((await call(page,'admin','/api/v1/session')).status).toBe(200)
  expect((await call(page,'doctor','/api/v1/admin/dashboard')).status).toBe(403)
  expect((await call(page,'doctor','/api/v1/auth/logout','POST',{},'stale-session')).status).toBe(409)
  expect((await call(page,'doctor','/api/v1/session')).status).toBe(200)
})
