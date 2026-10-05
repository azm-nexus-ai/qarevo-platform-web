'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'


type ProviderItem = {
  id: string
  name: string
  specialty: string
  hospital: string
  experience: string
  languages: string[]
  rating: string
  insurance: string[]
  distance: string
  fee: string
  available: string
  imageUrl: string
  bio: string
  expertise: string[]
  education: string[]
  certifications: string[]
  consultationTypes: string[]
  locations: string[]
}

type SummaryCardItem = {
  label: string
  value: string
  hint: string
}

type DocumentItem = {
  title: string
  meta: string
}

type TimelineItem = {
  title: string
  body: string
  state: 'done' | 'active' | 'pending'
}


const summaryCards: SummaryCardItem[] = [
  { label: 'Active referrals', value: '03', hint: '2 need follow-up' },
  { label: 'Booked referrals', value: '01', hint: 'Specialist appointment confirmed' },
  { label: 'Pending referrals', value: '02', hint: 'Awaiting review' },
  { label: 'Completed referrals', value: '01', hint: 'Treatment is ongoing' },
]

const providers: ProviderItem[] = [
  {
    id: 'naomi',
    name: 'Dr. Naomi Mensah',
    specialty: 'Cardiology',
    hospital: 'Qarevo Specialist Suite',
    experience: '14 years',
    languages: ['English', 'Twi'],
    rating: '4.9',
    insurance: ['Axa', 'Cigna'],
    distance: '3.2 km',
    fee: '$160',
    available: 'Tomorrow • 9:30 AM',
    imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80',
    bio: 'Dr. Mensah supports cardiac recovery, symptom monitoring, and post-consultation care planning with a calm and practical approach.',
    expertise: ['Cardiac monitoring', 'Preventive cardiology', 'Recovery planning'],
    education: ['MBChB, University of Ghana', 'Cardiology Fellowship, Korle Bu Teaching Hospital'],
    certifications: ['American College of Cardiology', 'ECG Interpretation Advanced'],
    consultationTypes: ['Virtual', 'In-Person', 'Hybrid'],
    locations: ['Qarevo Specialist Suite', 'Northpoint Heart Center'],
  },
  {
    id: 'amina',
    name: 'Amina Yusuf',
    specialty: 'Nutrition & Recovery',
    hospital: 'Qarevo Recovery Studio',
    experience: '11 years',
    languages: ['English', 'French'],
    rating: '4.8',
    insurance: ['Axa', 'Bupa'],
    distance: '5.6 km',
    fee: '$95',
    available: 'Friday • 2:00 PM',
    imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80',
    bio: 'Amina helps patients build recovery-focused nutrition habits that align with medical instructions and lifestyle needs.',
    expertise: ['Nutrition recovery', 'Hydration planning', 'Wellness coaching'],
    education: ['BSc Nutrition, University of Cape Coast', 'Clinical Dietetics Certification'],
    certifications: ['Certified Nutrition Specialist', 'Lifestyle Medicine'],
    consultationTypes: ['Virtual', 'In-Person'],
    locations: ['Qarevo Recovery Studio', 'Virtual Care'],
  },
  {
    id: 'theo',
    name: 'Dr. Theo Addo',
    specialty: 'Diagnostics Coordination',
    hospital: 'Northpoint Care Center',
    experience: '9 years',
    languages: ['English', 'Ga'],
    rating: '4.7',
    insurance: ['Axa', 'Sanlam'],
    distance: '7.1 km',
    fee: '$110',
    available: 'Monday • 11:15 AM',
    imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=80',
    bio: 'Theo helps patients coordinate diagnostic reviews, follow-up planning, and cross-provider care updates.',
    expertise: ['Lab follow-up', 'Care coordination', 'Diagnostic planning'],
    education: ['MBChB, University of Ghana', 'Internal Medicine Residency'],
    certifications: ['Care Coordination Specialist', 'Patient Navigation'],
    consultationTypes: ['Virtual', 'Hybrid'],
    locations: ['Northpoint Care Center', 'Qarevo Care Hub'],
  },
]

const documents: DocumentItem[] = [
  { title: 'Referral Letter', meta: 'PDF • Ready to preview' },
  { title: 'Consultation Notes', meta: 'Shared with care team' },
  { title: 'Medical Report', meta: 'Updated this week' },
  { title: 'Diagnostic Results', meta: 'Available for specialist review' },
  { title: 'Prescription Summary', meta: 'Prepared for continuity' },
]

const timeline: TimelineItem[] = [
  { title: 'Referral created', body: 'Your physician shared the referral and care rationale.', state: 'done' },
  { title: 'Patient viewed', body: 'You reviewed the referral package and next steps.', state: 'done' },
  { title: 'Appointment booked', body: 'A specialist slot is selected and ready to confirm.', state: 'active' },
  { title: 'Specialist consultation', body: 'The specialist visit will be completed after the appointment.', state: 'pending' },
  { title: 'Treatment continued', body: 'Your plan will remain coordinated after the review.', state: 'pending' },
  { title: 'Referral completed', body: 'The care loop closes once follow-up is complete.', state: 'pending' },
]

