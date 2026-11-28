'use client'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { usePortalResource } from '@/lib/use-portal-resource'
import { practiceWorkspace } from '@/lib/practice'
import { PortalCard, PortalEmptyState } from '@/components/patient/PatientPortalPrimitives'
import VerificationWorkspace from '@/components/verification/VerificationWorkspace'
import { PracticeGate, PracticeReadState, PracticeScope } from './PracticeShared'

/** The owner's verification workspace for each practice they own. */
export default function PracticeVerification() {
  const t = useTranslations('practiceWs.verification')
  return <PracticeScope><header className='mb-6'>
    <h1 className='text-3xl font-extrabold tracking-tight text-ink'>{t('title')}</h1>
    <p className='mt-2 max-w-3xl text-sm leading-7 text-secondary'>{t('intro')}</p>
  </header><PracticeGate><OwnedPractices /></PracticeGate></PracticeScope>
}

function OwnedPractices() {
  const t = useTranslations('practiceWs.verification')
  const resource = usePortalResource<unknown>('/api/v1/practice/workspace', false, { abortOnCleanup: true })
  const rows = useMemo(() => practiceWorkspace(resource.data), [resource.data])
  if (!rows) return <PortalCard><PracticeReadState resource={resource} invalid={!!resource.data && !rows} /></PortalCard>
  const owned = rows.filter(row => row.membership.role === 'OWNER' && row.membership.status === 'ACTIVE')
  if (!owned.length) return <PortalEmptyState title={t('emptyTitle')} description={t('emptyText')} />
  return <div className='grid gap-10'>{owned.map(row => <section key={row.practice.id} aria-label={row.practice.name}>
    {owned.length > 1 && <h2 className='mb-4 text-2xl font-bold text-ink'>{row.practice.name}</h2>}
    <VerificationWorkspace base={`/api/v1/practice/practices/${row.practice.id}`} entityKind='practice' />
  </section>)}</div>
}
