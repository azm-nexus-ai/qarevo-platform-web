'use client'

import { PortalBadge } from '@/components/patient/PatientPortalPrimitives'
import { clinicalStatus, type ClinicalStatusDomain } from '@/lib/clinical-status'

/** Shared semantic status styling; visible labels carry meaning without colour. */
export default function ClinicalStatusBadge({ status, domain = 'record', label }: { status: unknown; domain?: ClinicalStatusDomain; label?: string }) {
  const presentation = clinicalStatus(status, domain)
  return <span data-clinical-status={typeof status === 'string' ? status : ''} data-status-tone={presentation.tone}>
    <PortalBadge tone={presentation.tone}>{label || presentation.label}</PortalBadge>
  </span>
}