function ReferralsPageContent() {
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const physicianName = searchParams.get('physicianName') ?? physician?.name ?? ''
  const specialty = searchParams.get('specialty') ?? physician?.specialty ?? ''
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? ''
  const notes = searchParams.get('notes') ?? ''

  const [selectedProvider, setSelectedProvider] = useState(providers[0].id)
  const [selectedDate, setSelectedDate] = useState('2026-08-12')
  const [selectedTime, setSelectedTime] = useState('09:30')
  const [consultationType, setConsultationType] = useState('Virtual')
  const [expandedProvider, setExpandedProvider] = useState<string | null>(providers[0].id)

  const followUpHref = useMemo(() => {
    const params = new URLSearchParams({
      physicianId,
      physicianName,
      specialty,
      date,
      slot,
      duration,
      insurance,
      notes,
    })
    return `/patient/follow-up?${params.toString()}`
  }, [date, duration, insurance, notes, physicianId, physicianName, slot, specialty])

  const chosenProvider = providers.find((provider) => provider.id === selectedProvider) ?? providers[0]


  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .ref-hero, .ref-card, .ref-summary-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; }
        .ref-hero { border-radius: 28px; padding: 24px; position: relative; overflow: hidden; }
        .ref-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.16), transparent 34%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.12), transparent 28%); pointer-events: none; }
        .ref-card { border-radius: 24px; padding: 20px; margin-top: 14px; }
        .ref-summary-card { border-radius: 24px; padding: 18px; display: grid; gap: 10px; }
        .ref-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .ref-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(165,224,218,0.26); color: ${T.navy}; font-size: 11px; font-weight: 700; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.12); background: rgba(255,255,255,0.92); color: ${T.navy}; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s ease; }
        .action-btn:hover, .action-btn:focus-visible, .icon-btn:hover, .icon-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .action-btn.primary { background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: #fff; border: none; box-shadow: 0 8px 22px rgba(32,181,223,0.24); }
        .action-btn.secondary { background: rgba(247,250,252,0.95); }
        .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .summary-card { padding: 14px; border-radius: 16px; background: linear-gradient(135deg, rgba(247,250,252,0.96) 0%, rgba(255,255,255,0.92) 100%); border: 1px solid rgba(4,53,77,0.08); }
        .summary-card strong { display: block; font-size: 20px; color: ${T.navy}; margin-top: 6px; }
        .summary-card span { display: block; font-size: 11px; color: ${T.slate2}; text-transform: uppercase; letter-spacing: 0.06em; }
        .summary-card small { display: block; margin-top: 6px; font-size: 12px; color: ${T.slate}; }
        .detail-grid, .coord-grid, .insurance-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .detail-card, .coord-card, .insurance-card, .doc-card, .timeline-card { padding: 14px; border-radius: 16px; background: rgba(247,250,252,0.92); border: 1px solid rgba(4,53,77,0.08); }
        .provider-card { position: relative; overflow: hidden; border-radius: 20px; padding: 16px; border: 1px solid rgba(4,53,77,0.08); background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,250,252,0.94) 100%); transition: transform 0.2s ease, box-shadow 0.2s ease; margin-top: 12px; }
        .provider-card:hover { transform: translateY(-2px); box-shadow: ${Sh.glow}; }
        .provider-card.active { border-color: rgba(32,181,223,0.28); box-shadow: ${Sh.glow}; }
        .provider-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top right, rgba(32,181,223,0.09), transparent 30%); pointer-events: none; }
        .provider-head { position: relative; z-index: 1; display: flex; gap: 14px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
        .provider-photo { width: 62px; height: 62px; border-radius: 18px; object-fit: cover; border: 1px solid rgba(4,53,77,0.12); }
        .provider-meta { position: relative; z-index: 1; display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
        .provider-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 999px; background: rgba(255,255,255,0.95); border: 1px solid rgba(4,53,77,0.08); color: ${T.navy}; font-size: 11px; font-weight: 700; }
        .provider-actions { position: relative; z-index: 1; display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
        .icon-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.1); background: rgba(255,255,255,0.95); color: ${T.navy}; font-size: 12px; font-weight: 700; cursor: pointer; }
        .action-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
        .small-label { font-size: 10px; font-weight: 700; color: ${T.slate2}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .timeline-dot-done { background: ${T.blue}; }
        .timeline-dot-active { background: ${T.green}; animation: tl-pulse 2s infinite; }
        .timeline-dot-pending { background: rgba(4,53,77,0.18); }
        @keyframes tl-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(32,181,223,0.4); } 70% { box-shadow: 0 0 0 8px rgba(32,181,223,0); } }
        @media (max-width: 780px) { .summary-grid { grid-template-columns: repeat(2,1fr); } .detail-grid, .coord-grid, .insurance-grid { grid-template-columns: 1fr; } }
      `}</style>
      <PatientPortalShell
        eyebrow="Referrals"
        title="Specialist Referrals"
        description="Your care team has arranged specialist referrals to support your ongoing treatment and recovery."
      >
          <section className='ref-hero'>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className='ref-pill'>Referrals & specialist care</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Specialist care is being coordinated for your next stage of treatment</h1>
              <p style={{ margin: '0 0 16px', maxWidth: '760px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>Based on your recent consultation, your physician has recommended specialist support to keep the care plan clear, connected, and easy to move forward.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <Link href={followUpHref} className='action-btn primary'>Continue to follow-up appointment</Link>
                <Link href={PATIENT_ROUTES.dashboard} className='action-btn secondary'>Return to dashboard</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginTop: '16px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div className='small-label'>Referral date</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{date}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div className='small-label'>Referring physician</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{physicianName}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div className='small-label'>Referral status</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>In progress</div>
                </div>
              </div>
            </div>
          </section>

          <section className='ref-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Referral summary</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Your care journey at a glance</h2>
              </div>
              <div className='ref-chip'>Coordinated care</div>
            </div>
            <div className='summary-grid'>
              {summaryCards.map((card) => (
                <div key={card.label} className='summary-card'>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.hint}</small>
                </div>
              ))}
            </div>
          </section>

          <section className='ref-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Referral details</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>A premium referral overview</h2>
              </div>
              <div className='ref-chip'>Urgent review</div>
            </div>
            <div className='detail-grid'>
              <div className='detail-card'>
                <div className='small-label'>Referring physician</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: T.navy }}>{physicianName}</div>
                <div style={{ fontSize: '13px', color: T.slate, marginTop: '6px' }}>{specialty}</div>
              </div>
              <div className='detail-card'>
                <div className='small-label'>Reason for referral</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: T.navy }}>Focused specialist review</div>
                <div style={{ fontSize: '13px', color: T.slate, marginTop: '6px' }}>{notes || 'Review is being coordinated to support your current recovery plan and monitor ongoing symptoms.'}</div>
              </div>
              <div className='detail-card'>
                <div className='small-label'>Clinical notes</div>
                <div style={{ fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>The care team has highlighted symptom continuity, medication adherence, and the need for a coordinated specialist follow-up to support your treatment plan.</div>
              </div>
              <div className='detail-card'>
                <div className='small-label'>Urgency</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <span className='ref-chip'>Routine</span>
                  <span className='ref-chip'>Priority</span>
                  <span className='ref-chip'>Urgent</span>
                </div>
                <div style={{ fontSize: '13px', color: T.slate, marginTop: '8px' }}>Referral expiry: 14 Aug 2026</div>
              </div>
            </div>
          </section>

          <section className='ref-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recommended specialists</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Browse providers and compare your options</h2>
              </div>
              <div className='ref-chip'>Verified providers</div>
            </div>
            {providers.map((provider) => {
              const isExpanded = expandedProvider === provider.id
              const isSelected = selectedProvider === provider.id
              return (
                <div key={provider.id} className={`provider-card ${isSelected ? 'active' : ''}`}>
                  <div className='provider-head'>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <img className='provider-photo' src={provider.imageUrl} alt={provider.name} />
                      <div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: T.navy }}>{provider.name}</h3>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '999px', background: 'rgba(32,181,223,0.12)', color: T.blue, fontSize: '10px', fontWeight: 700 }}>Verified</span>
                        </div>
                        <div style={{ fontSize: '12px', color: T.slate, marginTop: '4px' }}>{provider.specialty} • {provider.hospital}</div>
                      </div>
                    </div>
                    <div style={{ minWidth: '120px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.84)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Earliest</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy }}>{provider.available}</div>
                    </div>
                  </div>
                  <div className='provider-meta'>
                    <span className='provider-pill'>⭐ {provider.rating}</span>
                    <span className='provider-pill'>Experience {provider.experience}</span>
                    <span className='provider-pill'>Languages {provider.languages.join(', ')}</span>
                    <span className='provider-pill'>Insurance {provider.insurance.join(' • ')}</span>
                    <span className='provider-pill'>Distance {provider.distance}</span>
                    <span className='provider-pill'>Fee {provider.fee}</span>
                  </div>
                  <div className='provider-actions'>
                    <button type='button' onClick={() => setExpandedProvider(isExpanded ? null : provider.id)} className='icon-btn'>View profile</button>
                    <button type='button' onClick={() => setSelectedProvider(provider.id)} className='icon-btn' style={{ background: isSelected ? 'rgba(32,181,223,0.12)' : 'rgba(255,255,255,0.95)', color: isSelected ? T.blue : T.navy }}>Book appointment</button>
                  </div>
                  {isExpanded ? (
                    <div className='preview-panel'>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: T.blue, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Profile preview</div>
                      <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>{provider.bio}</p>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        <div>
                          <div className='small-label'>Areas of expertise</div>
                          <div style={{ fontSize: '13px', color: T.navy, fontWeight: 600 }}>{provider.expertise.join(' • ')}</div>
                        </div>
                        <div>
                          <div className='small-label'>Education</div>
                          <div style={{ fontSize: '13px', color: T.navy, fontWeight: 600 }}>{provider.education.join(' • ')}</div>
                        </div>
                        <div>
                          <div className='small-label'>Consultation types</div>
                          <div style={{ fontSize: '13px', color: T.navy, fontWeight: 600 }}>{provider.consultationTypes.join(' • ')}</div>
                        </div>
                        <div>
                          <div className='small-label'>Available locations</div>
                          <div style={{ fontSize: '13px', color: T.navy, fontWeight: 600 }}>{provider.locations.join(' • ')}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </section>

          <section className='ref-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Book specialist</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Schedule the next stage of your treatment</h2>
              </div>
              <div className='ref-chip'>Flexible booking</div>
            </div>
            <div className='detail-grid'>
              <div className='detail-card'>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Select provider</label>
                <select value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)} className='field'>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </div>
              <div className='detail-card'>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Select date</label>
                <input type='date' value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className='field' />
              </div>
              <div className='detail-card'>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Select time</label>
                <input type='time' value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} className='field' />
              </div>
              <div className='detail-card'>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Choose consultation type</label>
                <select value={consultationType} onChange={(event) => setConsultationType(event.target.value)} className='field'>
                  <option value='Virtual'>Virtual</option>
                  <option value='In-Person'>In-Person</option>
                  <option value='Hybrid'>Hybrid</option>
                </select>
              </div>
            </div>
            <div className='action-row'>
              <Link href={followUpHref} className='action-btn primary'>Continue to follow-up appointment</Link>
              <button type='button' className='action-btn secondary'>Message care team</button>
            </div>
          </section>

          <section className='ref-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Referral documents</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Secure documents for your specialist</h2>
              </div>
              <div className='ref-chip'>Ready to share</div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {documents.map((document) => (
                <div key={document.title} className='doc-card'>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{document.title}</div>
                      <div style={{ fontSize: '12px', color: T.slate, marginTop: '4px' }}>{document.meta}</div>
                    </div>
                    <div className='doc-actions'>
                      <button type='button' className='tiny-btn'>Preview</button>
                      <button type='button' className='tiny-btn'>Download</button>
                      <button type='button' className='tiny-btn'>Share securely</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='ref-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Referral tracker</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Track the progress of your referral</h2>
              </div>
              <div className='ref-chip'>Interactive care timeline</div>
            </div>
            <div className='timeline'>
              {timeline.map((item) => (
                <div key={item.title} className={`timeline-item ${item.state}`}>
                  <div className='dot' />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.6, marginTop: '4px' }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='ref-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Care coordination</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>A connected care team around you</h2>
              </div>
              <div className='ref-chip'>Shared records</div>
            </div>
            <div className='coord-grid'>
              <div className='coord-card'>
                <div className='small-label'>Primary physician</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>{physicianName}</div>
              </div>
              <div className='coord-card'>
                <div className='small-label'>Referred specialist</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>{chosenProvider.name}</div>
              </div>
              <div className='coord-card'>
                <div className='small-label'>Shared medical records</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>Enabled</div>
              </div>
              <div className='coord-card'>
                <div className='small-label'>Treatment collaboration</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>Active</div>
              </div>
            </div>
          </section>

          <section className='ref-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insurance information</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Coverage and pre-approval details</h2>
              </div>
              <div className='ref-chip'>Authorisation status</div>
            </div>
            <div className='insurance-grid'>
              <div className='insurance-card'>
                <div className='small-label'>Covered providers</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>{chosenProvider.insurance.join(' • ')}</div>
              </div>
              <div className='insurance-card'>
                <div className='small-label'>Estimated cost</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>{chosenProvider.fee}</div>
              </div>
              <div className='insurance-card'>
                <div className='small-label'>Referral approval</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>Approved</div>
              </div>
              <div className='insurance-card'>
                <div className='small-label'>Authorisation status</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>Pending confirmation</div>
              </div>
            </div>
          </section>
      </PatientPortalShell>
    </>
  )
}

export default function ReferralsPage() {
  return (
    <Suspense>
      <ReferralsPageContent />
    </Suspense>
  )
}
