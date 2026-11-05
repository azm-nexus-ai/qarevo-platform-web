export type BookingPhysicianData = {
  id: string
  name: string
  specialty: string
  hospital: string
  imageUrl: string
  consultationFee: number
  experienceYears: number
  rating: number
  languages: string[]
  insurance: string[]
}

export function getBookingPhysician(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
  fallbackPhysician?: { id?: string; name?: string; specialty?: string; hospital?: string; imageUrl?: string | null; consultationFee?: number; experienceYears?: number; rating?: number; languages?: string[]; insurance?: string[] } | null,
): BookingPhysicianData {
  const explicitProvider = searchParams.get('physicianId') !== null || searchParams.get('provider_id') !== null
  const physicianId = explicitProvider ? readBookingProviderId(searchParams) : fallbackPhysician?.id ?? ''
  // Clinical identity comes from the authenticated API, never bundled demo profiles.
  const base = fallbackPhysician?.id === physicianId ? fallbackPhysician : undefined

  return {
    id: physicianId || base?.id || '',
    name: base?.name ?? 'Loading physician...',
    specialty: base?.specialty ?? 'Specialist',
    hospital: base?.hospital ?? 'Care location not configured',
    imageUrl: base?.imageUrl ?? '',
    consultationFee: base?.consultationFee ?? 0,
    experienceYears: base?.experienceYears ?? 0,
    rating: base?.rating ?? 0,
    languages: base?.languages ?? [],
    insurance: base?.insurance ?? [],
  }
}

export function buildBookingQueryParams(
  params: URLSearchParams | { toString: () => string },
  physician: Pick<BookingPhysicianData, 'id'> | null | undefined,
  service: string | null | undefined,
) {
  // Only bounded scheduling identifiers belong in navigation. Physician images,
  // profiles and clinical intake are fetched through authenticated API requests.
  const source = new URLSearchParams(params.toString())
  const next = new URLSearchParams()
  const rules: Record<string, RegExp> = {
    physicianId: /^[a-zA-Z0-9_-]{1,80}$/,
    provider_id: /^[a-zA-Z0-9_-]{1,80}$/,
    service: /^(video|physical|follow-up)$/,
    service_type: /^(video|physical|follow-up)$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    slot: /^[0-9APMapm: .-]{1,24}$/,
    start_at: /^[0-9TtZz:+.\-]{1,40}$/,
    end_at: /^[0-9TtZz:+.\-]{1,40}$/,
    episode_id: /^[a-zA-Z0-9_-]{1,80}$/,
    episodeId: /^[a-zA-Z0-9_-]{1,80}$/,
    appointmentId: /^[a-zA-Z0-9_-]{1,80}$/,
    consultationId: /^[a-zA-Z0-9_-]{1,80}$/,
    aiDraftJobId: /^[a-zA-Z0-9_-]{1,80}$/,
    intake_submitted: /^true$/,
    from: /^(profile|find-doctor|dashboard|redirect)$/,
  }
  for (const [key, pattern] of Object.entries(rules)) {
    const value = source.get(key)
    if (value && pattern.test(value)) next.set(key, value)
  }
  if (physician && rules.physicianId.test(physician.id)) {
    next.set('physicianId', physician.id)
    next.set('provider_id', physician.id)
  }
  if (service && rules.service.test(service)) {
    next.set('service', service)
    next.set('service_type', service)
  }
  return next
}


/** Both legacy aliases may occur, but a malformed or conflicting identity is not selectable. */
export function readBookingProviderId(params: { get: (key: string) => string | null }): string {
  const values = [params.get('physicianId'), params.get('provider_id')].filter((value): value is string => value !== null)
  if (!values.length || values.some(value => !/^[a-zA-Z0-9_-]{1,80}$/.test(value))) return ''
  return values.every(value => value === values[0]) ? values[0] : ''
}

export function bookingService(params: { get: (key: string) => string | null }): string {
  const service = params.get('service') ?? params.get('service_type')
  return service && /^(video|physical|follow-up)$/.test(service) ? service : 'video'
}

/** Keep bounded care references while discarding the previous doctor's times and identity. */
export function buildDoctorDiscoveryHref(params: { toString: () => string }, service?: string | null): string {
  const source = new URLSearchParams(params.toString())
  const next = buildBookingQueryParams(source, null, service ?? bookingService(source))
  for (const key of ['physicianId', 'provider_id', 'slot', 'start_at', 'end_at']) next.delete(key)
  return `/patient/find-doctor${next.size ? `?${next.toString()}` : ''}`
}

export function bookingEntryDestination(params: { toString: () => string }): string {
  const source = new URLSearchParams(params.toString())
  const provider = readBookingProviderId(source)
  if (!provider) return buildDoctorDiscoveryHref(source)
  const next = buildBookingQueryParams(source, {id: provider}, bookingService(source))
  if (!next.has('from')) next.set('from', 'redirect')
  return `/patient/consultation-booking/date-time?${next.toString()}`
}

/** Legacy service price numbers are not an approved, currency-bound patient quote. */
export const CONSULTATION_PRICING_PENDING = 'Pricing pending setup'
