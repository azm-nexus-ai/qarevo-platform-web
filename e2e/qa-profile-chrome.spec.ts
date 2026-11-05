import {test, expect} from '@playwright/test'

for (const [width,height] of [[1440,600],[1440,1000],[921,700],[390,844]]) {
  test(`patient sign-in panel reaches its footer boundary without clipping at ${width}x${height}`,async({page,context},testInfo)=>{
    await context.route('**/api/**',route=>{
      const path=new URL(route.request().url()).pathname
      if(path.endsWith('/auth/social/providers'))return route.fulfill({json:{google:{enabled:false},apple:{enabled:false}}})
      return route.fallback()
    })
    await page.setViewportSize({width,height})
    await page.goto('/auth/sign-in')
    const panel=page.locator('.signin-left')
    const pageArea=page.locator('.signin-page')
    for(const theme of ['light','dark']) {
      const action=theme==='dark'?'Dark mode':'Light mode'
      const toggle=page.getByRole('button',{name:action,exact:true})
      if(await toggle.isVisible())await toggle.click()
      await expect(page.locator('html')).toHaveAttribute('data-theme',theme)
      if(width>860){
        await expect(panel).toBeVisible()
        const lastFeature=panel.getByText('Access your saved account information',{exact:true})
        await lastFeature.scrollIntoViewIfNeeded()
        await expect(lastFeature).toBeVisible()
        const panelBox=await panel.boundingBox(),pageBox=await pageArea.boundingBox(),featureBox=await lastFeature.boundingBox()
        expect(panelBox).toBeTruthy();expect(pageBox).toBeTruthy();expect(featureBox).toBeTruthy()
        expect(Math.abs(panelBox!.y+panelBox!.height-pageBox!.y-pageBox!.height)).toBeLessThanOrEqual(1)
        expect(featureBox!.y+featureBox!.height).toBeLessThanOrEqual(panelBox!.y+panelBox!.height)
      }else await expect(panel).toBeHidden()
      await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
      const pageBox=await pageArea.boundingBox(),footerBox=await page.getByRole('contentinfo').boundingBox()
      expect(footerBox!.y).toBeGreaterThanOrEqual(pageBox!.y+pageBox!.height-1)
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
      await page.screenshot({path:testInfo.outputPath(`signin-${width}-${height}-${theme}.png`),fullPage:true})
    }
  })
}

// These browser fixtures exercise the complete UI mutation/invalidation flow;
// they never contact a database, storage provider or email service.
const portraitBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64')
const uploadedPortrait = `data:image/png;base64,${portraitBytes.toString('base64')}`

