'use client'

import SupportReference from '@/components/ui/SupportReference'
import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { usePortalResource } from '@/lib/use-portal-resource'
import { clinicalPatientDirectoryBody, CLINICAL_PATIENT_DIRECTORY_SEARCH_PATH, clinicalPatientDirectoryPage, CLINICAL_PATIENT_SEARCH_MAX, type ClinicalPatientOption } from '@/lib/clinical-patient-directory'

const control = 'min-h-11 w-full rounded-xl border border-theme bg-surface px-4 py-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'
type Props = { selectLabel?: string; selectedId: string; selectedPatient: ClinicalPatientOption | null; disabled: boolean; isCurrent: () => boolean; onSelect: (id: string) => void }
export default function ClinicalPatientDirectory({ selectLabel, selectedId, selectedPatient, disabled, isCurrent, onSelect }: Props) {
  const t = useTranslations('patientDirectory'), label = selectLabel ?? t('selectPatient')
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1)
  const generation = useRef(0), renderedGeneration = generation.current
  const resource = usePortalResource<unknown>(CLINICAL_PATIENT_DIRECTORY_SEARCH_PATH, false, { refreshOnFocus: true, abortOnCleanup: true, readOnlyPostBody: clinicalPatientDirectoryBody(page, query) })
  const result = clinicalPatientDirectoryPage(resource.data, page), unavailable = Boolean(resource.error || (resource.data !== null && result.invalid))
  const transition = (nextPage: number, nextQuery: string) => { if (disabled || !isCurrent()) return; if (nextPage === page && nextQuery === query) { if (!resource.refreshing) resource.retry(); return }; generation.current++; setPage(nextPage); setQuery(nextQuery) }
  const selectedOnPage = result.patients.some(patient => patient.id === selectedId)
  return <PortalCard><form role='search' aria-label={t('searchLabel')} className='space-y-3' onSubmit={event => { event.preventDefault(); transition(1, search.trim()) }}>
    <label htmlFor='clinical-patient-search' className='block font-semibold text-ink'>{t('findTitle')}</label><p id='clinical-patient-search-description' className='text-sm leading-7 text-secondary'>{t('searchHint')}</p>
    <div className='flex min-w-0 flex-col gap-3 sm:flex-row'><input id='clinical-patient-search' type='search' className={control} value={search} maxLength={CLINICAL_PATIENT_SEARCH_MAX} disabled={disabled} aria-describedby='clinical-patient-search-description' onChange={event => { if (isCurrent() && !disabled) setSearch(event.target.value) }} /><PortalButton type='submit' disabled={disabled || (resource.refreshing && page === 1 && search.trim() === query)}>{t('search')}</PortalButton>{query && <PortalButton type='button' disabled={disabled} onClick={() => { if (isCurrent()) { setSearch(''); transition(1, '') } }}>{t('clear')}</PortalButton>}</div>
  </form><div className='mt-5'><label htmlFor='clinical-patient-select' className='mb-2 block font-semibold text-ink'>{label}</label><select id='clinical-patient-select' className={control} value={selectedId} disabled={disabled || resource.refreshing || unavailable} onChange={event => { const id = event.target.value; if (disabled || resource.refreshing || unavailable || !isCurrent() || renderedGeneration !== generation.current || (id && id !== selectedId && !result.patients.some(patient => patient.id === id))) return; onSelect(id) }}><option value=''>{t('chooseAPatient')}</option>{selectedId && !selectedOnPage && <option value={selectedId}>{selectedPatient?.label || t('verifying')}</option>}{result.patients.map(patient => <option key={patient.id} value={patient.id}>{patient.label}</option>)}</select></div>
    {resource.refreshing && <p role='status' className='mt-3 text-sm text-secondary'>{t('loading')}</p>}
    {unavailable && <div role='alert' className='mt-4 text-sm leading-7 text-danger'><p>{resource.errorMessage || t('unconfirmed')}</p><SupportReference requestId={resource.errorRequestId} /><PortalButton className='mt-3' disabled={disabled || resource.refreshing} onClick={() => { if (isCurrent()) resource.retry() }}>{t('retry')}</PortalButton></div>}
    {!resource.refreshing && !unavailable && !result.patients.length && <p role='status' className='mt-3 text-sm leading-7 text-secondary'>{query ? t('noMatch') : t('none')}</p>}
    <nav aria-label={t('pages')} className='mt-4 flex flex-wrap items-center gap-3'><PortalButton disabled={disabled || resource.refreshing || unavailable || !result.hasPrevious} onClick={() => transition(page - 1, query)}>{t('previous')}</PortalButton><span className='text-sm text-secondary'>Page {page} · Up to 25 patients per page</span><PortalButton disabled={disabled || resource.refreshing || unavailable || !result.hasNext} onClick={() => transition(page + 1, query)}>{t('next')}</PortalButton></nav>
  </PortalCard>
}
