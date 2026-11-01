'use client'
import type { ReactNode } from 'react'
import { PortalButton, PortalCard, PortalLinkButton } from './PatientPortalPrimitives'
import { T } from '@/lib/tokens'

export type ClinicalRecord = Record<string, unknown>
export function recordText(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
export function recordList(value: unknown): ClinicalRecord[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : []
}
export function RecordLoadState({ loading, error, retry, children }: { loading: boolean; error: boolean; retry: () => void; children: ReactNode }) {
  if (loading) return <PortalCard role='status' aria-live='polite'><p>Loading your records…</p></PortalCard>
  if (error) return <PortalCard role='alert'><h2>We couldn’t load your records</h2><p>Your records have not been changed. Please try again.</p><PortalButton onClick={retry}>Try again</PortalButton></PortalCard>
  return <>{children}</>
}
export function EmptyRecords({ title, description }: { title: string; description: string }) {
  return <PortalCard><h2 style={{ color: T.navy, fontSize: 20, marginTop: 0 }}>{title}</h2><p style={{ color: T.slate, lineHeight: 1.7 }}>{description}</p><PortalLinkButton href='/patient/dashboard'>Back to dashboard</PortalLinkButton></PortalCard>
}
export function RecordFields({ record, fields }: { record: ClinicalRecord; fields: [string, string][] }) {
  return <dl style={{ display: 'grid', gap: 14, margin: '16px 0 0' }}>{fields.filter(([key]) => recordText(record[key])).map(([key, label]) => <div key={key}><dt style={{ fontSize: 12, fontWeight: 700, color: T.slate2 }}>{label}</dt><dd style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: T.navy, lineHeight: 1.6 }}>{recordText(record[key])}</dd></div>)}</dl>
}
