'use client'
import SupportReference from '@/components/ui/SupportReference'
import type { ReactNode } from 'react'
import { PortalButton, PortalCard, PortalLinkButton } from './PatientPortalPrimitives'

export type ClinicalRecord = Record<string, unknown>
export function recordText(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
export function recordList(value: unknown): ClinicalRecord[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : []
}
export function RecordLoadState({ loading, error, errorMessage, errorRequestId, loadingMessage = 'Loading your records…', retry, children }: { loading: boolean; error: boolean; errorMessage?: string; errorRequestId?: string | null; loadingMessage?: string; retry: () => void; children: ReactNode }) {
  if (loading) return <PortalCard role='status' aria-live='polite'><p className='text-sm leading-7 text-secondary'>{loadingMessage}</p></PortalCard>
  if (error) return <PortalCard role='alert'><h2 className='portal-h2'>We couldn’t load your records</h2><p className='mb-4 text-sm leading-7 text-secondary'>{errorMessage || 'Your records have not been changed. Please try again.'}</p><SupportReference requestId={errorRequestId} /><PortalButton type='button' onClick={retry}>Try again</PortalButton></PortalCard>
  return <>{children}</>
}
export function EmptyRecords({ title, description, showDashboardLink = true }: { title: string; description: string; showDashboardLink?: boolean }) {
  return <PortalCard><h2 className='portal-h2'>{title}</h2><p className='mb-4 text-sm leading-7 text-secondary'>{description}</p>{showDashboardLink && <PortalLinkButton href='/patient/dashboard'>Back to dashboard</PortalLinkButton>}</PortalCard>
}
export function RecordFields({ record, fields }: { record: ClinicalRecord; fields: [string, string][] }) {
  return <dl className='mt-5 grid gap-5'>{fields.filter(([key]) => recordText(record[key])).map(([key, label]) => <div key={key} className='min-w-0 border-b border-theme pb-5 last:border-0 last:pb-0'><dt className='text-sm font-semibold text-secondary'>{label}</dt><dd className='mt-2 whitespace-pre-wrap break-words leading-7 text-ink' style={{ overflowWrap: 'anywhere' }}>{recordText(record[key])}</dd></div>)}</dl>
}