async function profileFixtures(context: import('@playwright/test').BrowserContext, portal: 'patient' | 'doctor') {
  const { seedPortalSession, testSessionTiming } = await import('./helpers/portal-session')
  const identity = await seedPortalSession(context, portal)
  const state = { image: `/synthetic-portraits/${portal}.png` as string | null, mutations: 0, reads: 0, profileHeaders: [] as Record<string,string>[] }
  const doctor = { user_id: identity.user_id, provider_id: 'synthetic-doctor-provider', full_name: 'Synthetic Clinician', email: 'clinician@example.invalid', specialty: 'General practice', avatar_url: state.image, license_verified: false, total_consultations: 0, patient_rating: 0, years_active: 0 }
  await context.route('**/synthetic-portraits/**',route=>route.fulfill({contentType:'image/png',body:portraitBytes}))
  await context.route('**/api/v1/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname
    if(path==='/api/v1/browser-csrf')return route.fallback()
    if(path.startsWith('/api/v1/session'))return route.fulfill({json:testSessionTiming(identity)})
    if(path==='/api/v1/patient/profile-image'){
      state.profileHeaders.push(request.headers())
      if(request.method()==='POST'){
        const body=request.postDataJSON()
        expect(body.content_type).toBe('image/png')
        expect(body.content_base64).toBe(portraitBytes.toString('base64'))
        state.mutations++;state.image=uploadedPortrait
      }else if(request.method()==='DELETE'){state.mutations++;state.image=null}
      return route.fulfill({json:{image:state.image}})
    }
    if(path==='/api/v1/doctor/profile'){
      state.profileHeaders.push(request.headers())
      if(request.method()==='PUT'){state.mutations++;state.image=request.postDataJSON().avatar_url}
      else {state.reads++;await new Promise(resolve=>setTimeout(resolve,40))}
      return route.fulfill({json:{...doctor,avatar_url:state.image}})
    }
    if(path==='/api/v1/doctor/consultation-services')return route.fulfill({json:[]})
    if(path==='/api/v1/patient/settings')return route.fulfill({json:{user_id:identity.user_id,first_name:'Synthetic',last_name:'Patient',email:'patient@example.invalid',emergency_contacts:[],insurance:null}})
    if(path==='/api/v1/patient/settings/health-info')return route.fulfill({json:{}})
    if(path==='/api/v1/patient/settings/passkeys/status')return route.fulfill({json:{available:false,enabled:false}})
    if(path==='/api/v1/patient/dashboard')return route.fulfill({json:{patient_name:'Synthetic Patient',care_plans:[],medications:[],summary_cards:[],ai_insights:[],notifications:[]}})
    if(path==='/api/v1/patient/doctors')return route.fulfill({json:{doctors:[]}})
    if(path==='/api/v1/patient/doctors/recent')return route.fulfill({json:{recent_doctors:[]}})
    return route.fulfill({status:404,json:{detail:`No synthetic fixture for ${path}`}})
  })
  return state
}

async function expectPortrait(scope: import('@playwright/test').Locator, name: string, source: string) {
  const portrait=scope.getByRole('img',{name:`${name} profile image`,exact:true}).locator('img')
  await expect(portrait).toHaveAttribute('src',source)
}

test('patient owned image propagates through account menus, settings, dashboard, refresh and removal',async({page,context})=>{
  const state=await profileFixtures(context,'patient')
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.setViewportSize({width:1440,height:1000})
  await page.goto('/patient/settings')
  const navbar=page.getByRole('navigation',{name:'Patient appearance',exact:true})
  const trigger=navbar.locator('summary')
  await expect(trigger).toHaveAccessibleName('Patient account menu')
  await expectPortrait(trigger,'Synthetic Patient',state.image!)
  await trigger.focus();await page.keyboard.press('Enter')
  const menu=navbar.locator('details[open]')
  await expect(menu.getByRole('link',{name:'View profile',exact:true})).toBeVisible()
  // A summary and the expanded identity intentionally show the same owned portrait.
  const menuPortraits=menu.getByRole('img',{name:'Synthetic Patient profile image',exact:true}).locator('img')
  await expect(menuPortraits).toHaveCount(2)
  await expect(menuPortraits.nth(0)).toHaveAttribute('src',state.image!)
  await expect(menuPortraits.nth(1)).toHaveAttribute('src',state.image!)
  await page.keyboard.press('Escape');await expect(trigger).toBeFocused()
  await expect(navbar.locator('details')).not.toHaveAttribute('open','')
  const editor=page.getByRole('region',{name:'Profile image',exact:true})
  const upload=editor.locator('input[type=file]')
  await upload.setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')})
  await expect(editor.getByRole('alert')).toHaveText('Choose a JPEG, PNG or WebP image, up to 2 MB.')
  expect(state.mutations).toBe(0)
  await upload.setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:portraitBytes})
  await expect(editor.getByRole('img',{name:'Selected profile image preview',exact:true})).toBeVisible()
  await editor.getByRole('button',{name:'Save image',exact:true}).click()
  await expect(editor.getByRole('status')).toHaveText('Profile image updated.')
  await expectPortrait(trigger,'Synthetic Patient',uploadedPortrait)
  await page.goto('/patient/dashboard')
  await expectPortrait(navbar.locator('summary'),'Synthetic Patient',uploadedPortrait)
  await expect(page.locator('.pd-profile-avatar img')).toHaveAttribute('src',uploadedPortrait)
  await page.reload()
  await expectPortrait(navbar.locator('summary'),'Synthetic Patient',uploadedPortrait)
  await page.setViewportSize({width:390,height:844})
  const mobile=page.locator('.pmn-topbar')
  await mobile.locator('summary').click()
  await expect(mobile.getByText('Synthetic Patient',{exact:true})).toBeVisible()
  await expectPortrait(mobile.locator('summary'),'Synthetic Patient',uploadedPortrait)
  await page.goto('/patient/settings')
  await page.getByRole('region',{name:'Profile image',exact:true}).getByRole('button',{name:'Remove image',exact:true}).click()
  await expect(page.getByText('Profile image removed.',{exact:true})).toBeVisible()
  await expect(mobile.locator('summary img')).toHaveCount(0)
  await expect(mobile.locator('summary').getByRole('img',{name:'Synthetic Patient profile image',exact:true})).toHaveText('SP')
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  expect(state.profileHeaders.every(headers=>headers['x-qarevo-portal']==='patient'&&!headers.authorization)).toBe(true)
  expect(errors).toEqual([])
})

