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
  languages: string[]
  insurance: string[]
  gender: 'female' | 'male'
  consultationTypes: Array<'video' | 'physical'>
  distanceKm: number
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

export const LANGUAGE_OPTIONS = ['Any', 'English', 'French', 'Arabic', 'Yoruba', 'Spanish'] as const

export const INSURANCE_OPTIONS = ['Any', 'Axa', 'Bupa', 'Cigna', 'Sanlam', 'BlueCross'] as const

export const PHYSICIANS: Physician[] = [
  {
    id: 'sophia-reed',
    name: 'Dr. Sophia Reed',
    specialty: 'Cardiology',
    hospital: 'Qarevo Heart Institute',
    experienceYears: 12,
    rating: 4.9,
    reviews: 312,
    consultationFee: 185,
    nextAvailable: 'Today, 4:30 PM',
    languages: ['English', 'French'],
    insurance: ['Axa', 'Bupa', 'Cigna'],
    gender: 'female',
    consultationTypes: ['video', 'physical'],
    distanceKm: 3.8,
    conditions: ['Hypertension', 'Arrhythmia', 'Chest Pain'],
    imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=220&h=220&fit=crop',
    verification: '2026.08',
    tags: ['Preventive Cardiology', 'Chronic Care'],
  },
  {
    id: 'daniel-mensah',
    name: 'Dr. Daniel Mensah',
    specialty: 'General Practice',
    hospital: 'Qarevo Family Clinic',
    experienceYears: 14,
    rating: 4.8,
    reviews: 421,
    consultationFee: 110,
    nextAvailable: 'Today, 6:00 PM',
    languages: ['English', 'Yoruba'],
    insurance: ['Axa', 'Sanlam'],
    gender: 'male',
    consultationTypes: ['video', 'physical'],
    distanceKm: 2.1,
    conditions: ['Primary Care', 'Wellness', 'Acute Illness'],
    imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=220&h=220&fit=crop',
    verification: '2026.08',
    tags: ['Primary Care', 'Preventive Care'],
  },
  {
    id: 'amara-okafor',
    name: 'Dr. Amara Okafor',
    specialty: 'Endocrinology',
    hospital: 'Metro Specialist Center',
    experienceYears: 11,
    rating: 4.8,
    reviews: 278,
    consultationFee: 165,
    nextAvailable: 'Tomorrow, 10:00 AM',
    languages: ['English', 'Arabic'],
    insurance: ['Bupa', 'Cigna'],
    gender: 'female',
    consultationTypes: ['video'],
    distanceKm: 8.4,
    conditions: ['Diabetes', 'Thyroid', 'Hormonal Care'],
    imageUrl: 'https://images.unsplash.com/photo-1594824475317-4f260b6993f3?w=220&h=220&fit=crop',
    verification: '2026.07',
    tags: ['Diabetes', 'Hormonal Health'],
  },
  {
    id: 'elena-costa',
    name: 'Dr. Elena Costa',
    specialty: 'Pediatrics',
    hospital: 'North Children Hospital',
    experienceYears: 9,
    rating: 4.9,
    reviews: 356,
    consultationFee: 140,
    nextAvailable: 'Today, 8:15 PM',
    languages: ['English', 'Spanish'],
    insurance: ['Axa', 'BlueCross'],
    gender: 'female',
    consultationTypes: ['video', 'physical'],
    distanceKm: 5.2,
    conditions: ['Child Wellness', 'Vaccination', 'Fever'],
    imageUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=220&h=220&fit=crop',
    verification: '2026.08',
    tags: ['Pediatric Care', 'Family Support'],
  },
  {
    id: 'michael-adebayo',
    name: 'Dr. Michael Adebayo',
    specialty: 'Orthopedics',
    hospital: 'Orthopedic and Spine Unit',
    experienceYears: 16,
    rating: 4.7,
    reviews: 198,
    consultationFee: 210,
    nextAvailable: 'Wed, 11:45 AM',
    languages: ['English'],
    insurance: ['Bupa', 'Cigna', 'BlueCross'],
    gender: 'male',
    consultationTypes: ['physical'],
    distanceKm: 11.6,
    conditions: ['Back Pain', 'Joint Pain', 'Sports Injury'],
    imageUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=220&h=220&fit=crop',
    verification: '2026.06',
    tags: ['Orthopedic Surgery', 'Rehab'],
  },
  {
    id: 'lina-farah',
    name: 'Dr. Lina Farah',
    specialty: 'Dermatology',
    hospital: 'Prime Skin and Aesthetics',
    experienceYears: 10,
    rating: 4.9,
    reviews: 267,
    consultationFee: 155,
    nextAvailable: 'Today, 7:20 PM',
    languages: ['English', 'Arabic'],
    insurance: ['Axa', 'Sanlam'],
    gender: 'female',
    consultationTypes: ['video', 'physical'],
    distanceKm: 6.8,
    conditions: ['Acne', 'Eczema', 'Skin Allergy'],
    imageUrl: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=220&h=220&fit=crop',
    verification: '2026.07',
    tags: ['Skin Health', 'Preventive Dermatology'],
  },
]

