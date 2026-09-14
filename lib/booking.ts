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

function parseNumber(value: string | null, fallback: number) {
  if (value === null) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseList(value: string | null, fallback: string[]) {
  if (!value) return fallback
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getBookingPhysician(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
  fallbackPhysician?: { id?: string; name?: string; specialty?: string; hospital?: string; imageUrl?: string; consultationFee?: number; experienceYears?: number; rating?: number; languages?: string[]; insurance?: string[] } | null,
): BookingPhysicianData {
  const physicianId = searchParams.get('physicianId') ?? searchParams.get('provider_id') ?? fallbackPhysician?.id ?? ''
  const fromStore = physicianId ? PHYSICIANS.find((item) => item.id === physicianId) : undefined
  const base = fromStore ?? fallbackPhysician

  return {
    id: physicianId || base?.id || 'sophia-reed',
    name: searchParams.get('physicianName') ?? base?.name ?? 'Selected physician',
    specialty: searchParams.get('physicianSpecialty') ?? base?.specialty ?? 'Specialist',
    hospital: searchParams.get('physicianHospital') ?? base?.hospital ?? 'Qarevo Care Network',
    imageUrl: searchParams.get('physicianImageUrl') ?? base?.imageUrl ?? 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=220&h=220&fit=crop',
    consultationFee: parseNumber(searchParams.get('physicianConsultationFee') ?? null, base?.consultationFee ?? 140),
    experienceYears: parseNumber(searchParams.get('physicianExperienceYears') ?? null, base?.experienceYears ?? 12),
    rating: parseNumber(searchParams.get('physicianRating') ?? null, base?.rating ?? 4.9),
    languages: parseList(searchParams.get('physicianLanguages') ?? null, base?.languages ?? ['English', 'French']),
    insurance: parseList(searchParams.get('physicianInsurance') ?? null, base?.insurance ?? ['Axa']),
  }
}

export function buildBookingQueryParams(
  params: URLSearchParams | { toString: () => string },
  physician: BookingPhysicianData | null | undefined,
  service: string | null | undefined,
) {
  const next = new URLSearchParams(params.toString())

  if (physician) {
    next.set('physicianId', physician.id)
    next.set('physicianName', physician.name)
    next.set('physicianSpecialty', physician.specialty)
    next.set('physicianHospital', physician.hospital)
    next.set('physicianImageUrl', physician.imageUrl)
    next.set('physicianConsultationFee', String(physician.consultationFee))
    next.set('physicianExperienceYears', String(physician.experienceYears))
    next.set('physicianRating', String(physician.rating))
    next.set('physicianLanguages', physician.languages.join(','))
    next.set('physicianInsurance', physician.insurance.join(','))
  }

  if (service) {
    next.set('service', service)
    next.set('service_type', service)
  }

  return next
}
