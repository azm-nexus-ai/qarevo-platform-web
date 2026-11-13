'use client'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { apiGet, getApiErrorDetail, getApiErrorRequestId } from '@/lib/api'
import { ACCOUNT_CHANGED, readAccountScope } from '@/lib/account-storage'
import { usePortalAction } from '@/lib/portal-action'
import { PRACTICE_CAPABILITIES, practiceCapability, type PracticePage } from '@/lib/practice'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import SupportReference from '@/components/ui/SupportReference'

const subscribe = (changed: () => void) => { window.addEventListener(ACCOUNT_CHANGED, changed); window.addEventListener('storage', changed); return () => { window.removeEventListener(ACCOUNT_CHANGED, changed); window.removeEventListener('storage', changed) } }
export function PracticeScope({ children }: { children: ReactNode }) {
  const scope = useSyncExternalStore(subscribe, readAccountScope, () => null), pathname = usePathname()
  return <div key={JSON.stringify([pathname, scope])}>{children}</div>
}
export function PracticeBoundaryNote() { return <p className='rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-secondary'>Administrative workspace only. Practice membership does not grant access to patient records, authorize clinical work, confirm insurance coverage or enable payments.</p> }
export function PracticeGate({ children }: { children: ReactNode }) {
  const capture = usePortalAction(), [attempt, setAttempt] = useState(0), [state, setState] = useState<{ enabled: boolean | null; error: string; reference: string | null } | null>(null)
  useEffect(() => { const action = capture(), controller = new AbortController(); let mounted = true
    apiGet<unknown>(PRACTICE_CAPABILITIES, undefined, controller.signal).then(result => { if (mounted && action.isCurrent()) { const enabled = practiceCapability(result); setState({ enabled, error: enabled === null ? 'Practice availability could not be confirmed.' : '', reference: null }) } }).catch(error => { if (mounted && action.isCurrent()) setState({ enabled: null, error: getApiErrorDetail(error) || 'Practice workspaces are unavailable in this environment.', reference: getApiErrorRequestId(error) }) })
    return () => { mounted = false; controller.abort() }
  }, [attempt, capture])
  if (!state) return <PortalCard><p role='status'>Checking practice workspace availability…</p></PortalCard>
  if (state.enabled === true) return <>{children}</>
  return <PortalCard><h2 className='text-xl font-semibold text-ink'>Practice workspaces {state.enabled === false ? 'are not enabled' : 'are unavailable'}</h2>
    <p role={state.error ? 'alert' : 'status'} className='my-4 text-sm leading-7 text-secondary'>{state.error || 'Administrative practice onboarding is not enabled in this environment. No practice changes or invitations have been submitted.'}</p><SupportReference requestId={state.reference} />
    <PortalButton type='button' onClick={() => { setState(null); setAttempt(value => value + 1) }}>Check availability again</PortalButton></PortalCard>
}
export function ActionFeedback({ action }: { action: { error: string; reference: string | null; message: string } }) { return <>{action.error && <div role='alert' className='my-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'><p>{action.error}</p><p>Changes are never retried automatically. Refresh and review the saved record before trying again.</p><SupportReference requestId={action.reference} /></div>}{action.message && <p role='status' className='my-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'>{action.message}</p>}</> }
export function PracticeReadState({ resource, invalid = false }: { resource: { loading: boolean; refreshing: boolean; error: boolean; errorMessage: string; errorRequestId: string | null; retry: () => void }; invalid?: boolean }) { return <>{resource.loading && <p role='status' className='py-4 text-sm text-secondary'>Loading saved practice details…</p>}{(resource.error || invalid) && <div role='alert' className='my-4 rounded-xl border border-theme bg-surface-subtle p-4 text-sm leading-7 text-ink'><p>{resource.errorMessage || 'The practice response could not be verified. Refresh before making changes.'}</p><SupportReference requestId={resource.errorRequestId} /><PortalButton type='button' onClick={resource.retry} disabled={resource.refreshing}>Retry practice details</PortalButton></div>}</> }
export function PracticePages<T>({ data, offset, busy, onChange, label }: { data: PracticePage<T> | null; offset: number; busy: boolean; onChange: (offset: number) => void; label: string }) { return <nav aria-label={label + ' pages'} className='my-4 flex flex-wrap items-center gap-3 text-sm text-secondary'><p role='status'>Page {Math.floor(offset / 25) + 1}{data ? ` · ${data.total} ${label}` : ''}</p><PortalButton type='button' disabled={busy || offset === 0} onClick={() => onChange(Math.max(0, offset - 25))}>Previous {label}</PortalButton><PortalButton type='button' disabled={busy || !data?.hasNext} onClick={() => onChange(offset + 25)}>Next {label}</PortalButton></nav> }
