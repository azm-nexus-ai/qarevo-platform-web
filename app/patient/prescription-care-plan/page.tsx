'use client'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PortalBadge, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { EmptyRecords, RecordFields, RecordLoadState, recordList, recordText, type ClinicalRecord } from '@/components/patient/ClinicalRecords'
import { usePatientResource } from '@/lib/use-patient-resource'
import { T } from '@/lib/tokens'

export default function PrescriptionCarePlanPage() {
  const resource = usePatientResource<ClinicalRecord>('/api/v1/patient/prescription-care-plan')
  const medications = recordList(resource.data?.medications)
  const plans = recordList(resource.data?.care_plans)
  return <PatientPortalShell title='Prescriptions & Care Plan' description='Medication instructions and care plans recorded for your account.'>
    <RecordLoadState {...resource}>
      <div style={{ display: 'grid', gap: 18 }}>
        <section aria-labelledby='medications-title'>
          <h2 id='medications-title' style={{ color: T.navy, fontSize: 20 }}>Your medications</h2>
          {medications.length === 0 ? <EmptyRecords title='No medications recorded' description='Medication instructions will appear here when your clinician records them. No medication plan is available for this account yet.' /> :
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>{medications.map((medication, index) => <PortalCard key={recordText(medication.id) || index}>
              <h3 style={{ margin: '0 0 8px', color: T.navy }}>{recordText(medication.name) || 'Medication record'}</h3>
              {recordText(medication.status) && <PortalBadge>{recordText(medication.status)}</PortalBadge>}
              <RecordFields record={medication} fields={[
                ['strength', 'Strength'], ['dosage', 'Dose'], ['frequency', 'Frequency'], ['duration', 'Duration'], ['instructions', 'Clinician instructions'], ['food', 'Food instructions'],
              ]} />
              {!recordText(medication.instructions) && <p style={{ color: T.slate }}>No additional instructions were recorded. Contact your clinician if you need clarification.</p>}
            </PortalCard>)}</div>}
        </section>
        <section aria-labelledby='plans-title'>
          <h2 id='plans-title' style={{ color: T.navy, fontSize: 20 }}>Your care plans</h2>
          {plans.length === 0 ? <EmptyRecords title='No care plan recorded' description='Your clinician’s care plan will appear here when it is available.' /> : <div style={{ display: 'grid', gap: 16 }}>{plans.map((plan, index) => <PortalCard key={recordText(plan.id) || index}>
            <h3 style={{ marginTop: 0, color: T.navy }}>{recordText(plan.title) || 'Care plan'}</h3>
            {recordText(plan.status) && <PortalBadge>{recordText(plan.status)}</PortalBadge>}
            <RecordFields record={plan} fields={[['description', 'Plan details']]} />
          </PortalCard>)}</div>}
        </section>
      </div>
    </RecordLoadState>
  </PatientPortalShell>
}
