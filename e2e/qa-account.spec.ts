import {test,expect,type BrowserContext} from '@playwright/test'

async function account(context:BrowserContext,role='ADMIN') {
  await context.addInitScript(role=>{localStorage.setItem('qarevo_access_token','synthetic-qa-token');localStorage.setItem('qarevo_refresh_token','synthetic-qa-refresh');localStorage.setItem('qarevo_user_id','synthetic-qa');localStorage.setItem('qarevo_role',role)},role)
  let securityFails=false
  const actions:string[]=[]
  await context.route('**/api/v1/**',async route=>{
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
    const path=new URL(route.request().url()).pathname
    if(path.startsWith('/api/v1/session'))return route.fulfill({headers,json:{server_time:new Date().toISOString(),idle_expires_at:new Date(Date.now()+900000).toISOString(),absolute_expires_at:new Date(Date.now()+28800000).toISOString(),warning_seconds:120,idle_timeout_seconds:900}})
    if(path==='/api/v1/security')return route.fulfill(securityFails?{headers,status:503,json:{detail:'Security temporarily unavailable'}}:{headers,json:{password_change_available:true,mfa:{available:false,enabled:false,method:null,message:'Two-factor enrollment is not available for this role yet.'},sessions:[{id:'own-current',current:true,device_name:'Synthetic browser',browser_name:'Chrome',operating_system:'Test',created_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString()}],sessions_total:1}})
    if(path.startsWith('/api/v1/security/')){actions.push(path);return route.fulfill({headers,json:{message:'Security action completed',current_session_revoked:path.endsWith('revoke-all'),sign_in_required:path.endsWith('/password')}})}
    return route.fulfill({headers,status:404,json:{detail:'No synthetic fixture'}})
  })
  return {actions,setFails:(value:boolean)=>{securityFails=value}}
}

test('admin security retries its request, explains unavailable MFA, revokes sessions and changes password',async({page,context})=>{
  const state=await account(context)
  state.setFails(true)
  await page.setViewportSize({width:320,height:900})
  await page.goto('/admin/settings')
  await expect(page.getByText('Security temporarily unavailable')).toBeVisible()
  state.setFails(false)
  await page.getByRole('button',{name:'Retry security settings'}).click()
  await expect(page.getByRole('button',{name:'Two-factor enrollment unavailable'})).toBeDisabled()
  await page.getByRole('button',{name:'Sign out other devices'}).click()
  await page.getByRole('alertdialog').getByRole('button',{name:'Sign out other devices',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Security action completed'})).toBeVisible()
  await page.getByRole('button',{name:'Change password and sign out'}).click()
  await expect(page.getByRole('alert').filter({hasText:'Enter your current password.'})).toBeVisible()
  await page.getByLabel('Current password (Required)',{exact:true}).fill('Synthetic-old-password42!')
  await page.getByLabel('New password (Required)',{exact:true}).fill('Synthetic-new-password42!')
  await page.getByLabel('Confirm new password (Required)',{exact:true}).fill('Synthetic-new-password42!')
  await page.getByRole('button',{name:'Change password and sign out'}).click()
  await expect(page).toHaveURL(/\/auth\/admin\/login$/)
  expect(state.actions).toEqual(['/api/v1/security/sessions/revoke-others','/api/v1/security/password'])
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})
