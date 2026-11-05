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
  await expect(section.getByText('GKV',{exact:true})).toBeVisible()
})
