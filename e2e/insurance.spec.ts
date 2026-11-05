import {test,expect} from '@playwright/test'
import {patientApiFixture} from './helpers/patient-api-fixture'

test('insurance editor exposes the supported funding categories',async({page,context})=>{
  await patientApiFixture(context)
  await page.goto('/patient/settings')
  const section=page.locator('.settings-card').filter({has:page.getByRole('heading',{name:'Coverage and card upload',exact:true})})
  await section.getByRole('button',{name:'Add Insurance',exact:true}).click()
  const select=section.locator('select').filter({hasText:/Self Pay|GKV|PKV/})
  await expect(select).toBeVisible()
  await expect(select.locator('option')).toHaveText(['Self Pay (Private)','Statutory (GKV)','Private (PKV)'])
})

test('insurance details save through the protected client and survive a fresh settings read',async({page,context})=>{
  const state=await patientApiFixture(context)
  await page.goto('/patient/settings')
  const section=page.locator('.settings-card').filter({has:page.getByRole('heading',{name:'Coverage and card upload',exact:true})})
  await section.getByRole('button',{name:'Add Insurance',exact:true}).click()
  await section.locator('select').filter({hasText:/Self Pay|GKV|PKV/}).selectOption('GKV')
  await section.getByRole('button',{name:'Save Insurance',exact:true}).click()
  await expect(page.getByText('Insurance information saved successfully',{exact:true})).toBeVisible()
  expect(state.insuranceWrites).toBe(1)
  expect(state.insurance?.insurance_type).toBe('GKV')
  await page.reload()
  await expect(section.getByText('Statutory insurance (GKV)',{exact:true})).toBeVisible()
})

test('recorded membership and a future card date never become active or verified coverage in settings',async({page,context})=>{
  const state=await patientApiFixture(context)
  state.insurance={id:'synthetic-policy',insurance_type:'GKV',insurance_provider_name:'Synthetic insurer',insurance_number:'A123456789',insured_status:'SELF_INSURED',validity_end:'2099-12-31',status:'verified',coverage_verified:true}
  await page.goto('/patient/settings')
  const section=page.locator('.settings-card').filter({has:page.getByRole('heading',{name:'Coverage and card upload',exact:true})})
  await expect(section.getByText('Insurance details recorded',{exact:true})).toBeVisible()
  await expect(section.getByText(/Coverage has not been verified/)).toBeVisible()
  await expect(section.getByText('Membership category (patient reported)',{exact:true})).toBeVisible()
  await expect(section.getByText('Reported card validity until',{exact:true})).toBeVisible()
  await expect(section.getByText(/Coverage Active|Coverage Verified/)).toHaveCount(0)
})

test('covered-GKV claims alone never activate patient checkout or establish verified eligibility',async({page,context})=>{
  await patientApiFixture(context)
  await context.route('**/api/v1/patient/billing',route=>route.fulfill({json:{status:'not_configured',payment_provider_enabled:false,current_balance:null,amount_due:null,insurance_coverage:null,currency:'EUR',invoices:[],payment_methods:[],payment_history:[],upcoming_charges:[],insurance_summary:{insurance_type:'GKV',provider_name:'Synthetic insurer',member_number:'A123456789',status:'verified',coverage_verified:true,claims:[],authorizations:[]}}}))
  await page.goto('/patient/billing')
  await expect(page.getByText('Not verified',{exact:true})).toBeVisible()
  await expect(page.getByText(/Coverage has not been verified/)).toBeVisible()
  await expect(page.getByRole('button',{name:/Pay Now|Add Card/})).toHaveCount(0)
  await expect(page.getByText('Verified',{exact:true})).toHaveCount(0)
})

test('onboarding distinguishes declared funding from coverage and payment approval',async({page,context})=>{
  await patientApiFixture(context)
  await context.route('**/api/v1/patient/settings/onboarding',route=>route.fulfill({json:{complete:false,next_step:'coverage',completed_steps:['personal','contact','health'],personal:{},coverage:{insurance_type:'GKV',provider:'Synthetic insurer',insurance_number:'A123456789'},coverage_verified:false,legal_ready:false,consent_version:'dev-test-20261101'}}))
  await page.goto('/auth/profile-setup/insurance-privacy-consent')
  await expect(page.locator('#coverage-type')).toHaveValue('GKV')
  await expect(page.getByText(/Coverage has not been verified/)).toBeVisible()
  await page.locator('#coverage-type').selectOption('SELF_PAY')
  await expect(page.getByText(/A self-pay preference does not confirm a consultation price or a payment agreement/)).toBeVisible()
})

test('booking displays doctor-supplied options instead of trusting an insurance claim in the URL',async({page,context})=>{
  await patientApiFixture(context)
  await page.goto('/patient/consultation-booking/date-time?physicianId=synthetic-doctor&insurance=VERIFIED_GKV_COVERAGE')
  await expect(page.getByText('Doctor’s declared billing options',{exact:true})).toBeVisible()
  await expect(page.locator('body')).not.toContainText('VERIFIED_GKV_COVERAGE')
  await expect(page.getByText('Insurance Coverage',{exact:true})).toHaveCount(0)
})

test('an oversized insurance card is rejected inline before any upload request',async({page,context})=>{
  await patientApiFixture(context)
  let uploads=0
  await context.route('**/api/v1/patient/medical-records/upload',route=>{uploads++;return route.fulfill({status:413,json:{detail:'Must not be uploaded'}})})
  await page.goto('/patient/settings')
  await page.getByLabel('Upload insurance card',{exact:true}).setInputFiles({name:'synthetic-oversized.png',mimeType:'image/png',buffer:Buffer.alloc(3*1024*1024+1)})
  await expect(page.locator('#insurance-card-upload-error')).toHaveText(/3 MB or smaller/)
  expect(uploads).toBe(0)
})
