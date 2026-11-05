import {test,expect} from '@playwright/test'
import {patientApiFixture} from './helpers/patient-api-fixture'

test('patient settings restores the persisted IANA timezone from the authenticated response',async({page,context})=>{
  const state=await patientApiFixture(context)
  state.timeZone='Europe/Berlin'
  await page.goto('/patient/settings')
  await expect(page.locator('select').filter({has:page.locator('option[value="Europe/Berlin"]')})).toHaveValue('Europe/Berlin')
})

test('consultation scheduling displays the provider timezone from saved availability',async({page,context})=>{
  const state=await patientApiFixture(context)
  state.timeZone='Europe/Berlin'
  await page.goto('/patient/consultation-booking?physicianId=synthetic-doctor')
  await expect(page).toHaveURL(/\/patient\/consultation-booking\/date-time\?/)
  await expect(page.getByText('Timezone: Europe/Berlin',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>localStorage.getItem('qarevo_access_token'))).toBeNull()
})
