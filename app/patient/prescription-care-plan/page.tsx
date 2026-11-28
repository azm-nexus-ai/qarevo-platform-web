'use client'
import { useTranslations } from 'next-intl'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { EmptyRecords, RecordLoadState } from '@/components/patient/ClinicalRecords'
import { MedicationRecordCard, CarePlanRecordCard } from '@/components/clinical/InstructionRecords'
import { usePatientResource } from '@/lib/use-patient-resource'
import { instructionList, medicationInstruction, careInstruction } from '@/lib/clinical-instructions'

export default function PrescriptionCarePlanPage() {
  const t = useTranslations('patientCareRecords')
  const resource = usePatientResource<Record<string, unknown>>('/api/v1/patient/prescription-care-plan', false, { refreshOnFocus: true, refreshIntervalMs: 30000, abortOnCleanup: true })
  const medications = instructionList(resource.data?.medications), plans = instructionList(resource.data?.care_plans)
  const invalid = resource.data !== null && (medications.invalid || plans.invalid)
  return <PatientPortalShell title={t('prescriptionsCarePlan')} description={t('medicationInstructionsAndCarePlans')}>
    <RecordLoadState {...resource} error={resource.error || invalid} errorMessage={invalid ? 'The saved medications or care plans could not be confirmed. Please retry.' : resource.errorMessage}>
      <div className='grid gap-6'><section aria-labelledby='medications-title'><h2 id='medications-title' className='portal-h2'>{t('yourMedications')}</h2>
        {!medications.items.length ? <EmptyRecords title={t('noMedicationsRecorded')} description={t('medicationInstructionsWillAppearHere')} /> : <div className='grid gap-4 lg:grid-cols-2'>{medications.items.map((value, index) => { const medication = medicationInstruction(value); return <MedicationRecordCard key={`${medication.id || 'legacy'}:${index}`} medication={medication} /> })}</div>}
      </section><section aria-labelledby='plans-title'><h2 id='plans-title' className='portal-h2'>{t('yourCarePlans')}</h2>
        {!plans.items.length ? <EmptyRecords title={t('noCarePlanRecorded')} description={t('yourClinicianSCarePlan')} /> : <div className='grid gap-4'>{plans.items.map((value, index) => { const plan = careInstruction(value); return <CarePlanRecordCard key={`${plan.id || 'legacy'}:${index}`} plan={plan} /> })}</div>}
      </section>{(medications.truncated || plans.truncated || medications.invalidCount > 0 || plans.invalidCount > 0) && <p role='alert' className='rounded-xl border border-theme bg-surface p-4 text-sm leading-7 text-secondary'>{t('someHistoricalEntriesCouldNot')}</p>}</div>
    </RecordLoadState>
  </PatientPortalShell>
}
