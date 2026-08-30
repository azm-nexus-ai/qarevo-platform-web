'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'


type MedicationItem = {
  name: string
  brand: string
  strength: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
  food: string
  times: string[]
  refill: string
  accent: string
}

type CarePlanItem = {
  title: string
  body: string
  icon: string | readonly string[]
}

type RecommendationItem = {
  title: string
  body: string
  icon: string | readonly string[]
}

type WarningItem = {
  title: string
  body: string
}

type ReminderOption = {
  id: 'push' | 'sms' | 'email' | 'calendar'
  label: string
  description: string
}

type DocumentItem = {
  title: string
  meta: string
}


const medications: MedicationItem[] = [
  {
    name: 'Lisinopril',
    brand: 'Generic',
    strength: '10 mg',
    dosage: '1 tablet',
    frequency: 'Once daily',
    duration: '30 days',
    instructions: 'Take every morning with water. Continue unless instructed otherwise.',
    food: 'Take with or without food',
    times: ['Morning'],
    refill: 'Refill ready',
    accent: 'rgba(32,181,223,0.14)',
  },
  {
    name: 'Vitamin D3',
    brand: 'NatureMade',
    strength: '1000 IU',
    dosage: '1 capsule',
    frequency: 'Once daily',
    duration: '14 days',
    instructions: 'Best taken after breakfast to support daily routine consistency.',
    food: 'Take with food',
    times: ['Morning'],
    refill: 'Refill pending',
    accent: 'rgba(165,224,218,0.24)',
  },
  {
    name: 'Magnesium Glycinate',
    brand: 'Therapeutic',
    strength: '400 mg',
    dosage: '1 tablet',
    frequency: 'At night',
    duration: '14 days',
    instructions: 'Use in the evening to support recovery and relaxation.',
    food: 'Take with dinner',
    times: ['Evening', 'Night'],
    refill: 'Refill ready',
    accent: 'rgba(52,140,234,0.12)',
  },
]

const carePlanItems: CarePlanItem[] = [
  { title: 'Rest', body: 'Prioritize light movement and reduce pressure on your daily schedule for the next 48 hours.', icon: ICONS.heart },
  { title: 'Increase hydration', body: 'Aim for regular water intake throughout the day and keep fluids close by.', icon: ICONS.activity },
  { title: 'Maintain a balanced diet', body: 'Choose nourishing meals, regular timing, and reduce excess caffeine.', icon: ICONS.shield },
  { title: 'Reduce stress', body: 'Use breathing, journaling, or gentle stretching as simple recovery tools.', icon: ICONS.brain },
]

const recommendations: RecommendationItem[] = [
  { title: 'Nutrition', body: 'Keep meals steady and include protein, fruits, and vegetables', icon: ICONS.activity },
  { title: 'Physical activity', body: 'Gentle walking is encouraged once you feel comfortable', icon: ICONS.zap },
  { title: 'Mental wellbeing', body: 'Support recovery with calm routines and adequate rest', icon: ICONS.heart },
  { title: 'Sleep', body: 'Aim for consistent sleep and a low-stimulus evening routine', icon: ICONS.shield },
  { title: 'Hydration', body: 'Keep a water bottle nearby and sip regularly', icon: ICONS.check },
  { title: 'Smoking & alcohol', body: 'Avoid smoking and limit alcohol while following your plan', icon: ICONS.info },
]

const warningItems: WarningItem[] = [
  { title: 'Seek emergency care', body: 'If you experience chest pain, severe shortness of breath, or sudden weakness, seek urgent medical attention immediately.' },
  { title: 'Contact your physician', body: 'If symptoms persist beyond 48 hours or the plan causes dizziness, contact your care team promptly.' },
  { title: 'Return immediately', body: 'If you feel unusually faint, have a rash, or notice swelling, reach out without delay.' },
]

const reminderOptions: ReminderOption[] = [
  { id: 'push', label: 'Push notifications', description: 'Daily reminders on your device' },
  { id: 'sms', label: 'SMS', description: 'Short reminders by text' },
  { id: 'email', label: 'Email', description: 'Medication recap and schedule' },
  { id: 'calendar', label: 'Calendar', description: 'Auto-add to your wellness calendar' },
]

