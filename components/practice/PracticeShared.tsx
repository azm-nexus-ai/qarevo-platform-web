'use client'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiGet, getApiErrorDetail, getApiErrorRequestId } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { usePortalAction } from '@/lib/portal-action'
import { PRACTICE_CAPABILITIES, practiceCapability, type PracticePage, type PracticeFieldText, type DELIVERY_TEXT } from '@/lib/practice'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import SupportReference from '@/components/ui/SupportReference'

const subscribe = (changed: () => void) => { window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed); return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) } }
export function PracticeScope({ children }: { children: ReactNode }) {
  const scope = useSyncExternalStore(subscribe, readAccountScope, () => null), pathname = usePathname()
  return <div key={JSON.stringify([pathname, scope])}>{children}</div>
}
export function PracticeBoundaryNote() { const t = useTranslations('practiceWs.shared'); return <p className='rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-secondary'>{t('boundaryNote')}</p> }
/** Field validation and invitation-delivery text in the active language, for the lib/practice helpers. */
export function usePracticeText(): { fields: PracticeFieldText; delivery: typeof DELIVERY_TEXT } {
  const f = useTranslations('practiceWs.fields'), d = useTranslations('practiceWs.delivery')
  return { fields: { nameError: f('nameError'), emailError: f('emailError'), phoneError: f('phoneError'), countryError: f('countryError'), postcodeError: f('postcodeError'), tooLong: (maximum: number) => f('tooLong', { maximum }) },
    delivery: { invalid: d('invalid'), accepted: d('accepted'), notConfigured: d('notConfigured'), unconfirmed: d('unconfirmed') } }
}
export function PracticeGate({ children }: { children: ReactNode }) {
  const t = useTranslations('practiceWs.shared'), capture = usePortalAction(), [attempt, setAttempt] = useState(0), [state, setState] = useState<{ enabled: boolean | null; error: string; reference: string | null } | null>(null)
  useEffect(() => { const action = capture(), controller = new AbortController(); let mounted = true
    apiGet<unknown>(PRACTICE_CAPABILITIES, undefined, controller.signal).then(result => { if (mounted && action.isCurrent()) { const enabled = practiceCapability(result); setState({ enabled, error: enabled === null ? t('availabilityUnconfirmed') : '', reference: null }) } }).catch(error => { if (mounted && action.isCurrent()) setState({ enabled: null, error: getApiErrorDetail(error) || t('unavailableHere'), reference: getApiErrorRequestId(error) }) })
    return () => { mounted = false; controller.abort() }
  }, [attempt, capture, t])
  if (!state) return <PortalCard><p role='status'>{t('checking')}</p></PortalCard>
  if (state.enabled === true) return <>{children}</>
  return <PortalCard><h2 className='text-xl font-semibold text-ink'>{state.enabled === false ? t('notEnabledTitle') : t('unavailableTitle')}</h2>
    <p role={state.error ? 'alert' : 'status'} className='my-4 text-sm leading-7 text-secondary'>{state.error || t('notEnabledText')}</p><SupportReference requestId={state.reference} />
    <PortalButton type='button' onClick={() => { setState(null); setAttempt(value => value + 1) }}>{t('checkAgain')}</PortalButton></PortalCard>
}
export function ActionFeedback({ action }: { action: { error: string; reference: string | null; message: string } }) { const t = useTranslations('practiceWs.shared'); return <>{action.error && <div role='alert' className='my-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'><p>{action.error}</p><p>{t('neverRetried')}</p><SupportReference requestId={action.reference} /></div>}{action.message && <p role='status' className='my-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'>{action.message}</p>}</> }
export function PracticeReadState({ resource, invalid = false }: { resource: { loading: boolean; refreshing: boolean; error: boolean; errorMessage: string; errorStatus?: number | null; errorRequestId: string | null; retry: () => void }; invalid?: boolean }) { const t = useTranslations('practiceWs.shared'), serverFault = (resource.errorStatus ?? 0) >= 500 || /internal server error/i.test(resource.errorMessage); return <>{resource.loading && <p role='status' className='py-4 text-sm text-secondary'>{t('loading')}</p>}{(resource.error || invalid) && <div role='alert' className='my-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'><p>{serverFault ? t('serverError') : resource.errorMessage || t('unverified')}</p><SupportReference requestId={resource.errorRequestId} /><PortalButton type='button' onClick={resource.retry} disabled={resource.refreshing}>{t('retry')}</PortalButton></div>}</> }
export function PracticePages<T>({ data, offset, busy, onChange, label }: { data: PracticePage<T> | null; offset: number; busy: boolean; onChange: (offset: number) => void; label: string }) {
  const t = useTranslations('practiceWs.shared'), page = Math.floor(offset / 25) + 1
  return <nav aria-label={t('pagesLabel', { label })} className='my-4 flex flex-wrap items-center gap-3 text-sm text-secondary'><p role='status'>{data ? t('pageWithTotal', { page, total: data.total, label }) : t('page', { page })}</p><PortalButton type='button' disabled={busy || offset === 0} onClick={() => onChange(Math.max(0, offset - 25))}>{t('previous', { label })}</PortalButton><PortalButton type='button' disabled={busy || !data?.hasNext} onClick={() => onChange(offset + 25)}>{t('next', { label })}</PortalButton></nav>
}
