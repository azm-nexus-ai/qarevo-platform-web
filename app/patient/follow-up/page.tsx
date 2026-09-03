'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { 
  getPatientEpisode, 
  getPatientEpisodeTimeline,
  type PatientEpisodeTimelineResponse,
  type EpisodeResponse 
} from '@/lib/api'


type ProgressCardItem = {
  label: string
  value: string
  percent: number
  hint: string
}

type TaskItem = {
  title: string
  done: boolean
}

type ReminderOption = {
  id: string
  label: string
  enabled: boolean
}

type MetricItem = {
  label: string
  value: string
  hint: string
}

type TimelineItem = {
  title: string
  state: 'done' | 'active' | 'pending'
}

type DocumentItem = {
  title: string
  meta: string
}


const progressCards: ProgressCardItem[] = [
  { label: 'Treatment progress', value: '74%', percent: 74, hint: 'Steady recovery trend' },
  { label: 'Medication progress', value: '81%', percent: 81, hint: 'Consistent adherence' },
  { label: 'Lab completion', value: '63%', percent: 63, hint: 'Two tests scheduled' },
  { label: 'Referral completion', value: '58%', percent: 58, hint: 'Specialist handoff in progress' },
  { label: 'Recovery progress', value: '69%', percent: 69, hint: 'Improving comfort' },
]

const initialTasks: TaskItem[] = [
  { title: 'Complete prescribed medications', done: true },
  { title: 'Upload lab results', done: false },
  { title: 'Complete diagnostic tests', done: true },
  { title: 'Visit referred specialist', done: false },
  { title: 'Monitor symptoms', done: true },
  { title: 'Track blood pressure', done: false },
  { title: 'Track blood sugar', done: false },
  { title: 'Daily exercise', done: true },
  { title: 'Healthy diet', done: true },
  { title: 'Hydration', done: true },
]

const reminderOptions: ReminderOption[] = [
  { id: 'medication', label: 'Medication', enabled: true },
  { id: 'appointments', label: 'Appointments', enabled: true },
  { id: 'labTests', label: 'Lab Tests', enabled: true },
  { id: 'hydration', label: 'Hydration', enabled: false },
  { id: 'exercise', label: 'Exercise', enabled: true },
  { id: 'sleep', label: 'Sleep', enabled: true },
]

const metrics: MetricItem[] = [
  { label: 'Symptoms', value: 'Mild fatigue', hint: 'Less frequent than before' },
  { label: 'Pain level', value: '2/10', hint: 'Improving slowly' },
  { label: 'Energy level', value: 'Moderate', hint: 'Better than last week' },
  { label: 'Mood', value: 'Steady', hint: 'More optimistic' },
  { label: 'Weight', value: '67.8 kg', hint: 'Stable' },
  { label: 'Blood pressure', value: '120/78', hint: 'Within target range' },
  { label: 'Blood sugar', value: '5.2 mmol/L', hint: 'Maintained' },
  { label: 'Heart rate', value: '74 bpm', hint: 'Calm rhythm' },
  { label: 'Temperature', value: '36.8°C', hint: 'Normal' },
  { label: 'Sleep quality', value: 'Good', hint: '7.5 hrs average' },
]

const timeline: TimelineItem[] = [
  { title: 'Initial consultation', state: 'done' },
  { title: 'Prescription', state: 'done' },
  { title: 'Lab tests', state: 'done' },
  { title: 'Referrals', state: 'active' },
  { title: 'Follow-up', state: 'pending' },
  { title: 'Recovery', state: 'pending' },
  { title: 'Completed care plan', state: 'pending' },
]

const documents: DocumentItem[] = [
  { title: 'Consultation summary', meta: 'PDF • Ready to review' },
  { title: 'Prescription', meta: 'Shared with pharmacy' },
  { title: 'Lab results', meta: 'Uploaded this week' },
  { title: 'Referral letter', meta: 'Prepared for specialist' },
  { title: 'Medical reports', meta: 'Available to download' },
]

function FollowUpPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const episodeId = searchParams.get('episodeId')
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const physicianName = searchParams.get('physicianName') ?? physician?.name ?? 'Dr. Sophia Reed'
  const specialty = searchParams.get('specialty') ?? physician?.specialty ?? 'Cardiology'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const notes = searchParams.get('notes') ?? ''

  const [tasks, setTasks] = useState(initialTasks)
  const [reminders, setReminders] = useState(reminderOptions)
  const [selectedDate, setSelectedDate] = useState('2026-08-18')
  const [selectedTime, setSelectedTime] = useState('10:30')
  const [consultationType, setConsultationType] = useState('Video')
  const [selectedPhysician, setSelectedPhysician] = useState(physicianName)
  const [episode, setEpisode] = useState<EpisodeResponse | null>(null)
  const [timeline, setTimeline] = useState<PatientEpisodeTimelineResponse | null>(null)
  const [loadingEpisode, setLoadingEpisode] = useState(false)

  useEffect(() => {
    async function loadEpisodeData() {
      if (!episodeId) return
      
      try {
        setLoadingEpisode(true)
        const [episodeData, timelineData] = await Promise.all([
          getPatientEpisode(episodeId),
          getPatientEpisodeTimeline(episodeId),
        ])
        setEpisode(episodeData)
        setTimeline(timelineData)
      } catch (err) {
        console.error('Failed to load episode data:', err)
      } finally {
        setLoadingEpisode(false)
      }
    }

    loadEpisodeData()
  }, [episodeId])

  const feedbackHref = useMemo(() => {
    const params = new URLSearchParams({
      physicianId,
      physicianName,
      specialty,
      date,
      slot,
      insurance,
      notes,
    })
    return `/patient/feedback?${params.toString()}`
  }, [date, insurance, notes, physicianId, physicianName, slot, specialty])

  const toggleTask = (index: number) => {
    setTasks((current) => current.map((task, taskIndex) => taskIndex === index ? { ...task, done: !task.done } : task))
  }

  const toggleReminder = (index: number) => {
    setReminders((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: !item.enabled } : item))
  }

  const completedCount = tasks.filter((task) => task.done).length
  const progressValue = Math.round((completedCount / tasks.length) * 100)


  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .follow-hero, .follow-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; }
        .follow-hero { border-radius: 28px; padding: 24px; position: relative; overflow: hidden; }
        .follow-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.16), transparent 34%), radial-gradient(circle at 85% 10%, rgba(52,140,234,0.12), transparent 28%); pointer-events: none; }
        .follow-card { border-radius: 24px; padding: 20px; margin-top: 14px; }
        .follow-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .follow-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: rgba(165,224,218,0.26); color: ${T.navy}; font-size: 11px; font-weight: 700; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.12); background: rgba(255,255,255,0.92); color: ${T.navy}; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s ease; cursor: pointer; }
        .action-btn:hover, .action-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .action-btn.primary { background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: #fff; border: none; box-shadow: 0 8px 22px rgba(32,181,223,0.24); }
        .action-btn.secondary { background: rgba(247,250,252,0.95); }
        .progress-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px,1fr)); gap: 10px; }
        .progress-card { padding: 14px; border-radius: 16px; background: rgba(247,250,252,0.92); border: 1px solid rgba(4,53,77,0.08); }
        .progress-bar { height: 6px; border-radius: 999px; background: rgba(4,53,77,0.06); overflow: hidden; margin-top: 8px; }
        .progress-bar > div { height: 100%; border-radius: 999px; background: linear-gradient(90deg, ${T.blue} 0%, #348CEA 100%); }
        .task-list { display: grid; gap: 8px; }
        .task-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(247,250,252,0.9); border: 1px solid rgba(4,53,77,0.08); }
        .task-check { width: 22px; height: 22px; min-width: 22px; border-radius: 7px; display: grid; place-items: center; }
        .task-text { font-size: 13px; font-weight: 600; color: ${T.navy}; }
        .date-input, .time-input, .select-input { min-height: 44px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.1); background: rgba(255,255,255,0.95); color: ${T.navy}; padding: 0 12px; font-size: 13px; font-weight: 600; outline: none; }
        .date-input:focus, .time-input:focus, .select-input:focus { border-color: rgba(32,181,223,0.4); }
        .reminder-toggle { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 14px; background: rgba(247,250,252,0.9); border: 1px solid rgba(4,53,77,0.08); cursor: pointer; transition: all 0.2s ease; }
        .reminder-toggle.active { background: rgba(32,181,223,0.08); border-color: rgba(32,181,223,0.2); }
        .doc-row { padding: 12px 14px; border-radius: 14px; background: rgba(247,250,252,0.9); border: 1px solid rgba(4,53,77,0.08); display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .fu-timeline { position: relative; padding-left: 20px; border-left: 2px solid rgba(32,181,223,0.2); padding-bottom: 14px; }
        .fu-timeline-dot { position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 999px; }
        .hero-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-top: 16px; }
        .hero-stat { padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.78); border: 1px solid rgba(255,255,255,0.8); }
        .hero-stat span { display: block; font-size: 10px; color: ${T.slate2}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .hero-stat strong { font-size: 13px; color: ${T.navy}; }
        @media (max-width: 640px) { .hero-stats { grid-template-columns: repeat(2,1fr); } }
      `}</style>
      <PatientPortalShell
        eyebrow="Follow-Up Care"
        title="Follow-Up Appointment"
        description="Schedule your follow-up consultation and keep your recovery on track with your care team."
      >
          <section className='follow-hero'>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className='follow-pill'>Follow-up appointment</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your physician recommends the next step in your recovery</h1>
              <p style={{ margin: '0 0 16px', maxWidth: '760px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>Your physician recommends a follow-up consultation to monitor your recovery and ensure your treatment plan is progressing successfully.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <Link href={feedbackHref} className='action-btn primary'>Confirm follow-up appointment</Link>
                <Link href={PATIENT_ROUTES.dashboard} className='action-btn secondary'>Skip for now</Link>
              </div>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: '16px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Recommendation status</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>Recommended</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Follow-up due date</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{selectedDate}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.84)', border: '1px solid rgba(255,255,255,0.84)' }}>
                  <div style={{ fontSize: '10px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Care progress</div>
                  <div style={{ fontSize: '13px', color: T.navy, fontWeight: 700 }}>{progressValue}% complete</div>
                </div>
              </div>

              {episodeId && (
                <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '14px', background: 'rgba(32,181,223,0.08)', border: '1px solid rgba(32,181,223,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: T.blue, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        Linked Episode
                      </div>
                      <div style={{ fontSize: '12px', color: T.navy, fontWeight: 600 }}>
                        {loadingEpisode ? 'Loading...' : episode ? `Episode ${episode.id.slice(0, 8)}...` : 'Episode not found'}
                      </div>
                    </div>
                    {episode && (
                      <Link
                        href={`/patient/episodes/${episodeId}`}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '10px',
                          border: 'none',
                          background: T.blue,
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        View Details
                        <Ico p={ICONS.arrowFwd} size={14} color="#fff" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Follow-up recommendation</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>A clear care recommendation</h2>
              </div>
              <div className='follow-chip'>Priority: Important</div>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.94)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <div style={{ fontSize: '12px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Physician</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: T.navy, marginTop: '4px' }}>{physicianName}</div>
              </div>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.94)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div style={{ fontSize: '12px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recommended date</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy, marginTop: '4px' }}>{selectedDate}</div>
                </div>
                <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.94)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div style={{ fontSize: '12px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Timeframe</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy, marginTop: '4px' }}>Within 2 weeks</div>
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.94)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <div style={{ fontSize: '12px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reason for follow-up</div>
                <div style={{ fontSize: '14px', color: T.slate, lineHeight: 1.7, marginTop: '6px' }}>{notes || 'To review your treatment response, confirm medication progress, and check that your recovery remains on track.'}</div>
              </div>
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.94)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div style={{ fontSize: '12px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy, marginTop: '4px' }}>30 min</div>
                </div>
                <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.94)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div style={{ fontSize: '12px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Consultation type</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy, marginTop: '4px' }}>{consultationType}</div>
                </div>
                <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.94)', border: '1px solid rgba(4,53,77,0.08)' }}>
                  <div style={{ fontSize: '12px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Priority</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: T.navy, marginTop: '4px' }}>Important</div>
                </div>
              </div>
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Care progress</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Beautiful progress at a glance</h2>
              </div>
              <div className='follow-chip'>Overall progress {progressValue}%</div>
            </div>
            <div className='progress-grid'>
              {progressCards.map((card) => (
                <div key={card.label} className='progress-card'>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <div className='progress-bar'><div style={{ width: `${card.percent}%` }} /></div>
                  <small>{card.hint}</small>
                </div>
              ))}
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Outstanding tasks</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Keep the essentials moving</h2>
              </div>
              <div className='follow-chip'>{completedCount}/{tasks.length} completed</div>
            </div>
            <div className='task-list'>
              {tasks.map((task, index) => (
                <button key={task.title} type='button' onClick={() => toggleTask(index)} className={`task-item ${task.done ? 'done' : ''}`} style={{ textAlign: 'left' }}>
                  <span className='task-text'>{task.title}</span>
                  <span style={{ color: task.done ? T.green : T.slate2, fontSize: '12px', fontWeight: 700 }}>{task.done ? 'Completed' : 'Pending'}</span>
                </button>
              ))}
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Follow-up booking</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Choose a convenient follow-up slot</h2>
              </div>
              <div className='follow-chip'>Flexible booking</div>
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Select date</label>
                  <input type='date' value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className='field' />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Select time</label>
                  <input type='time' value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} className='field' />
                </div>
              </div>
              <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Consultation type</label>
                  <select value={consultationType} onChange={(event) => setConsultationType(event.target.value)} className='field'>
                    <option value='Video'>Video</option>
                    <option value='In-Person'>In-Person</option>
                    <option value='Hybrid'>Hybrid</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Preferred physician</label>
                  <select value={selectedPhysician} onChange={(event) => setSelectedPhysician(event.target.value)} className='field'>
                    <option value={physicianName}>{physicianName}</option>
                    <option value='Dr. Naomi Mensah'>Dr. Naomi Mensah</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Timezone</label>
                <select className='field' defaultValue='GMT+0'>
                  <option value='GMT+0'>GMT+0 (Accra)</option>
                  <option value='GMT-5'>GMT-5</option>
                  <option value='GMT+1'>GMT+1</option>
                </select>
              </div>
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Health tracker</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Self-monitoring that keeps you informed</h2>
              </div>
              <div className='follow-chip'>Daily snapshot</div>
            </div>
            <div className='metric-grid'>
              {metrics.map((metric) => (
                <div key={metric.label} className='metric-card'>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.hint}</small>
                </div>
              ))}
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Progress timeline</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Your care journey so far</h2>
              </div>
              <div className='follow-chip'>Connected care path</div>
            </div>
            <div className='timeline'>
              {timeline?.map((item) => (
                <div key={item.title} className={`timeline-item ${item.state}`}>
                  <div className='dot' />
                  <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{item.title}</div>
                </div>
              ))}
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Care reminders</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Manage the reminders that matter</h2>
              </div>
              <div className='follow-chip'>Flexible notifications</div>
            </div>
            <div className='reminder-wrap'>
              {reminders.map((reminder, index) => (
                <button key={reminder.id} type='button' onClick={() => toggleReminder(index)} className={`reminder-pill ${reminder.enabled ? 'active' : ''}`}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '999px', background: reminder.enabled ? T.blue : T.slate2 }} />
                  {reminder.label}
                </button>
              ))}
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Physician message</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>A clear note from your care team</h2>
              </div>
              <div className='follow-chip'>Message ready</div>
            </div>
            <div style={{ padding: '14px', borderRadius: '16px', background: 'rgba(247,250,252,0.94)', border: '1px solid rgba(4,53,77,0.08)' }}>
              <div style={{ fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>“Please complete your laboratory tests before your next appointment.”</div>
              <div className='action-row'>
                <button type='button' className='action-btn secondary'>Reply</button>
                <button type='button' className='action-btn secondary'>Message care team</button>
              </div>
            </div>
          </section>

          <section className='follow-card'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Documents</p>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Everything you need for a prepared visit</h2>
              </div>
              <div className='follow-chip'>Download or preview</div>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {documents.map((document) => (
                <div key={document.title} className='doc-card'>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: T.navy }}>{document.title}</div>
                      <div style={{ fontSize: '12px', color: T.slate, marginTop: '4px' }}>{document.meta}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type='button' className='action-btn secondary'>Preview</button>
                      <button type='button' className='action-btn secondary'>Download</button>
                      <button type='button' className='action-btn secondary'>Share</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
      </PatientPortalShell>
    </>
  )
}

export default function FollowUpPage() {
  return (
    <Suspense>
      <FollowUpPageContent />
    </Suspense>
  )
}
