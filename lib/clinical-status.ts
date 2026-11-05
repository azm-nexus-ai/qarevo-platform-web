export type ClinicalStatusDomain = 'consultation' | 'medication' | 'care-plan' | 'lab-request' | 'record' | 'episode'
export type ClinicalStatusTone = 'info' | 'success' | 'warning' | 'neutral' | 'danger'
type StatusDescription = { label: string; tone: ClinicalStatusTone }

const common: Record<string, StatusDescription> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
  FAILED: { label: 'Failed', tone: 'danger' },
}
const domains: Record<ClinicalStatusDomain, Record<string, StatusDescription>> = {
  consultation: {
    SCHEDULED: { label: 'Scheduled', tone: 'info' },
    STARTED: { label: 'In progress', tone: 'info' },
    IN_PROGRESS: { label: 'In progress', tone: 'info' },
    ENDED: { label: 'Ended', tone: 'neutral' },
    COMPLETED: { label: 'Completed', tone: 'success' },
  },
  medication: {
    ACTIVE: { label: 'Active', tone: 'success' },
    ON_HOLD: { label: 'On hold', tone: 'warning' },
    STOPPED: { label: 'Stopped', tone: 'neutral' },
    DISCONTINUED: { label: 'Discontinued', tone: 'neutral' },
    COMPLETED: { label: 'Completed', tone: 'neutral' },
  },
  'care-plan': {
    ACTIVE: { label: 'Active', tone: 'info' },
    COMPLETED: { label: 'Completed', tone: 'success' },
    ON_HOLD: { label: 'On hold', tone: 'warning' },
    DRAFT: { label: 'Draft', tone: 'neutral' },
  },
  'lab-request': {
    REQUESTED: { label: 'Requested', tone: 'info' },
    ORDERED: { label: 'Ordered', tone: 'info' },
    SCHEDULED: { label: 'Scheduled', tone: 'info' },
    IN_PROGRESS: { label: 'In progress', tone: 'info' },
    RESULTS_AVAILABLE: { label: 'Results available', tone: 'success' },
    COMPLETED: { label: 'Completed', tone: 'success' },
  },
  record: { AVAILABLE: { label: 'Available', tone: 'success' } },
  episode: {},
}

/** An unknown state is visible and neutral, never an inferred success. */
export function clinicalStatus(value: unknown, domain: ClinicalStatusDomain): StatusDescription {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return { label: 'Status unavailable', tone: 'neutral' }
  const key = text.toUpperCase().replace(/[\s-]+/g, '_')
  return domains[domain][key] ?? common[key] ?? { label: text.replace(/_/g, ' '), tone: 'neutral' }
}
