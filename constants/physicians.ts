export interface Physician {
  id: string
  name: string
  specialty: string
  hospital: string
  experienceYears: number
  rating: number
  reviews: number
  consultationFee: number
  nextAvailable: string
  nextAvailableAt?: string | null
  languages: string[]
  insurance: string[]
  gender: 'female' | 'male'
  consultationTypes: Array<'video' | 'physical'>
  distanceKm: number | null
  conditions: string[]
  imageUrl: string
  verification: string
  tags: string[]
}

export interface PhysicianService {
  type: 'video' | 'physical' | 'follow-up' | 'emergency'
  label: string
  price: number
  duration: string
  availability: string
}

export interface PhysicianReview {
  id: string
  patient: string
  rating: number
  date: string
  helpful: number
  body: string
}

export interface PhysicianProfileContent {
  subSpecialties: string[]
  patientsTreated: string
  consultationsDone: string
  responseTime: string
  availabilityStatus: 'available-now' | 'available-today' | 'limited'
  biography: string
  specializations: string[]
  education: Array<{ title: string; org: string; period: string }>
  experienceTimeline: Array<{ title: string; org: string; period: string }>
  services: PhysicianService[]
  availabilitySlots: Array<{ day: string; dayLabel?: string; timezone: string; slots: string[] }>
  reviews: PhysicianReview[]
  faq: Array<{ q: string; a: string }>
  location: {
    address: string
    directions: string
    parking: string
    accessibility: string
    practiceName?: string | null
    latitude?: number | null
    longitude?: number | null
  }
}

export const QUICK_SPECIALTIES = [
  'All',
  'General Practice',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Neurology',
  'Orthopedics',
  'Gynecology',
  'Mental Health',
  'Dentistry',
  'Ophthalmology',
  'Emergency Medicine',
] as const

export const LANGUAGE_OPTIONS = ['Any', 'German', 'English', 'Turkish', 'Arabic', 'Russian', 'Polish', 'Ukrainian', 'French', 'Spanish', 'Italian'] as const
