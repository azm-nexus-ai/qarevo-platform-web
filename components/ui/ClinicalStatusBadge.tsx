'use client'

import { useTranslations } from 'next-intl'
import { PortalBadge } from '@/components/patient/PatientPortalPrimitives'
import { clinicalStatus, type ClinicalStatusDomain } from '@/lib/clinical-status'

/** Shared semantic status styling; visible labels carry meaning without colour. */
export default function ClinicalStatusBadge({ status, domain = 'record', label }: { status: unknown; domain?: ClinicalStatusDomain; label?: string }) {
  const t = useTranslations('clinicalStatus'), presentation = clinicalStatus(status, domain)
  // lib/clinical-status labels are English; the key is the label in camelCase ("Not attended" -> notAttended).
  const words = presentation.label.match(/[A-Za-z]+/g) ?? [], key = words.map((word, index) => index ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase()).join('')
  const translated = key && t.has(key) ? t(key) : presentation.label
  return <span data-clinical-status={typeof status === 'string' ? status : ''} data-status-tone={presentation.tone}>
    <PortalBadge tone={presentation.tone}>{label || translated}</PortalBadge>
  </span>
}
