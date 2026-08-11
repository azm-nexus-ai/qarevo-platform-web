'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'


type TestRequestItem = {
  name: string
  category: string
  description: string
  reason: string
  priority: string
  completionDate: string
  processingTime: string
  status: string
  badgeTone: string
}

type LabItem = {
  name: string
  distance: string
  rating: string
  hours: string
  tests: string[]
  insurance: string
  address: string
}

type PreparationItem = {
  title: string
  body: string
}

type UploadItem = {
  title: string
  meta: string
}


const testRequests: TestRequestItem[] = [
  {
    name: 'Complete Blood Count',
    category: 'Blood Test',
    description: 'Baseline assessment of red cells, white cells, and platelets.',
    reason: 'Supports the current treatment review and confirms general wellness markers.',
    priority: 'Routine',
    completionDate: 'Wed, 14 Aug',
    processingTime: '24 hrs',
    status: 'Pending',
    badgeTone: 'rgba(32,181,223,0.12)',
  },
  {
    name: 'Lipid Panel',
    category: 'Cardiology',
    description: 'Measures cholesterol and triglyceride markers tied to cardiovascular care.',
    reason: 'Useful for understanding cardiovascular risk alongside current symptoms.',
    priority: 'Urgent',
    completionDate: 'Thu, 15 Aug',
    processingTime: '12 hrs',
    status: 'Booked',
    badgeTone: 'rgba(165,224,218,0.24)',
  },
  {
    name: 'Urinalysis',
    category: 'Urine Test',
    description: 'Checks for signs of infection, dehydration, and metabolic concerns.',
    reason: 'Complements the physician’s assessment of ongoing fatigue and recovery.',
    priority: 'Routine',
    completionDate: 'Fri, 16 Aug',
    processingTime: '8 hrs',
    status: 'Results Available',
    badgeTone: 'rgba(15,158,119,0.12)',
  },
]

const partnerLabs: LabItem[] = [
  {
    name: 'Northpoint Diagnostics',
    distance: '3.2 km',
    rating: '4.9',
    hours: '08:00 – 20:00',
    tests: ['CBC', 'Lipid Panel', 'Urinalysis'],
    insurance: 'Axa • Cigna',
    address: '21 Marina Road, Accra',
  },
  {
    name: 'Qarevo Imaging Hub',
    distance: '5.6 km',
    rating: '4.8',
    hours: '07:30 – 19:30',
    tests: ['Cardiology', 'Imaging', 'Pathology'],
    insurance: 'Bupa',
    address: '88 Kings Avenue, Accra',
  },
  {
    name: 'Metro Lab Network',
    distance: '8.1 km',
    rating: '4.7',
    hours: '06:30 – 18:30',
    tests: ['Blood Draw', 'Urine', 'Home Collection'],
    insurance: 'Sanlam',
    address: '55 Airport Street, Accra',
  },
]

const preparationItems: PreparationItem[] = [
  { title: 'Fast for 8 hours', body: 'Avoid food and drink except water before the blood draw.' },
  { title: 'Bring identification', body: 'Your ID and insurance card help the lab process your visit quickly.' },
  { title: 'Wear comfortable clothing', body: 'Easy-access sleeves support blood draws and imaging appointments.' },
  { title: 'Avoid medication', body: 'If instructed, pause specific medications before the test window.' },
]

const uploads: UploadItem[] = [
  { title: 'External Lab Report', meta: 'PDF • Uploaded 2 days ago' },
  { title: 'Previous Blood Results', meta: 'Image • Ready for review' },
]