export const PHYSICIAN_PROFILES: Record<string, PhysicianProfileContent> = {
  'sophia-reed': {
    subSpecialties: ['Preventive Cardiology', 'Women\'s Heart Health', 'Hypertension'],
    patientsTreated: '2,500+',
    consultationsDone: '1,200+',
    responseTime: '< 15 mins',
    availabilityStatus: 'available-today',
    biography:
      'Dr. Sophia Reed is a consultant cardiologist focused on preventive and long-term cardiovascular care. Her patient-first model blends evidence-based medicine with practical lifestyle interventions, helping patients build sustainable heart-health outcomes with confidence and clarity.',
    specializations: ['General Medicine', 'Cardiology', 'Diabetes Management', 'Preventive Care', 'Hypertension', 'Women\'s Health', 'Telemedicine'],
    education: [
      { title: 'MD, Cardiology', org: 'Harvard Medical School', period: '2008 - 2012' },
      { title: 'Residency, Internal Medicine', org: 'Mayo Clinic', period: '2012 - 2015' },
      { title: 'Fellowship, Cardiovascular Disease', org: 'Cleveland Clinic', period: '2015 - 2017' },
      { title: 'Board Certification', org: 'American Board of Internal Medicine', period: '2017' },
      { title: 'Continuing Medical Education', org: 'ESC Preventive Cardiology', period: '2025' },
    ],
    experienceTimeline: [
      { title: 'Senior Consultant Cardiologist', org: 'Qarevo Heart Institute', period: '2022 - Present' },
      { title: 'Consultant Cardiologist', org: 'Metro Specialist Center', period: '2019 - 2022' },
      { title: 'Clinical Research Fellow', org: 'Heart Outcomes Lab', period: '2017 - 2019' },
      { title: 'Adjunct Clinical Lecturer', org: 'City Medical College', period: '2018 - Present' },
    ],
    services: [
      { type: 'video', label: 'Video Consultation', price: 185, duration: '30 min', availability: 'Today' },
      { type: 'physical', label: 'In-person Consultation', price: 220, duration: '40 min', availability: 'Tomorrow' },
      { type: 'follow-up', label: 'Follow-up Consultation', price: 120, duration: '20 min', availability: 'Today' },
      { type: 'emergency', label: 'Emergency Consultation', price: 260, duration: '20 min', availability: 'Limited' },
    ],
    availabilitySlots: [
      { day: 'Mon', timezone: 'WAT (UTC+1)', slots: ['09:00', '11:30', '16:30'] },
      { day: 'Tue', timezone: 'WAT (UTC+1)', slots: ['10:00', '14:00', '18:15'] },
      { day: 'Wed', timezone: 'WAT (UTC+1)', slots: ['08:45', '12:30', '17:30'] },
      { day: 'Thu', timezone: 'WAT (UTC+1)', slots: ['09:30', '13:45', '16:00'] },
      { day: 'Fri', timezone: 'WAT (UTC+1)', slots: ['10:15', '15:00'] },
    ],
    reviews: [
      { id: 'r1', patient: 'A. Bello', rating: 5, date: 'Jul 29, 2026', helpful: 34, body: 'Dr. Reed explained my treatment plan clearly and followed up quickly after the consultation.' },
      { id: 'r2', patient: 'M. Laurent', rating: 5, date: 'Jul 22, 2026', helpful: 21, body: 'Very professional and warm. The video consultation felt structured and reassuring.' },
      { id: 'r3', patient: 'J. Ade', rating: 4, date: 'Jul 16, 2026', helpful: 17, body: 'Great expertise and practical advice. Appointment started a few minutes late but was worth it.' },
      { id: 'r4', patient: 'K. Ortiz', rating: 5, date: 'Jul 08, 2026', helpful: 26, body: 'Helped me understand my blood pressure trends and set realistic goals.' },
    ],
    faq: [
      { q: 'What conditions does this physician treat?', a: 'Dr. Reed treats cardiovascular risk conditions including hypertension, arrhythmia concerns, chest discomfort, and preventive heart-health optimization.' },
      { q: 'What happens during a video consultation?', a: 'You discuss symptoms, history, and goals. The physician reviews your records, provides recommendations, and outlines follow-up actions.' },
      { q: 'Can I upload documents before my appointment?', a: 'Yes. You can upload lab results, prior prescriptions, and medical notes before the consultation for a better clinical review.' },
      { q: 'Does the doctor prescribe medications online?', a: 'When clinically appropriate, prescriptions can be issued after a complete consultation and assessment.' },
    ],
    location: {
      address: 'Qarevo Heart Institute, 24 Marina Boulevard, Lagos',
      directions: '5 minutes from City Gate. Follow signs to Tower B, Level 3.',
      parking: 'Validated visitor parking available in Basement P2.',
      accessibility: 'Wheelchair access, elevator service, hearing loop support.',
    },
  },
}
