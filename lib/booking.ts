import { PHYSICIANS } from '@/constants/physicians'

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
  fallbackPhysician?: { id?: string; name?: string; specialty?: string; hospital?: string; imageUrl?: string; consultationFee?: number; experienceYears?: number; rating?: number; languages?: string[]; insurance?: string[] } | null,
): BookingPhysicianData {
  const physicianId = searchParams.get('physicianId') ?? searchParams.get('provider_id') ?? fallbackPhysician?.id ?? ''
  const fromStore = physicianId ? PHYSICIANS.find((item) => item.id === physicianId) : undefined
  const base = fromStore ?? fallbackPhysician

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
  physician: BookingPhysicianData | null | undefined,
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
