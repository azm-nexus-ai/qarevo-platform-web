'use client'

import { useEffect, useState } from 'react'
import { getPatientEpisodeIntake } from './api'

/** Clinical text is retrieved through authenticated ownership checks, never a URL. */
export function useEpisodeIntake(episodeId: string) {
  const [state, setState] = useState({ episodeId: '', notes: '', error: '', loading: false })
  useEffect(() => {
    if (!episodeId) return
    let current = true
    setState({ episodeId, notes: '', error: '', loading: true })
    getPatientEpisodeIntake(episodeId).then(data => {
      const responses = data.responses && typeof data.responses === 'object' ? data.responses as Record<string, unknown> : {}
      const value = responses.raw_text || responses.chief_complaint || data.chief_complaint || ''
      if (current) setState({ episodeId, notes: typeof value === 'string' ? value : '', error: '', loading: false })
    }).catch(() => {
      if (current) setState({ episodeId, notes: '', error: 'Your saved intake could not be loaded. Refresh to try again.', loading: false })
    })
    return () => { current = false }
  }, [episodeId])
  return state.episodeId === episodeId ? state : { notes: '', error: '', loading: Boolean(episodeId) }
}
