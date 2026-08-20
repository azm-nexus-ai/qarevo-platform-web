'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'
import Ico from '@/components/ui/Ico'
import PatientPortalShell from '@/components/patient/PatientPortalShell'


type CriterionItem = {
  key: string
  label: string
}

type ExperienceItem = {
  key: string
  label: string
}

type OutcomeOption = {
  value: string
  label: string
}

type QuickTagItem = {
  value: string
  label: string
}

type TechnicalIssueItem = {
  value: string
  label: string
}


const physicianCriteria: CriterionItem[] = [
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'communication', label: 'Communication' },
  { key: 'friendliness', label: 'Friendliness' },
  { key: 'medicalKnowledge', label: 'Medical Knowledge' },
  { key: 'listeningSkills', label: 'Listening Skills' },
  { key: 'explanationQuality', label: 'Explanation Quality' },
  { key: 'respectfulness', label: 'Respectfulness' },
]

const experienceItems: ExperienceItem[] = [
  { key: 'appointmentScheduling', label: 'Appointment Scheduling' },
  { key: 'waitingTime', label: 'Waiting Time' },
  { key: 'videoQuality', label: 'Video Quality' },
  { key: 'audioQuality', label: 'Audio Quality' },
  { key: 'easeOfUse', label: 'Ease of Use' },
  { key: 'platformDesign', label: 'Platform Design' },
  { key: 'overallExperience', label: 'Overall Experience' },
]

const outcomeOptions: OutcomeOption[] = [
  { value: 'Completely', label: 'Completely' },
  { value: 'Mostly', label: 'Mostly' },
  { value: 'Partially', label: 'Partially' },
  { value: 'Not Yet', label: 'Not Yet' },
  { value: 'Need Another Consultation', label: 'Need Another Consultation' },
]

const quickTags: QuickTagItem[] = [
  { value: 'Professional', label: 'Professional' },
  { value: 'Friendly', label: 'Friendly' },
  { value: 'Helpful', label: 'Helpful' },
  { value: 'Knowledgeable', label: 'Knowledgeable' },
  { value: 'Easy to Use', label: 'Easy to Use' },
  { value: 'Excellent Care', label: 'Excellent Care' },
  { value: 'Long Wait Time', label: 'Long Wait Time' },
  { value: 'Technical Issues', label: 'Technical Issues' },
  { value: 'Outstanding Experience', label: 'Outstanding Experience' },
  { value: 'Needs Improvement', label: 'Needs Improvement' },
]

const technicalIssues: TechnicalIssueItem[] = [
  { value: 'Camera', label: 'Camera' },
  { value: 'Microphone', label: 'Microphone' },
  { value: 'Internet', label: 'Internet' },
  { value: 'Video Quality', label: 'Video Quality' },
  { value: 'Audio Quality', label: 'Audio Quality' },
  { value: 'Login', label: 'Login' },
  { value: 'Performance', label: 'Performance' },
  { value: 'Other', label: 'Other' },
]

function getRatingLabel(value: number) {
  if (value >= 4.5) return 'Excellent'
  if (value >= 3.5) return 'Very Good'
  if (value >= 2.5) return 'Good'
  if (value >= 1.5) return 'Fair'
  return 'Poor'
}

function StarControl({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (next: number) => void
  label: string
}) {
  return (
    <div className='star-control' role='radiogroup' aria-label={label}>
      {Array.from({ length: 10 }).map((_, index) => {
        const stepValue = (index + 1) / 2
        let fill = 0
        if (value >= stepValue) fill = 100
        else if (value > stepValue - 0.5) fill = 50

        return (
          <button
            key={`${label}-${index}`}
            type='button'
            className='star-button'
            onClick={() => onChange(stepValue)}
            aria-label={`${label} ${stepValue} star`}
          >
            <span className='star-fill' style={{ width: `${fill}%` }}>★</span>
          </button>
        )
      })}
    </div>
  )
}

function FeedbackPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const physicianId = searchParams.get('physicianId') ?? 'sophia-reed'
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const date = searchParams.get('date') ?? 'Today'
  const slot = searchParams.get('slot') ?? '4:30 PM'
  const duration = searchParams.get('duration') ?? '30 min'
  const physicianName = searchParams.get('physicianName') ?? physician?.name ?? 'Dr. Sophia Reed'
  const specialty = searchParams.get('specialty') ?? physician?.specialty ?? 'Cardiology'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const notes = searchParams.get('notes') ?? ''

  const [overallRating, setOverallRating] = useState(4.5)
  const [physicianRatings, setPhysicianRatings] = useState<Record<string, number>>({
    professionalism: 4.5,
    communication: 4.5,
    friendliness: 4.5,
    medicalKnowledge: 5,
    listeningSkills: 4.5,
    explanationQuality: 4.5,
    respectfulness: 5,
  })
  const [experienceRatings, setExperienceRatings] = useState<Record<string, number>>({
    appointmentScheduling: 4,
    waitingTime: 3.5,
    videoQuality: 4,
    audioQuality: 4,
    easeOfUse: 4.5,
    platformDesign: 4.5,
    overallExperience: 4.5,
  })
  const [selectedOutcome, setSelectedOutcome] = useState('Completely')
  const [feedbackText, setFeedbackText] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>(['Professional', 'Helpful'])
  const [selectedTechnicalIssues, setSelectedTechnicalIssues] = useState<string[]>(['Video Quality'])
  const [technicalComment, setTechnicalComment] = useState('')
  const [nps, setNps] = useState(8)
  const [followUp, setFollowUp] = useState('Yes')
  const [submitted, setSubmitted] = useState(false)

  const feedbackLabel = getRatingLabel(overallRating)
  const charCount = feedbackText.length

  const dashboardHref = useMemo(() => {
    const params = new URLSearchParams({
      physicianId,
      physicianName,
      specialty,
      date,
      slot,
      duration,
      insurance,
      notes,
      feedback: 'submitted',
      overallRating: String(overallRating),
      followUp,
    })
    return `${PATIENT_ROUTES.dashboard}?${params.toString()}`
  }, [date, duration, followUp, insurance, notes, overallRating, physicianId, physicianName, slot, specialty])

  const updateCriterion = (key: string, value: number) => {
    setPhysicianRatings((current) => ({ ...current, [key]: value }))
  }

  const updateExperience = (key: string, value: number) => {
    setExperienceRatings((current) => ({ ...current, [key]: value }))
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  const toggleTechnicalIssue = (issue: string) => {
    setSelectedTechnicalIssues((current) => current.includes(issue) ? current.filter((item) => item !== issue) : [...current, issue])
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }


  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .fb-hero, .fb-card { background: rgba(255,255,255,0.9); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); border: 1px solid rgba(255,255,255,0.94); box-shadow: ${Sh.card}; }
        .fb-hero { border-radius: 28px; padding: 24px; position: relative; overflow: hidden; }
        .fb-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at top left, rgba(32,181,223,0.16), transparent 34%); pointer-events: none; }
        .fb-card { border-radius: 24px; padding: 20px; margin-top: 14px; }
        .fb-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(32,181,223,0.1); color: ${T.blue}; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .action-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid rgba(4,53,77,0.12); background: rgba(255,255,255,0.92); color: ${T.navy}; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.2s ease; cursor: pointer; }
        .action-btn:hover, .action-btn:focus-visible { transform: translateY(-1px); box-shadow: ${Sh.glow}; outline: none; }
        .action-btn.primary { background: linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%); color: #fff; border: none; box-shadow: 0 8px 22px rgba(32,181,223,0.24); }
        .action-btn.secondary { background: rgba(247,250,252,0.95); }
        .star-btn { background: none; border: none; cursor: pointer; padding: 2px; line-height: 1; font-size: 22px; transition: transform 0.15s ease; }
        .star-btn:hover { transform: scale(1.15); }
        .tag-btn { display: inline-flex; align-items: center; padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(4,53,77,0.1); background: rgba(255,255,255,0.9); color: ${T.navy}; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
        .tag-btn.selected { background: rgba(32,181,223,0.12); color: ${T.blue}; border-color: rgba(32,181,223,0.26); }
        .nps-btn { min-width: 40px; min-height: 40px; border-radius: 10px; border: 1px solid rgba(4,53,77,0.1); background: rgba(255,255,255,0.9); color: ${T.navy}; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; }
        .nps-btn.selected { background: rgba(32,181,223,0.14); color: ${T.blue}; border-color: rgba(32,181,223,0.28); }
        .fb-textarea { width: 100%; min-height: 120px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(4,53,77,0.1); background: rgba(255,255,255,0.96); color: ${T.navy}; font-size: 13px; line-height: 1.6; resize: vertical; outline: none; transition: border-color 0.2s ease; }
        .fb-textarea:focus { border-color: rgba(32,181,223,0.4); }
        .outcome-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 16px; border-radius: 16px; border: 1px solid rgba(4,53,77,0.1); background: rgba(255,255,255,0.9); color: ${T.navy}; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s ease; text-align: center; }
        .outcome-btn.selected { background: rgba(32,181,223,0.12); color: ${T.blue}; border-color: rgba(32,181,223,0.26); }
        .criteria-grid { display: grid; gap: 10px; }
        .outcome-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      `}</style>
      <PatientPortalShell
        eyebrow="Post-Consultation"
        title="Consultation Feedback"
        description="Share your experience to help improve the quality of care across the Qarevo Health platform."
      >
          <section className='feedback-hero'>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className='feedback-pill'>Thank you for choosing Qarevo Health</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: '30px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Your feedback helps shape a better care experience</h1>
              <p style={{ margin: '0 0 16px', maxWidth: '760px', fontSize: '14px', color: T.slate, lineHeight: 1.75 }}>Your feedback helps us improve healthcare experiences for you and every patient we serve.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button type='submit' form='feedback-form' className='action-btn primary'>Submit Feedback</button>
                <Link href={dashboardHref} className='action-btn secondary'>Skip for now</Link>
              </div>
              <div className='hero-stats'>
                <div className='hero-stat'>
                  <span>Completed Consultation</span>
                  <strong>Yes</strong>
                </div>
                <div className='hero-stat'>
                  <span>Doctor Name</span>
                  <strong>{physicianName}</strong>
                </div>
                <div className='hero-stat'>
                  <span>Consultation Date</span>
                  <strong>{date}</strong>
                </div>
                <div className='hero-stat'>
                  <span>Duration</span>
                  <strong>{duration}</strong>
                </div>
              </div>
            </div>
          </section>

          <form id='feedback-form' onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Overall experience</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>How would you rate your overall consultation experience?</h2>
                </div>
                <div className='feedback-chip'>{feedbackLabel}</div>
              </div>
              <div className='rating-card'>
                <StarControl value={overallRating} onChange={setOverallRating} label='Overall rating' />
                <div style={{ fontSize: '15px', fontWeight: 700, color: T.navy }}>Selected: {overallRating.toFixed(1)} / 5</div>
              </div>
            </section>

            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Physician rating</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>How would you rate your physician?</h2>
                </div>
                <div className='feedback-chip'>Verified care team</div>
              </div>
              <div className='profile-card' style={{ marginBottom: '14px' }}>
                <div className='avatar'>
                  {physician ? (
                    <img src={physician.imageUrl} alt={physicianName} />
                  ) : (
                    <Ico p={ICONS.steth} size={30} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: T.navy }}>{physicianName}</div>
                  <div style={{ fontSize: '12px', color: T.slate, marginTop: '4px' }}>{specialty} • {physician?.hospital ?? 'Qarevo Care Network'}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '5px 10px', borderRadius: 999, background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '11px', fontWeight: 700 }}>
                    <Ico p={ICONS.check} size={10} sw={2.2} color={T.blue} /> Verified physician
                  </div>
                </div>
              </div>
              <div>
                {physicianCriteria.map((criterion) => (
                  <div key={criterion.key} className='criterion-row'>
                    <span>{criterion.label}</span>
                    <StarControl
                      value={physicianRatings[criterion.key] ?? 4}
                      onChange={(value) => updateCriterion(criterion.key, value)}
                      label={`${criterion.label} rating`}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Consultation experience</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Rate your experience across the key moments</h2>
                </div>
                <div className='feedback-chip'>Premium experience</div>
              </div>
              <div>
                {experienceItems.map((item) => (
                  <div key={item.key} className='experience-row'>
                    <span>{item.label}</span>
                    <StarControl
                      value={experienceRatings[item.key] ?? 4}
                      onChange={(value) => updateExperience(item.key, value)}
                      label={`${item.label} rating`}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient outcome</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Did today’s consultation address your health concerns?</h2>
                </div>
                <div className='feedback-chip'>Clear response</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {outcomeOptions.map((option) => (
                  <button key={option.value} type='button' onClick={() => setSelectedOutcome(option.value)} className={`outcome-pill ${selectedOutcome === option.value ? 'active' : ''}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Written feedback</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Share what felt helpful, confusing, or worth improving</h2>
                </div>
                <div className='feedback-chip'>{charCount}/600</div>
              </div>
              <textarea
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value.slice(0, 600))}
                className='textarea'
                placeholder='Tell us about your experience... What went well? What could be improved? Was anything confusing? Would you recommend this physician?'
              />
            </section>

            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Quick feedback tags</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Choose the moments that mattered most</h2>
                </div>
                <div className='feedback-chip'>Multi-select</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {quickTags.map((tag) => (
                  <button key={tag.value} type='button' onClick={() => toggleTag(tag.value)} className={`tag-pill ${selectedTags.includes(tag.value) ? 'active' : ''}`}>
                    {tag.label}
                  </button>
                ))}
              </div>
            </section>

            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Technical feedback</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Did you experience any technical issues?</h2>
                </div>
                <div className='feedback-chip'>Optional</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {technicalIssues.map((issue) => (
                  <button key={issue.value} type='button' onClick={() => toggleTechnicalIssue(issue.value)} className={`tech-pill ${selectedTechnicalIssues.includes(issue.value) ? 'active' : ''}`}>
                    {issue.label}
                  </button>
                ))}
              </div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.navy, marginBottom: '8px' }}>Additional comments</label>
              <input type='text' value={technicalComment} onChange={(event) => setTechnicalComment(event.target.value)} className='field' placeholder='Share what happened and how we can improve it' />
            </section>

            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Likelihood to recommend</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>How likely are you to recommend Qarevo Health to friends or family?</h2>
                </div>
                <div className='feedback-chip'>NPS-style</div>
              </div>
              <div className='nps-grid'>
                {Array.from({ length: 11 }).map((_, index) => (
                  <button key={index} type='button' onClick={() => setNps(index)} className={`nps-pill ${nps === index ? 'active' : ''}`}>
                    {index}
                  </button>
                ))}
              </div>
            </section>

            <section className='feedback-card'>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Follow-up</p>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: T.navy }}>Would you like someone from our team to contact you regarding your feedback?</h2>
                </div>
                <div className='feedback-chip'>Optional</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Yes', 'No'].map((option) => (
                  <button key={option} type='button' onClick={() => setFollowUp(option)} className={`follow-pill-btn ${followUp === option ? 'active' : ''}`}>
                    {option}
                  </button>
                ))}
              </div>
            </section>

            <section className='feedback-card'>
              <div style={{ padding: '14px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(247,250,252,0.96) 0%, rgba(255,255,255,0.92) 100%)', border: '1px solid rgba(4,53,77,0.08)' }}>
                <div style={{ fontSize: '12px', color: T.slate2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rewards placeholder</div>
                <h3 style={{ margin: '6px 0 6px', fontSize: '17px', fontWeight: 800, color: T.navy }}>Thank you for helping improve Qarevo Health</h3>
                <p style={{ margin: 0, fontSize: '13px', color: T.slate, lineHeight: 1.7 }}>A future loyalty or rewards program may be introduced to recognize patients who help shape the quality of care.</p>
              </div>
              <div className='action-row'>
                <button type='submit' className='action-btn primary'>Submit Feedback</button>
                <Link href={dashboardHref} className='action-btn secondary'>Skip for now</Link>
              </div>
            </section>
          </form>
        </PatientPortalShell>
      </>
    )
}

export default function FeedbackPage() {
  return (
    <Suspense>
      <FeedbackPageContent />
    </Suspense>
  )
}
