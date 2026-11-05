import {test, expect, type BrowserContext} from '@playwright/test'
import {seedPortalSession, testSessionTiming} from './helpers/portal-session'

const options = [
  {value:'SCHEDULED',label:'Scheduled'}, {value:'STARTED',label:'In progress'},
  {value:'ENDED',label:'Ended'}, {value:'CANCELLED',label:'Cancelled'},
]
async function prepare(context: BrowserContext) {
  const identity = await seedPortalSession(context, 'doctor')
  const control = {failed:false, episodesFailed:false, episodeReads:0, statuses:[] as string[]}
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(request.headers()['authorization']).toBeUndefined()
    if (path.endsWith('/browser-csrf')) return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if (path.startsWith('/api/v1/session')) return route.fulfill({json:testSessionTiming(identity)})
    if (path.endsWith('/doctor/profile')) return route.fulfill({json:{full_name:'Synthetic Clinician',specialty:'General medicine'}})
    if (path.endsWith('/doctor/workspace')) {
      const status = url.searchParams.get('status') || ''
      control.statuses.push(status)
      if(control.failed) return route.fulfill({status:503,json:{detail:'Synthetic consultations unavailable. Retry this operation.'}})
      const all = options.filter(option => option.value !== 'STARTED').map((option,index) => ({
        consultation_id:`synthetic-${index}`, patient_name:`Synthetic ${option.value} patient`, patient_id:`patient-${index}`,
        status:option.value, scheduled_time:'2020-01-01T09:00:00Z', started_at:null, waiting_duration_minutes:null,
      }))
      const consultations = status ? all.filter(row => row.status === status) : all
      return route.fulfill({json:{consultations,status_options:options,active_consultation_count:0,total_count:all.length,filtered_count:consultations.length,page:1,page_size:10,has_previous:false,has_next:false}})
    }
    if(path.endsWith('/doctor/episodes')) {
      control.episodeReads++
      expect(url.searchParams.has('status')).toBe(false)
      if(control.episodesFailed) return route.fulfill({status:503,json:{detail:'Synthetic clinical workflow unavailable.'}})
      return route.fulfill({json:{episodes:[],total_count:0,filtered_count:0,page:1,page_size:10,has_previous:false,has_next:false}})
    }
    return route.fulfill({status:404,json:{detail:'No synthetic fixture'}})
  })
  return control
}

test('all consultations includes historical ended and cancelled work; canonical filters never filter CWS episodes', async ({page,context}) => {
  const control = await prepare(context)
  await page.goto('/doctor/workspace')
  const section = page.getByRole('region',{name:'Consultations',exact:true})
  for(const state of ['SCHEDULED','ENDED','CANCELLED']) await expect(section.getByText(`Synthetic ${state} patient`,{exact:true})).toBeVisible()
  const episodeReads = control.episodeReads
  for(const option of options) {
    await page.getByLabel('Consultation status',{exact:true}).selectOption(option.value)
    await expect.poll(() => control.statuses.at(-1)).toBe(option.value)
    if(option.value === 'STARTED') await expect(section.getByRole('heading',{name:'No in progress consultations',exact:true})).toBeVisible()
    else {
      await expect(section.getByText(`Synthetic ${option.value} patient`,{exact:true})).toBeVisible()
      await expect(section.getByRole('button').filter({hasText:/Synthetic .* patient/})).toHaveCount(1)
    }
  }
  await page.getByLabel('Consultation status',{exact:true}).selectOption('')
  await expect(section.getByRole('button').filter({hasText:/Synthetic .* patient/})).toHaveCount(3)
  expect(control.statuses.at(-1)).toBe('')
  expect(control.episodeReads).toBe(episodeReads)
})

test('consultation errors retry correctly and an independent CWS outage does not hide consultations', async ({page,context}) => {
  const control = await prepare(context)
  control.failed=true; control.episodesFailed=true
  await page.goto('/doctor/workspace')
  await expect(page.getByLabel('Consultation status',{exact:true})).toBeVisible()
  await expect(page.getByRole('alert').filter({hasText:'Synthetic consultations unavailable'})).toBeVisible()
  control.failed=false
  await page.getByRole('button',{name:'Retry consultations',exact:true}).click()
  await expect(page.getByText('Synthetic SCHEDULED patient',{exact:true})).toBeVisible()
  await expect(page.getByRole('alert').filter({hasText:'Synthetic clinical workflow unavailable'})).toBeVisible()
  control.episodesFailed=false
  await page.getByRole('button',{name:'Retry clinical workflow episodes',exact:true}).click()
  await expect(page.getByText('No assigned episodes found.',{exact:true})).toBeVisible()
})

test('workspace status and queue controls remain usable in both themes on narrow screens', async ({page,context}) => {
  await prepare(context)
  await page.setViewportSize({width:390,height:844})
  await page.goto('/doctor/workspace')
  for(const theme of ['light','dark']) {
    await page.evaluate(value=>document.documentElement.setAttribute('data-theme',value),theme)
    await expect(page.getByText('Synthetic ENDED patient',{exact:true})).toBeVisible()
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    const filter=page.getByLabel('Consultation status',{exact:true})
    await filter.focus()
    await expect(filter).toBeFocused()
    await expect(page.locator('[data-clinical-status="ENDED"]')).toHaveAttribute('data-status-tone','neutral')
  }
})