test('doctor owned image persists after save, route re-entry, refresh and mobile navigation with a consistent fallback',async({page,context})=>{
  const state=await profileFixtures(context,'doctor')
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.setViewportSize({width:1440,height:1000})
  await page.goto('/doctor/profile')
  const header=page.getByRole('banner',{name:'Doctor main navigation',exact:true})
  await expectPortrait(header.locator('summary'),'Dr. Synthetic Clinician',state.image!)
  await expect(page.getByRole('heading',{name:'Dr. Synthetic Clinician',exact:true})).toBeVisible()
  expect(state.reads).toBe(1)
  const upload=page.locator('#avatar-upload')
  await upload.setInputFiles({name:'oversize.png',mimeType:'image/png',buffer:Buffer.alloc(2*1024*1024+1)})
  await expect(page.getByRole('alert').filter({hasText:'Choose a JPEG, PNG or WebP image, up to 2 MB.'})).toBeVisible()
  expect(state.mutations).toBe(0)
  await upload.setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:portraitBytes})
  await page.getByRole('button',{name:'Save Profile',exact:true}).first().click()
  await expect(page.getByText('Professional profile updated.',{exact:true})).toBeVisible()
  await expectPortrait(header.locator('summary'),'Dr. Synthetic Clinician',uploadedPortrait)
  await header.locator('summary').click()
  await header.getByRole('link',{name:'Settings and security',exact:true}).click()
  await expect(page).toHaveURL(/\/doctor\/settings$/)
  await page.goto('/doctor/profile')
  await expectPortrait(header.locator('summary'),'Dr. Synthetic Clinician',uploadedPortrait)
  await page.reload()
  await expectPortrait(header.locator('summary'),'Dr. Synthetic Clinician',uploadedPortrait)
  await page.setViewportSize({width:390,height:844})
  const mobile=page.locator('.dmn-topbar')
  await expectPortrait(mobile.locator('summary'),'Dr. Synthetic Clinician',uploadedPortrait)
  await mobile.locator('summary').focus();await page.keyboard.press('Enter')
  await expect(mobile.getByText('Dr. Synthetic Clinician',{exact:true})).toBeVisible()
  await page.keyboard.press('Escape');await expect(mobile.locator('summary')).toBeFocused()
  state.image=null
  await page.reload()
  await expect(mobile.locator('summary img')).toHaveCount(0)
  await expect(mobile.locator('summary').getByRole('img',{name:'Dr. Synthetic Clinician profile image',exact:true})).toHaveText('SC')
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  expect(state.profileHeaders.every(headers=>headers['x-qarevo-portal']==='doctor'&&!headers.authorization)).toBe(true)
  expect(errors).toEqual([])
})
