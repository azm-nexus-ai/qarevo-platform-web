'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import ClinicalStatusBadge from '@/components/ui/ClinicalStatusBadge'
import { getApiErrorDetail, markPatientMedicationTaken, type PatientDashboardResponse } from '@/lib/api'
import { instructionList, medicationInstruction, medicationIdentifier } from '@/lib/clinical-instructions'
import { readAccountScope } from '@/lib/account-storage'
import { currentPortal } from '@/lib/portal-scope'
import { usePortalAction } from '@/lib/portal-action'

export default function PatientMedicationCards({ records, onUpdated }: { records: unknown; onUpdated: (data: PatientDashboardResponse) => void }) {
  const scope = readAccountScope('patient'), path = usePathname(), captureAction = usePortalAction()
  const pending = useRef<AbortController | null>(null)
  const [action, setAction] = useState<{ scope: string | null; id: string; busy: boolean; error: string } | null>(null)
  const active = action?.scope === scope ? action : null
  useEffect(() => () => { pending.current?.abort(); pending.current = null }, [scope])
  const list = instructionList(records)
  async function report(id: string) {
    if (!scope || scope !== readAccountScope('patient') || currentPortal() !== 'patient' || window.location.pathname !== path || !medicationIdentifier(id) || pending.current) return
    const medication = list.items.map(medicationInstruction).find(item => item.id === id)
    if (!medication?.canMarkTaken || medication.takenToday || list.duplicateIds.includes(id)) return
    const captured = captureAction(), controller = new AbortController(); pending.current = controller
    setAction({ scope, id, busy: true, error: '' })
    try { const data = await markPatientMedicationTaken(id, controller.signal); if (!captured.isCurrent() || controller.signal.aborted) return; onUpdated(data); setAction({ scope, id, busy: false, error: '' }) }
    catch (error) { if (captured.isCurrent() && !controller.signal.aborted) setAction({ scope, id, busy: false, error: getApiErrorDetail(error) || 'Your report could not be saved. Please retry.' }) }
    finally { if (pending.current === controller) pending.current = null }
  }
  return <div className='grid gap-3'>{!list.items.length && <p className='text-sm leading-7 text-secondary'>{list.invalid ? 'Medication instructions are unavailable. Open your medication list or refresh the dashboard.' : 'No medications are recorded yet.'}</p>}{list.items.map((value, index) => { const item = medicationInstruction(value), ownAction = active?.id === item.id ? active : null; return <PortalCard key={`${item.id || 'legacy'}:${index}`}><div className='flex flex-wrap items-start justify-between gap-3'><div><h3 className='portal-h3'>{item.name?.trim() || 'Medication name not recorded'}</h3><p className='text-sm leading-7 text-secondary'>Dose: {item.dosage?.trim() || 'Not recorded'} · Frequency: {item.frequency?.trim() || 'Not recorded'} · Duration: {item.duration?.trim() || 'Not recorded'}</p></div><ClinicalStatusBadge status={item.status} domain='medication' /></div>
    {item.takenToday && <p className='mt-3 text-sm font-semibold text-secondary'>Patient-reported: taken today{item.recordedOn && item.timeZone ? ` · reported for ${item.recordedOn} (${item.timeZone})` : item.reportedAt ? ` · reported ${new Date(item.reportedAt).toISOString()} (UTC)` : ''}. Clinical status is unchanged.</p>}
    {item.quality.reviewNeeded && <p className='mt-3 text-sm leading-7 text-secondary'>Some saved instructions need clinician review. Missing dose or schedule information has not been inferred.</p>}
    <div className='mt-3 flex flex-wrap gap-2'><Link href='/patient/prescription-care-plan' className='portal-button portal-button-secondary q-button q-button-secondary'>View Details</Link><PortalButton disabled={Boolean(active?.busy) || item.takenToday || !item.canMarkTaken || list.duplicateIds.includes(item.id!)} onClick={() => { if (item.id) void report(item.id) }}>{ownAction?.busy ? 'Saving report…' : ownAction?.error ? 'Retry report taken today' : 'Report taken today'}</PortalButton></div>
    {(!item.canMarkTaken || list.duplicateIds.includes(item.id!)) && !item.takenToday && <p className='mt-2 text-sm leading-7 text-secondary'>Reporting is unavailable until this record has complete active clinician instructions and a stable medication identifier.</p>}{ownAction?.error && <p role='alert' className='mt-3 text-sm leading-7 text-danger'>{ownAction.error}</p>}
  </PortalCard> })}{(list.truncated || list.invalidCount > 0) && <p role='alert' className='text-sm text-secondary'>Some historical medication entries could not be displayed in this bounded view. Open the medication list for details.</p>}</div>
}
