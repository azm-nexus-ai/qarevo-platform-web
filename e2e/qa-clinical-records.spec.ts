import {test,expect,type BrowserContext} from '@playwright/test'
import {seedPortalSession,testSessionTiming} from './helpers/portal-session'

function medication(status='Active', notes='Synthetic original instruction') {
  return {id:'prescription-synthetic-medication',type:'Prescription',title:'Medication instructions: Synthetic medication',provider:'Synthetic Clinician',specialty:'General medicine',date:'Nov 05, 2026',lastUpdated:'Nov 05, 2026',status:'Available',clinicalStatus:status,sourceType:'medication',sourceId:'synthetic-medication',summary:'Recorded medication instructions. This record is not a signed electronic prescription.',clinicalNotes:notes,canPreview:true,canDownload:false,canDelete:false}
}
function labRequest() {
  return {id:'lab-request-synthetic-request',type:'Lab Request',title:'Synthetic diagnostic request',provider:'Synthetic Clinician',specialty:'Diagnostics',date:'Nov 05, 2026',lastUpdated:'Nov 05, 2026',status:'Pending',clinicalStatus:'Pending',sourceType:'lab-request',sourceId:'synthetic-request',summary:'A request is not a test result.',clinicalNotes:'Synthetic preparation',canPreview:true,canDownload:false,canDelete:false}
}
async function prepare(context:BrowserContext) {
  const identity=await seedPortalSession(context,'patient')
  const control={records:[] as Record<string,unknown>[],failed:false,reads:0}
  await context.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname
    expect(route.request().headers()['authorization']).toBeUndefined()
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if(path.startsWith('/api/v1/session'))return route.fulfill({json:testSessionTiming(identity)})
    if(path.endsWith('/patient/medical-records')){
      control.reads++
      if(control.failed)return route.fulfill({status:503,json:{detail:'Synthetic records temporarily unavailable. Please retry.'}})
      return route.fulfill({json:{records:control.records,timeline:[]}})
    }
    if(path.endsWith('/patient/settings'))return route.fulfill({json:{first_name:'Synthetic',last_name:'Patient',emergency_contacts:[]}})
    if(path.endsWith('/patient/settings/health-info'))return route.fulfill({json:{blood_type:'',allergies:'',medical_conditions:''}})
    if(path.endsWith('/profile-image'))return route.fulfill({json:{image:null}})
    return route.fulfill({status:404,json:{detail:'No synthetic fixture'}})
  })
  return control
}