const documents: DocumentItem[] = [
  { title: 'Prescription PDF', meta: 'Downloadable and ready to share' },
  { title: 'Consultation Notes', meta: 'Reviewed by your physician' },
  { title: 'Treatment Plan', meta: 'Structured overview for follow-up care' },
  { title: 'Medical Report', meta: 'Prepared for your records' },
]

const pharmacyOptions = [
  { title: 'Nearest Pharmacy', body: 'Northpoint Pharmacy • 3 min away', tag: 'Open now' },
  { title: 'Partner Pharmacy', body: 'Qarevo Care Pharmacy • Same-day pickup', tag: 'Preferred' },
  { title: 'Home Delivery', body: 'Fast delivery available within 24 hours', tag: 'Convenient' },
]

function medicationElementId(name: string) {
  return `medication-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function PrescriptionCarePlanPageContent() {
  const searchParams = useSearchParams()
  const highlightedMedication = searchParams.get('medication') ?? ''
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const physicianName = searchParams.get('physicianName') ?? physician?.name ?? 'Dr. Sophia Reed'
  const specialty = searchParams.get('specialty') ?? physician?.specialty ?? 'Cardiology'
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const notes = searchParams.get('notes') ?? ''

  const [reminders, setReminders] = useState<Record<ReminderOption['id'], boolean>>({
    push: true,
    sms: true,
    email: false,
    calendar: true,
  })

  const labHref = useMemo(() => {
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
    return `/patient/lab-requests?${params.toString()}`
  }, [date, duration, insurance, notes, physicianId, physicianName, slot, specialty])

  useEffect(() => {
    if (!highlightedMedication) return

    const timer = window.setTimeout(() => {
      document.getElementById(medicationElementId(highlightedMedication))?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [highlightedMedication])

  const rightRail = (
    <div className='plan-summary-card'>
      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Care summary</p>
      <h2 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800, color: T.navy }}>Treatment overview</h2>
      <div style={{ display: 'grid', gap: '8px' }}>
        {[
          ['Treatment duration', '14 days'],
          ['Active medications', '3'],
          ['Follow-up date', 'Thu, 14 Aug'],
          ['Next appointment', 'Video review'],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.06)' }}>
            <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '8px', padding: '12px 14px', borderRadius: '14px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '12px', fontWeight: 700, lineHeight: 1.65 }}>
        Outstanding tasks: complete your reminders, review the follow-up plan, and prepare for your next appointment.
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .plan-hero, .plan-card, .plan-summary-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; }
        .plan-hero { border-radius: 28px; padding: 24px; position: relative; overflow: hidden; }
        .plan-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.16), transparent 34%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.12), transparent 28%); pointer-events: none; }
        .plan-card { border-radius: 24px; padding: 20px; margin-top: 14px; }
        .plan-summary-card { border-radius: 24px; padding: 18px; display: grid; gap: 10px; }
        .plan-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .plan-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(165,224,218,0.26); color: ${T.navy}; font-size: 11px; font-weight: 700; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.12); background: rgba(255,255,255,0.92); color: ${T.navy}; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s ease; }
        .action-btn:hover, .action-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .action-btn.primary { background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: #fff; border: none; box-shadow: 0 8px 22px rgba(32,181,223,0.24); }
        .action-btn.secondary { background: rgba(247,250,252,0.95); }
        .med-card { position: relative; overflow: hidden; border-radius: 20px; padding: 16px; border: 1px solid rgba(4,53,77,0.08); background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(247,250,252,0.94) 100%); transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .med-card:hover { transform: translateY(-2px); box-shadow: ${Sh.glow}; }
        .med-card::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top right, rgba(32,181,223,0.09), transparent 28%); pointer-events: none; }
        .med-meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
        .med-meta-item { padding: 10px 12px; border-radius: 12px; background: rgba(247,250,252,0.9); border: 1px solid rgba(4,53,77,0.06); }
        .med-meta-item span { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: ${T.slate2}; margin-bottom: 3px; }
        .med-meta-item strong { font-size: 12px; color: ${T.navy}; }
        .time-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.92); border: 1px solid rgba(4,53,77,0.08); color: ${T.navy}; font-size: 11px; font-weight: 700; }
        .toggle-btn { display: inline-flex; alignItems: center; gap: 8px; min-height: 42px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(4,53,77,0.08); background: rgba(255,255,255,0.9); color: ${T.navy}; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
        .toggle-btn.active { background: rgba(32,181,223,0.12); color: ${T.blue}; border-color: rgba(32,181,223,0.26); }
        .toggle-btn:hover, .toggle-btn:focus-visible { outline: none; transform: translateY(-1px); box-shadow: ${Sh.glow}; }
        .reminder-card, .doc-card { padding: 12px 14px; border-radius: 14px; background: rgba(247,250,252,0.92); border: 1px solid rgba(4,53,77,0.08); }
        .warning-card { padding: 12px 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,247,241,0.94) 100%); border: 1px solid rgba(220,38,38,0.12); }
        .hero-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
        .hero-stat { padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.78); border: 1px solid rgba(255,255,255,0.8); }
        .hero-stat span { display: block; font-size: 10px; color: ${T.slate2}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .hero-stat strong { font-size: 13px; color: ${T.navy}; }
        @media (max-width: 640px) { .hero-stats, .med-meta-grid { grid-template-columns: 1fr; } .plan-hero { padding: 18px; } .plan-card { padding: 16px; } }
      `}</style>
      <PatientPortalShell
        eyebrow="Prescriptions"
        title="Prescription & Care Plan"
        description="Your physician has prepared a structured care plan based on today's consultation so you can follow it with confidence."
        rightRail={rightRail}
      >
          <section className='plan-hero'>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className='plan-pill'>Prescription & care plan</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A clear treatment path for today and tomorrow</h1>
              <p style={{ margin: '0 0 16px', maxWidth: '760px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>Your physician has prepared a calm, structured care plan based on today’s consultation so you can follow it with confidence.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <Link href={labHref} className='action-btn primary'>Continue to Lab Requests</Link>
                <Link href={PATIENT_ROUTES.dashboard} className='action-btn secondary'>Return to Dashboard</Link>
              </div>
              <div className='hero-stats'>
                <div className='hero-stat'>
                  <span>Consultation date</span>
                  <strong>{date}</strong>
                </div>
                <div className='hero-stat'>
                  <span>Physician</span>
                  <strong>{physicianName}</strong>
                </div>
                <div className='hero-stat'>
                  <span>Status</span>
                  <strong>Active plan</strong>
                </div>
              </div>
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Physician summary</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Care partner overview</h2>
              </div>
              <div className='plan-chip'>Verified • {specialty}</div>
            </div>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '92px', height: '92px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.12)', background: 'linear-gradient(135deg, rgba(32,181,223,0.2), rgba(52,140,234,0.24))', display: 'grid', placeItems: 'center' }}>
                {physician ? (
                  <Image src={physician.imageUrl} alt={physicianName} width={92} height={92} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Ico p={ICONS.steth} size={28} sw={1.5} color={T.navy} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{physicianName}</h3>
                <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{specialty} • {physician?.hospital ?? 'Qarevo Care Network'}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: T.slate2 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{physician?.experienceYears ?? 12} years experience</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.check} size={12} sw={1.75} color={T.blue} />Verified physician</span>
                </div>
              </div>
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Prescription list</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Medications to follow</h2>
              </div>
              <div className='plan-chip'>Premium care instructions</div>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {medications.map((item) => {
                const highlighted = item.name.toLowerCase() === highlightedMedication.toLowerCase()
                return (
                <article key={item.name} id={medicationElementId(item.name)} className='med-card' style={{ background: `linear-gradient(135deg, ${item.accent} 0%, rgba(255,255,255,0.96) 100%)`, borderColor: highlighted ? 'rgba(32,181,223,0.72)' : 'rgba(4,53,77,0.08)', boxShadow: highlighted ? '0 0 0 4px rgba(32,181,223,0.14), 0 16px 34px rgba(4,53,77,0.12)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(255,255,255,0.85)', color: T.navy, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{item.brand}</div>
                      <h3 style={{ margin: '10px 0 4px', fontSize: '18px', fontWeight: 800, color: T.navy }}>{item.name}</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{item.instructions}</p>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '11px', fontWeight: 700 }}>{item.refill}</div>
                  </div>
                  <div className='med-meta-grid'>
                    <div className='med-meta-item'>
                      <span>Strength</span>
                      <strong>{item.strength}</strong>
                    </div>
                    <div className='med-meta-item'>
                      <span>Dosage</span>
                      <strong>{item.dosage}</strong>
                    </div>
                    <div className='med-meta-item'>
                      <span>Frequency</span>
                      <strong>{item.frequency}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {item.times.map((time) => (
                        <span key={time} className='time-pill'><Ico p={ICONS.check} size={10} sw={2.2} color={T.blue} />{time}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type='button' className='action-btn secondary'>Download Prescription</button>
                      <button type='button' className='action-btn'>View Details</button>
                    </div>
                  </div>
                </article>
                )
              })}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Medication schedule</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Daily timing plan</h2>
              </div>
              <div className='plan-chip'>Reminder ready</div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                ['Morning', 'Lisinopril • Vitamin D3', '08:00'],
                ['Afternoon', 'Hydration + light meal', '13:00'],
                ['Evening', 'Magnesium Glycinate', '20:00'],
                ['Night', 'Gentle wind-down routine', '22:30'],
              ].map(([label, value, time]) => (
                <div key={label} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy }}>{label}</div>
                    <div style={{ fontSize: '12px', color: T.slate, marginTop: '3px' }}>{value}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '12px', color: T.blue, fontWeight: 700 }}>{time}</div>
                    <button type='button' className='action-btn secondary'>Set Reminder</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Care plan</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Recommended support actions</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {carePlanItems.map((item) => (
                <div key={item.title} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.14)', color: T.blue }}>
                    <Ico p={item.icon} size={16} sw={1.8} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.65, marginTop: '3px' }}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Lifestyle recommendations</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Everyday habits that support healing</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {recommendations.map((item) => (
                <div key={item.title} className='reminder-card'>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.12)', color: T.blue }}>
                      <Ico p={item.icon} size={13} sw={1.8} />
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy }}>{item.title}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.65 }}>{item.body}</div>
                </div>
              ))}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Warning signs</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Please act quickly if these occur</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {warningItems.map((item) => (
                <div key={item.title} className='warning-card'>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, marginBottom: '4px' }}>{item.title}</div>
                  <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.65 }}>{item.body}</div>
                </div>
              ))}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Medication reminders</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Stay supported between visits</h2>
              </div>
              <div className='plan-chip'>Enable reminders</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {reminderOptions.map((option) => {
                const active = reminders[option.id]
                return (
                  <button key={option.id} type='button' onClick={() => setReminders((current) => ({ ...current, [option.id]: !current[option.id] }))} className={`toggle-btn ${active ? 'active' : ''}`}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '999px', background: active ? T.blue : T.slate2, display: 'inline-block' }} />
                    {option.label}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
              {reminderOptions.map((option) => (
                <div key={option.id} className='reminder-card' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{option.label}</div>
                    <div style={{ fontSize: '12px', color: T.slate, marginTop: '3px' }}>{option.description}</div>
                  </div>
                  <div className='plan-chip'>{reminders[option.id] ? 'Enabled' : 'Off'}</div>
                </div>
              ))}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pharmacy options</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Collect your medication with ease</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {pharmacyOptions.map((item) => (
                <div key={item.title} className='reminder-card'>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</div>
                    <div className='plan-chip'>{item.tag}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.65 }}>{item.body}</div>
                </div>
              ))}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Follow-up plan</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>What happens next</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {[
                ['Next review date', 'Thursday, 14 Aug • 10:30 AM'],
                ['Follow-up consultation', 'Video review in 7 days'],
                ['Lab tests', 'Routine blood panel recommended'],
                ['Referral', 'Specialist review only if symptoms continue'],
                ['Progress monitoring', 'Track hydration, sleep, and blood pressure'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.06)' }}>
                  <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                  <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Documents</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Helpful downloads</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {documents.map((document) => (
                <div key={document.title} className='doc-card' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{document.title}</div>
                    <div style={{ fontSize: '11px', color: T.slate2, marginTop: '2px' }}>{document.meta}</div>
                  </div>
                  <button type='button' className='action-btn secondary'>Download</button>
                </div>
              ))}
            </div>
          </section>

          <section className='plan-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient actions</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Take the next step</h2>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <Link href={labHref} className='action-btn primary'>Continue to Lab Requests</Link>
              <button type='button' className='action-btn secondary'>Download Prescription</button>
              <button type='button' className='action-btn secondary'>Share Prescription</button>
              <Link href='/support' className='action-btn secondary'>Contact Physician</Link>
            </div>
          </section>
      </PatientPortalShell>
    </>
  )
}

export default function PrescriptionCarePlanPage() {
  return (
    <Suspense>
      <PrescriptionCarePlanPageContent />
    </Suspense>
  )
}
