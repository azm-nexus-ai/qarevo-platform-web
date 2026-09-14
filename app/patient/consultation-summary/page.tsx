'use client'

import Link from 'next/link'
import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { T, Sh } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'


type DiagnosisItem = {
  name: string
  description: string
  severity: string
  status: string
}

type RecommendationItem = {
  title: string
  body: string
}

type StepItem = {
  title: string
  body: string
  status: string
}

type DocumentItem = {
  title: string
  meta: string
}


function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours > 0 ? `${hours}h ` : ''}${minutes}m`
}

function formatDateLabel(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'today' || normalized === 'tomorrow') {
    return value
  }
  return value
}

function ConsultationSummaryPageContent() {
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const date = searchParams.get('date') ?? 'Today'
  const elapsedSeconds = Number(searchParams.get('elapsed') ?? 1800)
  const physicianName = searchParams.get('physicianName') ?? physician?.name ?? 'Dr. Sophia Reed'
  const specialty = searchParams.get('specialty') ?? physician?.specialty ?? 'Internal Medicine'
  const appointmentId = searchParams.get('appointmentId') ?? 'QRV-CLN-10428'
  const bookingReference = searchParams.get('bookingReference') ?? 'REF-20260805-428'
  const doctorNotes = searchParams.get('doctorNotes') ?? ''

  const completionTime = useMemo(() => {
    const now = new Date()
    return now.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }, [])

  const diagnoses: DiagnosisItem[] = [
    { name: 'Stress-related fatigue', description: 'Symptoms were discussed in the context of recent workload and sleep disruption.', severity: 'Moderate', status: 'Primary Diagnosis' },
    { name: 'Hydration imbalance', description: 'Mild signs of low fluid intake were noted during the consultation.', severity: 'Mild', status: 'Secondary Diagnosis' },
  ]

  const recommendations: RecommendationItem[] = [
    { title: 'Rest and recovery', body: 'Priority should be given to rest, hydration, and a lighter schedule for the next 48 hours.' },
    { title: 'Lifestyle adjustments', body: 'Reducing caffeine and maintaining steady meals will support recovery.' },
    { title: 'Medication adherence', body: 'Continue prescribed medication as directed and notify the care team if symptoms worsen.' },
  ]

  const nextSteps: StepItem[] = [
    { title: 'Collect prescription', body: 'Your medication plan is ready for review and pickup.', status: 'Ready' },
    { title: 'Complete lab tests', body: 'A follow-up blood panel may help confirm the current assessment.', status: 'Recommended' },
    { title: 'Schedule follow-up', body: 'A short follow-up visit is advisable if symptoms persist.', status: 'Suggested' },
    { title: 'Monitor symptoms', body: 'Seek urgent care if dizziness or chest pain develops.', status: 'Important' },
  ]

  const documents: DocumentItem[] = [
    { title: 'Consultation Summary PDF', meta: 'Prepared today' },
    { title: 'Medical Report', meta: 'Shared with your care team' },
    { title: 'Visit Notes', meta: 'Available in medical records' },
  ]

  const soapSections = {
    subjective: doctorNotes || 'Patient reported fatigue, lightheadedness, and reduced energy over the last week. Mild symptoms appeared more often in the evening.',
    objective: 'No acute distress during the visit. Blood pressure and oxygen measures were stable, and vitals were reassuring.',
    assessment: 'Clinical assessment suggests a manageable pattern of fatigue with stress and hydration factors contributing to symptoms.',
    plan: 'Continue current care plan, maintain hydration, monitor symptoms closely, and review again if symptoms persist beyond 48 hours.',
  }


  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .summary-hero, .summary-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; }
        .summary-hero { border-radius: 28px; padding: 24px; position: relative; overflow: hidden; }
        .summary-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.16), transparent 34%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.12), transparent 28%); pointer-events: none; }
        .summary-card { border-radius: 24px; padding: 20px; }
        .summary-grid { display: grid; gap: 14px; margin-top: 14px; }
        .summary-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .summary-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(165,224,218,0.26); color: ${T.navy}; font-size: 11px; font-weight: 700; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.12); background: rgba(255,255,255,0.92); color: ${T.navy}; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s ease; }
        .action-btn:hover, .action-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .action-btn.primary { background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: #fff; border: none; box-shadow: 0 8px 22px rgba(32,181,223,0.24); }
        .action-btn.secondary { background: rgba(247,250,252,0.95); }
        .diagnosis-card { padding: 14px; border-radius: 16px; border: 1px solid rgba(4,53,77,0.08); background: rgba(247,250,252,0.94); }
        .step-card { padding: 14px; border-radius: 16px; background: rgba(247,250,252,0.92); border: 1px solid rgba(4,53,77,0.08); }
        .doc-card { padding: 12px 14px; border-radius: 14px; background: rgba(247,250,252,0.92); border: 1px solid rgba(4,53,77,0.08); display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      `}</style>
      <PatientPortalShell
        eyebrow="Consultation"
        title="Consultation Summary"
        description="A clear record of your visit — diagnoses, recommendations, and next steps curated for you."
      >
          <section className='summary-hero' style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div className='summary-pill' style={{ marginBottom: '10px' }}>
                  <Ico p={ICONS.check} size={10} sw={2.2} color={T.blue} />
                  Consultation completed successfully
                </div>
                <h1 style={{ margin: '0 0 10px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your consultation summary is ready</h1>
                <p style={{ margin: '0 0 16px', maxWidth: '760px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>
                  Your consultation has ended. Below is a structured summary prepared by your physician, including key findings, recommendations, and the next steps for your care.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <Link href='/patient/prescription-care-plan' className='action-btn primary'>View Prescription</Link>
                  <Link href='/patient/appointment-details' className='action-btn'>Book Follow-Up</Link>
                </div>
              </div>
              <div style={{ minWidth: '260px', width: '300px', borderRadius: '24px', padding: '16px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: Sh.glow }}>
                <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Session details</p>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    ['Completed', completionTime],
                    ['Duration', formatDuration(elapsedSeconds)],
                    ['Date', formatDateLabel(date)],
                    ['Physician', physicianName],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.9)', border: '1px solid rgba(4,53,77,0.06)' }}>
                      <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: T.navy }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className='summary-grid'>
            <section className='summary-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consultation overview</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>At a glance</h2>
                </div>
                <div className='summary-chip'>Video consultation • {formatDuration(elapsedSeconds)}</div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  ['Consultation Type', 'Video Consultation'],
                  ['Physician', physicianName],
                  ['Specialty', specialty],
                  ['Duration', formatDuration(elapsedSeconds)],
                  ['Appointment ID', appointmentId],
                  ['Booking Reference', bookingReference],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='summary-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Physician summary</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Care partner overview</h2>
                </div>
                <div className='summary-chip'>Verified</div>
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ width: '92px', height: '92px', borderRadius: '20px', overflow: 'hidden', border: '1px solid rgba(4,53,77,0.12)', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.26))', display: 'grid', placeItems: 'center' }}>
                  {physician ? (
                    <img src={physician.imageUrl} alt={physicianName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={28} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <h3 style={{ margin: '0 0 4px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy }}>{physicianName}</h3>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{specialty} · {physician?.hospital ?? 'Qarevo Care Network'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: T.slate2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.activity} size={12} sw={1.75} color={T.blue} />{physician?.experienceYears ?? 12} years experience</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ico p={ICONS.lock} size={12} sw={1.75} color={T.blue} />{physician?.languages.join(', ') ?? 'English, French'}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className='summary-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consultation notes</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Structured SOAP summary</h2>
                </div>
                <div className='summary-chip'>Auto-saved</div>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  ['Subjective', soapSections.subjective],
                  ['Objective', soapSections.objective],
                  ['Assessment', soapSections.assessment],
                  ['Plan', soapSections.plan],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: T.slate2, marginBottom: '6px' }}>{label}</div>
                    <div style={{ fontSize: '13px', color: T.navy, lineHeight: 1.75 }}>{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className='summary-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Diagnosis</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Clinical findings</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {diagnoses.map((item) => (
                  <div key={item.name} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.name}</div>
                      <div className='summary-chip' style={{ background: 'rgba(32,181,223,0.12)', color: T.blue }}>{item.severity}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.65, marginBottom: '6px' }}>{item.description}</div>
                    <div style={{ fontSize: '11px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.status}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className='summary-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Key discussion points</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>What was covered</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  'Symptoms discussed: fatigue, dizziness, and reduced stamina',
                  'Clinical observations: vitals remained stable and symptoms appeared manageable',
                  'Lifestyle recommendations: hydration, nutrition, and rest were emphasized',
                  'Treatment decisions: medication plan and ongoing monitoring were reviewed',
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '10px', display: 'grid', placeItems: 'center', background: 'rgba(32,181,223,0.12)', color: T.green }}>
                      <Ico p={ICONS.check} size={12} sw={2.4} color={T.green} />
                    </div>
                    <span style={{ fontSize: '13px', color: T.navy, lineHeight: 1.65 }}>{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className='summary-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Recommendations</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>What to do next</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {recommendations.map((item) => (
                  <div key={item.title} style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(247,250,252,0.92)', border: '1px solid rgba(4,53,77,0.08)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy, marginBottom: '4px' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.65 }}>{item.body}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className='summary-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Next steps</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A clear follow-up path</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {nextSteps.map((step) => (
                  <div key={step.title} className='timeline-item'>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{step.title}</div>
                    <div style={{ fontSize: '12px', color: T.slate, lineHeight: 1.6, marginTop: '4px' }}>{step.body}</div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: T.blue, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{step.status}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className='summary-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Documents</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Downloadable visit files</h2>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {documents.map((document) => (
                  <div key={document.title} className='doc-card'>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{document.title}</div>
                      <div style={{ fontSize: '11px', color: T.slate2, marginTop: '2px' }}>{document.meta}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type='button' className='action-btn'>Preview</button>
                      <button type='button' className='action-btn'>Download</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </PatientPortalShell>
      </>
    )
}

export default function ConsultationSummaryPage() {
  return (
    <Suspense>
      <ConsultationSummaryPageContent />
    </Suspense>
  )
}