test('committed clinician records appear on focus, reflect updates, and never offer nonexistent downloads',async({page,context})=>{
  const control=await prepare(context)
  await page.goto('/patient/medical-records')
  await expect(page.getByRole('heading',{name:'No medical records yet',exact:true})).toBeVisible()
  control.records=[medication(),labRequest()]
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('heading',{name:'Medication instructions: Synthetic medication',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Synthetic diagnostic request',exact:true})).toBeVisible()
  await expect(page.locator('[data-clinical-status="Active"]')).toHaveAttribute('data-status-tone','success')
  await expect(page.locator('[data-clinical-status="Pending"]')).toHaveAttribute('data-status-tone','warning')
  await expect(page.getByRole('button',{name:'Download',exact:true})).toHaveCount(0)
  const medicationCard=page.locator('.mr-card-grid > div').filter({has:page.getByRole('heading',{name:'Medication instructions: Synthetic medication',exact:true})})
  await medicationCard.getByRole('button',{name:'View Details',exact:true}).click()
  await expect(page.getByRole('dialog').getByText('Synthetic original instruction',{exact:true})).toBeVisible()
  control.records=[medication('Stopped','Synthetic revised instruction'),labRequest()]
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('dialog').getByText('Synthetic revised instruction',{exact:true})).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Synthetic original instruction',{exact:true})).toHaveCount(0)
  await expect(page.getByRole('link',{name:'View medication instructions',exact:true})).toHaveAttribute('href','/patient/prescription-care-plan')
  control.records=[labRequest()]
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading',{name:'Medication instructions: Synthetic medication',exact:true})).toHaveCount(0)
  expect(control.reads).toBeGreaterThanOrEqual(4)
})

test('medical record errors display a real retry instead of a misleading empty account',async({page,context})=>{
  const control=await prepare(context);control.failed=true
  await page.goto('/patient/medical-records')
  await expect(page.getByRole('alert').filter({hasText:'Synthetic records temporarily unavailable'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'No medical records yet',exact:true})).toHaveCount(0)
  control.failed=false;control.records=[labRequest()]
  await page.getByRole('button',{name:'Retry medical records',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Synthetic diagnostic request',exact:true})).toBeVisible()
  expect(control.reads).toBe(2)
})

test('the current account scope controls open record dialogs as well as the underlying list',async({page,context})=>{
  const control=await prepare(context);control.records=[medication()]
  await page.goto('/patient/medical-records')
  await page.getByRole('button',{name:'View Details',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  control.records=[]
  await page.evaluate(()=>{
    const key='qarevo:patient:identity'
    const value=JSON.stringify({user_id:'different-synthetic-patient',role:'PATIENT',session_id:'different-synthetic-session'})
    localStorage.setItem(key,value)
    window.dispatchEvent(new StorageEvent('storage',{key,newValue:value}))
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Synthetic original instruction',{exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('Synthetic original instruction')
})

for(const width of [390,820,1440])test(`clinical record badges and source actions are usable in both themes at ${width}px`,async({page,context})=>{
  const control=await prepare(context);control.records=[medication(),labRequest()]
  await page.setViewportSize({width,height:900})
  await page.goto('/patient/medical-records')
  for(const theme of ['light','dark']){
    await page.evaluate(value=>document.documentElement.setAttribute('data-theme',value),theme)
    await expect(page.getByRole('heading',{name:'Synthetic diagnostic request',exact:true})).toBeVisible()
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    const card=page.locator('.mr-card-grid > div').filter({has:page.getByRole('heading',{name:'Synthetic diagnostic request',exact:true})})
    const details=card.getByRole('button',{name:'View Details',exact:true})
    await details.focus();await expect(details).toBeFocused();await details.click()
    await expect(page.getByRole('link',{name:'View lab request',exact:true})).toHaveAttribute('href','/patient/lab-requests')
    await page.getByRole('button',{name:'Close',exact:true}).last().click()
  }
})

test('medical upload explains the hosting limit inline before sending an oversized attachment',async({page,context})=>{
  await prepare(context)
  let uploads=0
  await context.route('**/api/v1/patient/medical-records/upload',route=>{uploads++;return route.fulfill({status:413,json:{detail:'Oversized upload must not be sent'}})})
  await page.goto('/patient/medical-records')
  await page.getByRole('button',{name:'Upload Medical Record',exact:true}).first().click()
  await page.locator('input[type=file]').setInputFiles({name:'synthetic-oversized.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(3*1024*1024+1)})
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Choose a file of 3 MB or smaller.')
  expect(uploads).toBe(0)
})

for(const [path,addLabel,placeholder]of[
  ['/doctor/prescriptions','Add Medication','e.g., Amlodipine'],
  ['/doctor/care-plans','Add Care Plan','Care plan title'],
]as const)test(`${path}: unsaved clinical details cannot transfer to a different patient`,async({page,context})=>{
  const identity=await seedPortalSession(context,'doctor')
  await context.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname
    if(path.endsWith('/browser-csrf'))return route.fulfill({json:{csrf_token:'synthetic-csrf'}})
    if(path.startsWith('/api/v1/session'))return route.fulfill({json:testSessionTiming(identity)})
    if(path.endsWith('/doctor/profile'))return route.fulfill({json:{full_name:'Synthetic Clinician'}})
    if(path.endsWith('/doctor/patients'))return route.fulfill({json:{patients:[{patient_id:'synthetic-alpha',name:'Synthetic Alpha'},{patient_id:'synthetic-beta',name:'Synthetic Beta'}],total_count:2}})
    return route.fulfill({status:404,json:{detail:'No synthetic fixture'}})
  })
  await page.goto(path)
  const select=page.getByLabel('Select Patient',{exact:true})
  await select.selectOption('synthetic-alpha')
  await page.getByRole('button',{name:addLabel,exact:true}).click()
  await page.getByPlaceholder(placeholder,{exact:true}).fill('Synthetic unsaved patient Alpha instruction')
  await select.selectOption('synthetic-beta')
  const dialog=page.getByRole('dialog',{name:'Keep your clinical notes?',exact:true})
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button',{name:'Keep editing',exact:true}).click()
  await expect(select).toHaveValue('synthetic-alpha')
  await expect(page.getByPlaceholder(placeholder,{exact:true})).toHaveValue('Synthetic unsaved patient Alpha instruction')
  await select.selectOption('synthetic-beta')
  await dialog.getByRole('button',{name:'Discard and leave',exact:true}).click()
  await expect(select).toHaveValue('synthetic-beta')
  await page.getByRole('button',{name:addLabel,exact:true}).click()
  await expect(page.getByPlaceholder(placeholder,{exact:true})).toHaveValue('')
})