function LabRequestsPageContent() {
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const physicianName = searchParams.get('physicianName') ?? physician?.name ?? 'Dr. Sophia Reed'
  const specialty = searchParams.get('specialty') ?? physician?.specialty ?? 'Cardiology'
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const notes = searchParams.get('notes') ?? ''

  const [selectedLab, setSelectedLab] = useState(partnerLabs[0].name)
  const [selectedDate, setSelectedDate] = useState('2026-08-14')
  const [selectedTime, setSelectedTime] = useState('09:30')
  const [homeCollection, setHomeCollection] = useState(true)

  const referralsHref = useMemo(() => {
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
    return `/patient/referrals?${params.toString()}`
  }, [date, duration, insurance, notes, physicianId, physicianName, slot, specialty])

  const rightRail = (
    <div className='lab-summary-card'>
      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Care summary</p>
      <h2 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800, color: T.navy }}>Diagnostic overview</h2>
      <div style={{ display: 'grid', gap: '8px' }}>
        {[
          ['Outstanding tests', '2 pending'],
          ['Upcoming lab appointment', 'Thu, 15 Aug'],
          ['Estimated completion', 'By 16 Aug'],
          ['Follow-up consultation', 'Next week'],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.06)' }}>
            <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '8px', padding: '12px 14px', borderRadius: '14px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '12px', fontWeight: 700, lineHeight: 1.65 }}>
        Your results will be shared with your physician and added to your ongoing care plan automatically.
      </div>
    </div>
  )

  return (
    <>
      <PatientPortalShell
      eyebrow="Lab Results"
      title="Lab Requests"
      description="Your physician has requested the following laboratory and diagnostic tests to support your treatment plan and help you feel informed at every step."
      rightRail={rightRail}
    >
      <style>{`
        * { box-sizing: border-box; }
        .lab-hero, .lab-card, .lab-summary-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; }
        .lab-hero { border-radius: 28px; padding: 24px; position: relative; overflow: hidden; }
        .lab-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.16), transparent 34%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.12), transparent 28%); pointer-events: none; }
        .lab-card { border-radius: 24px; padding: 20px; margin-top: 14px; }
        .lab-summary-card { border-radius: 24px; padding: 18px; display: grid; gap: 10px; }
        .lab-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .lab-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(165,224,218,0.26); color: ${T.navy}; font-size: 11px; font-weight: 700; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.12); background: rgba(255,255,255,0.92); color: ${T.navy}; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s ease; }
        .action-btn:hover, .action-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .action-btn.primary { background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: #fff; border: none; box-shadow: 0 8px 22px rgba(32,181,223,0.24); }
        .action-btn.secondary { background: rgba(247,250,252,0.95); }
        .request-card { position: relative; overflow: hidden; border-radius: 20px; padding: 16px; border: 1px solid rgba(4,53,77,0.08); background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,250,252,0.94) 100%); transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .request-card:hover { transform: translateY(-2px); box-shadow: ${Sh.glow}; }
        .request-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top right, rgba(32,181,223,0.09), transparent 28%); pointer-events: none; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .meta-item { padding: 10px 12px; border-radius: 12px; background: rgba(247,250,252,0.9); border: 1px solid rgba(4,53,77,0.06); }
        .meta-item span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: ${T.slate2}; margin-bottom: 3px; }
        .meta-item strong { font-size: 12px; color: ${T.navy}; }
        .select-input, .toggle-pill { min-height: 44px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.08); background: rgba(255,255,255,0.9); color: ${T.navy}; padding: 0 12px; font-size: 13px; font-weight: 600; }
        .toggle-pill { display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s ease; }
        .toggle-pill.active { background: rgba(32,181,223,0.12); color: ${T.blue}; border-color: rgba(32,181,223,0.24); }
        .timeline-item { position: relative; padding-left: 18px; margin-left: 6px; border-left: 1px solid rgba(32,181,223,0.18); }
        .timeline-item::before { content: ''; position: absolute; left: -5px; top: 4px; width: 10px; height: 10px; border-radius: 999px; background: ${T.blue}; box-shadow: 0 0 0 4px rgba(32,181,223,0.14); }
        .upload-card { padding: 12px 14px; border-radius: 14px; background: rgba(247,250,252,0.92); border: 1px solid rgba(4,53,77,0.08); display: flex; justify-content: space-between; alignItems: center; gap: 10px; flexWrap: wrap; }
        @media (max-width: 640px) { .meta-grid { grid-template-columns: 1fr; } .lab-hero { padding: 18px; } .lab-card { padding: 16px; } }
      `}</style>
          <section className='lab-hero'>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className='lab-pill'>Lab requests & diagnostic tests</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Everything your care team requested is here</h1>
              <p style={{ margin: '0 0 16px', maxWidth: '760px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>Your physician has requested the following laboratory and diagnostic tests to support your treatment plan and help you feel informed at every step.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <Link href={referralsHref} className='action-btn primary'>Continue to Referrals</Link>
                <Link href={PATIENT_ROUTES.dashboard} className='action-btn secondary'>Return to Dashboard</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginTop: '16px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Request date</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{date}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Ordering physician</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{physicianName}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Request status</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>In progress</div>
                </div>
              </div>
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Request summary</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>A quick overview</h2>
              </div>
              <div className='lab-chip'>Insurance-ready</div>
            </div>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {[
                ['Requested tests', '3'],
                ['Pending tests', '2'],
                ['Completed tests', '1'],
                ['Estimated cost', 'GHS 320'],
                ['Insurance coverage', '82%'],
              ].map(([label, value]) => (
                <div key={label} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Diagnostic requests</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Ordered by your physician</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {testRequests.map((item) => (
                <article key={item.name} className='request-card'>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.85)', color: T.navy, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.category}</div>
                      <h3 style={{ margin: '10px 0 4px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{item.name}</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{item.description}</p>
                    </div>
                    <div style={{ padding: '8px 10px', borderRadius: '999px', background: item.badgeTone, color: T.blue, fontSize: '11px', fontWeight: 700 }}>{item.status}</div>
                  </div>
                  <div className='meta-grid'>
                    <div className='meta-item'>
                      <span>Reason for test</span>
                      <strong>{item.reason}</strong>
                    </div>
                    <div className='meta-item'>
                      <span>Priority</span>
                      <strong>{item.priority}</strong>
                    </div>
                    <div className='meta-item'>
                      <span>Processing time</span>
                      <strong>{item.processingTime}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', color: T.slate2 }}>Recommended completion date: {item.completionDate}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type='button' className='action-btn secondary'>Book Test</button>
                      <button type='button' className='action-btn'>View Details</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Partner laboratories</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Nearby diagnostic centres</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {partnerLabs.map((lab) => (
                <div key={lab.name} style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy }}>{lab.name}</div>
                      <div style={{ fontSize: '12px', color: T.slate, marginTop: '3px' }}>{lab.address}</div>
                    </div>
                    <div className='lab-chip'>{lab.distance} • ★ {lab.rating}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {lab.tests.map((test) => (
                      <span key={test} style={{ padding: '6px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(4,53,77,0.08)', fontSize: '11px', color: T.navy, fontWeight: 700 }}>{test}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <div style={{ fontSize: '12px', color: T.slate }}>Hours: {lab.hours} • Insurance: {lab.insurance}</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type='button' className='action-btn secondary'>Directions</button>
                      <button type='button' className='action-btn'>Book Appointment</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Booking section</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Choose a convenient visit</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: T.slate2, fontWeight: 700 }}>Select date</span>
                <input type='date' value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className='select-input' />
              </label>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: T.slate2, fontWeight: 700 }}>Select time</span>
                <select value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} className='select-input'>
                  <option value='09:30'>09:30 AM</option>
                  <option value='11:00'>11:00 AM</option>
                  <option value='14:30'>02:30 PM</option>
                  <option value='16:00'>04:00 PM</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: T.slate2, fontWeight: 700 }}>Preferred laboratory</span>
                <select value={selectedLab} onChange={(event) => setSelectedLab(event.target.value)} className='select-input'>
                  {partnerLabs.map((lab) => (
                    <option key={lab.name} value={lab.name}>{lab.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              <button type='button' className={`toggle-pill ${homeCollection ? 'active' : ''}`} onClick={() => setHomeCollection((value) => !value)}>
                <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: homeCollection ? T.blue : T.slate2, display: 'inline-block' }} />
                Home sample collection
              </button>
              <button type='button' className='action-btn secondary'>Save appointment</button>
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Test preparation</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Prepare with confidence</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {preparationItems.map((item) => (
                <div key={item.title} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.14)', color: T.blue }}>
                    <Ico p={ICONS.check} size={16} sw={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.65, marginTop: '3px' }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Insurance coverage</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>What your plan covers</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                ['Covered tests', 'CBC • Lipid panel • Urinalysis'],
                ['Estimated patient cost', 'GHS 58'],
                ['Approval status', 'Approved'],
                ['Remaining balance', 'GHS 262'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                  <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Results tracker</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>The care journey in motion</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                { label: 'Requested', body: 'Order confirmed for three diagnostics' },
                { label: 'Appointment booked', body: 'Appointment slot pending confirmation' },
                { label: 'Sample collected', body: 'To be completed at your selected lab' },
                { label: 'Processing', body: 'Laboratory processing underway' },
                { label: 'Results ready', body: 'Expected once sample is received' },
                { label: 'Shared with physician', body: 'Your physician will receive the result summary' },
              ].map((item) => (
                <div key={item.label} className='timeline-item'>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.6, marginTop: '4px' }}>{item.body}</div>
                </div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Upcoming appointments</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Booked diagnostic visits</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>Lipid Panel</div>
                    <div style={{ fontSize: '12px', color: T.slate, marginTop: '3px' }}>Thu, 15 Aug • 09:30 AM • Northpoint Diagnostics</div>
                  </div>
                  <div className='lab-chip'>Booked</div>
                </div>
              </div>
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Upload external results</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Add results completed elsewhere</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {uploads.map((item) => (
                <div key={item.title} className='upload-card'>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: T.slate2, marginTop: '3px' }}>{item.meta}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type='button' className='action-btn secondary'>Preview</button>
                    <button type='button' className='action-btn'>Upload</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Documents</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Helpful downloads</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                ['Lab Request Form', 'Downloadable for your chosen lab'],
                ['Referral Letter', 'Includes the physician’s notes'],
                ['Preparation Instructions', 'Guidance for each requested test'],
                ['Insurance Letter', 'Useful for coverage confirmation'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{label}</div>
                    <div style={{ fontSize: '11px', color: T.slate2, marginTop: '3px' }}>{value}</div>
                  </div>
                  <button type='button' className='action-btn secondary'>Download</button>
                </div>
              ))}
            </div>
          </section>

          <section className='lab-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient actions</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Stay connected to care</h2>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <Link href={referralsHref} className='action-btn primary'>Continue to Referrals</Link>
              <button type='button' className='action-btn secondary'>Download Requests</button>
              <button type='button' className='action-btn secondary'>Message Physician</button>
              <button type='button' className='action-btn secondary'>Contact Laboratory</button>
            </div>
          </section>
      </PatientPortalShell>
    </>
  )
}

export default function LabRequestsPage() {
  return (
    <Suspense>
      <LabRequestsPageContent />
    </Suspense>
  )
}
