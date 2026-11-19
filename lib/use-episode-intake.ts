'use client'
import { usePatientResource } from './use-patient-resource'

/** Clinical text is retrieved through authenticated ownership checks, never a URL. */
export function useEpisodeIntake(episodeId: string) {
  const resource = usePatientResource<Record<string, unknown>>(episodeId ? `/api/v1/patient/episodes/${encodeURIComponent(episodeId)}/intake` : null)
  const data = resource.data
  const responses = data?.responses && typeof data.responses === 'object' ? data.responses as Record<string, unknown> : {}
  const value = responses.raw_text || responses.chief_complaint || data?.chief_complaint || ''
  return { episodeId, notes: typeof value === 'string' ? value : '', loading: resource.loading, error: resource.error ? 'Your saved intake could not be loaded. Refresh to try again.' : '' }
}
