'use client'

import { useTranslations } from 'next-intl'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getApiErrorDetail } from '@/lib/api'
import {
  getPatientSafetyScreen, safeBookingReturn, submitSafetyAnswers,
  type PatientSafetyScreen, type SafetyScreenResult,
} from '@/lib/safety-screen'

type Answer = 'yes' | 'no' | ''

function SafetyScreenContent() {
  const t = useTranslations('bookingSafety')
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeBookingReturn(searchParams.get('next'))
  const [screen, setScreen] = useState<PatientSafetyScreen | null>(null)
  const [loadError, setLoadError] = useState('')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<SafetyScreenResult | null>(null)
  const [revision, setRevision] = useState(0)
  // Bumped on each incomplete submit; focus moves once the summary has rendered.
  const [summaryRequest, setSummaryRequest] = useState(0)
  const outcomeHeading = useRef<HTMLHeadingElement>(null)
  const summary = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoadError('')
    getPatientSafetyScreen()
      .then(value => { if (!cancelled) { setScreen(value); setAnswers({}); setResult(null) } })
      .catch(error => { if (!cancelled) setLoadError(getApiErrorDetail(error) || t('theSafetyQuestionsCouldNot')) })
    return () => { cancelled = true }
  }, [revision, t])

  useEffect(() => { if (result && !result.allows_booking) outcomeHeading.current?.focus() }, [result])
  useEffect(() => { if (summaryRequest) summary.current?.focus() }, [summaryRequest])

  const questions = screen?.available ? screen.questions : []
  const unanswered = questions.filter(question => !answers[question.id])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!screen?.available || submitting) return
    setAttempted(true)
    if (unanswered.length) { setSummaryRequest(n => n + 1); return }
    setSubmitting(true); setSubmitError('')
    try {
      const payload = Object.fromEntries(questions.map(question => [question.id, answers[question.id] === 'yes']))
      const outcome = await submitSafetyAnswers(screen.version_id, payload)
      setResult(outcome)
      if (outcome.allows_booking) router.replace(next)
    } catch (error) {
      const detail = getApiErrorDetail(error)
      setSubmitError(detail || t('yourAnswersCouldNotBe'))
      if (/updated/i.test(detail || '')) setRevision(n => n + 1)
    } finally { setSubmitting(false) }
  }

  if (loadError) {
    return <Shell>
      <div role='alert' className='notice danger'>
        <p>{loadError}</p>
        <p><strong>{t('ifThisIsAnEmergency')}</strong> {t('forUrgentCareOutsideSurgery')}</p>
        <button className='secondary' onClick={() => setRevision(n => n + 1)}>{t('tryAgain')}</button>
      </div>
    </Shell>
  }

  if (!screen) return <Shell><p role='status'>{t('loadingSafetyQuestions')}</p></Shell>

  if (!screen.available) {
    return <Shell>
      {screen.required ? <div role='alert' className='notice danger'>
        <h2>{t('onlineBookingIsPaused')}</h2>
        <p>{t('weCannotCheckYourSymptoms')}</p>
        <p><strong>{t('ifThisIsAnEmergency')}</strong> {t('forUrgentCareOutsideSurgery')}</p>
        <Link className='secondary' href='/patient/dashboard'>{t('backToYourDashboard')}</Link>
      </div> : <div className='notice'>
        <h2>{t('noSafetyQuestionsArePublished')}</h2>
        <p>{t('thisDevelopmentEnvironmentHasNo')}</p>
        <button className='primary' onClick={() => router.replace(next)}>{t('continueToAppointmentTimes')}</button>
      </div>}
    </Shell>
  }

  if (result && !result.allows_booking) {
    const guidance = result.guidance
    return <Shell>
      <section className={`outcome ${result.outcome.toLowerCase()}`} aria-labelledby='outcome-title'>
        <h2 id='outcome-title' ref={outcomeHeading} tabIndex={-1}>{guidance?.title || t('aVideoConsultationIsNot')}</h2>
        <p className='outcome-body'>{guidance?.body || t('pleaseSeekCareInPerson')}</p>
        {guidance?.action_href && guidance.action_label && <a className='call' href={guidance.action_href}>{guidance.action_label}</a>}
        <p className='fine'>{t('yourAnswersHaveBeenSaved')}</p>
        <div className='actions'>
          <Link className='secondary' href='/patient/dashboard'>{t('backToYourDashboard')}</Link>
          <button className='link' onClick={() => { setResult(null); setAnswers({}); setAttempted(false) }}>{t('iAnsweredByMistake')}</button>
        </div>
      </section>
    </Shell>
  }

  return <Shell>
    <form noValidate onSubmit={submit} aria-busy={submitting}>
      <h2 className='form-title'>{screen.title}</h2>
      {screen.intro && <p className='intro'>{screen.intro}</p>}
      <p className='emergency-line'><strong>{t('inAnEmergencyCall112')}</strong> {t('doNotWaitForAn')}</p>
      {attempted && unanswered.length > 0 && <div ref={summary} tabIndex={-1} role='alert' className='notice danger'>
        Answer every question with yes or no. {unanswered.length === 1 ? '1 question is' : `${unanswered.length} questions are`} still open.
      </div>}
      {submitError && <div role='alert' className='notice danger'>{submitError}</div>}
      <ol className='questions'>
        {questions.map((question, index) => {
          const missing = attempted && !answers[question.id]
          return <li key={question.id}>
            <fieldset aria-describedby={question.help ? `${question.id}-help` : undefined} aria-invalid={missing || undefined}>
              <legend><span className='count'>{index + 1}</span>{question.prompt}</legend>
              {question.help && <p id={`${question.id}-help`} className='help'>{question.help}</p>}
              <div className='choices'>
                {(['yes', 'no'] as const).map(value => <label key={value} className={answers[question.id] === value ? 'chosen' : ''}>
                  <input type='radio' name={question.id} value={value} checked={answers[question.id] === value}
                    onChange={() => setAnswers(current => ({ ...current, [question.id]: value }))} />
                  {value === 'yes' ? 'Yes' : 'No'}
                </label>)}
              </div>
              {missing && <p className='missing'>{t('chooseYesOrNo')}</p>}
            </fieldset>
          </li>
        })}
      </ol>
      <div className='actions'>
        <Link className='secondary' href='/patient/dashboard'>{t('cancel')}</Link>
        <button className='primary' type='submit' disabled={submitting}>{submitting ? t('checking') : t('continue')}</button>
      </div>
    </form>
  </Shell>
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('bookingSafety')
  return <main className='safety-screen'>
    <header>
      <p className='eyebrow'>{t('beforeYouBook')}</p>
      <h1>{t('aFewSafetyQuestions')}</h1>
      <p className='lede'>{t('someSymptomsNeedEmergencyOr')}</p>
    </header>
    <div className='card'>{children}</div>
    <style jsx global>{`
      .safety-screen {min-height:100vh;background:var(--canvas);color:var(--text);padding:32px 16px 64px}
      .safety-screen header,.safety-screen .card {max-width:720px;margin:0 auto}
      .safety-screen .eyebrow {font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted);margin:0 0 8px}
      .safety-screen h1 {font-size:clamp(24px,4vw,30px);line-height:1.2;letter-spacing:-.02em;margin:0 0 8px}
      .safety-screen .lede {font-size:15px;line-height:1.6;color:var(--text-secondary);margin:0 0 24px}
      .safety-screen .card {background:var(--surface);border:1px solid var(--border-subtle);border-radius:var(--radius-lg,16px);padding:clamp(18px,4vw,32px)}
      .safety-screen h2 {font-size:20px;line-height:1.3;margin:0 0 12px}
      .safety-screen p {font-size:15px;line-height:1.6;margin:0 0 12px;overflow-wrap:anywhere}
      .safety-screen .intro {color:var(--text-secondary)}
      .safety-screen .emergency-line {padding:12px 14px;border-radius:12px;background:var(--danger-soft);color:var(--text)}
      .safety-screen .questions {list-style:none;margin:20px 0;padding:0;display:grid;gap:14px}
      .safety-screen fieldset {border:1px solid var(--border);border-radius:14px;padding:16px;margin:0;min-width:0}
      .safety-screen fieldset[aria-invalid] {border-color:var(--danger)}
      .safety-screen legend {display:flex;gap:10px;align-items:flex-start;font-size:16px;font-weight:600;line-height:1.5;padding:0}
      .safety-screen .count {flex:none;display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--surface-subtle);font-size:13px}
      .safety-screen .help {font-size:14px;color:var(--text-muted);margin:8px 0 0 36px}
      .safety-screen .choices {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
      .safety-screen .choices label {display:flex;align-items:center;gap:10px;min-height:48px;padding:0 14px;border:1px solid var(--border);border-radius:12px;cursor:pointer;font-weight:600}
      .safety-screen .choices label.chosen {border-color:var(--action-primary);box-shadow:0 0 0 1px var(--action-primary)}
      .safety-screen .choices input {width:20px;height:20px;accent-color:var(--action-primary)}
      .safety-screen .missing {color:var(--danger);font-size:14px;margin:8px 0 0}
      .safety-screen .notice {padding:16px;border-radius:12px;border:1px solid var(--border);background:var(--surface-subtle);margin-bottom:16px}
      .safety-screen .notice.danger {border-color:var(--danger);background:var(--danger-soft)}
      .safety-screen .actions {display:flex;flex-wrap:wrap;gap:12px;justify-content:flex-end;align-items:center;margin-top:20px}
      .safety-screen .primary,.safety-screen .secondary,.safety-screen .call {display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:12px;font:inherit;font-size:15px;font-weight:700;text-decoration:none;cursor:pointer}
      .safety-screen .primary {background:var(--action-primary);color:var(--surface);border:none}
      .safety-screen .primary:disabled {opacity:.6;cursor:progress}
      .safety-screen .secondary {background:var(--surface);color:var(--text);border:1px solid var(--border)}
      .safety-screen .link {background:none;border:none;color:var(--link,var(--action-primary));font:inherit;font-size:14px;text-decoration:underline;cursor:pointer;min-height:44px}
      .safety-screen .outcome h2 {font-size:24px}
      .safety-screen .outcome.emergency {border-left:4px solid var(--danger);padding-left:16px}
      .safety-screen .outcome.urgent,.safety-screen .outcome.in_person {border-left:4px solid var(--warning,var(--action-primary));padding-left:16px}
      .safety-screen .call {background:var(--danger);color:#fff;border:none;font-size:18px;margin:4px 0 16px;width:100%;max-width:360px}
      .safety-screen .outcome.in_person .call,.safety-screen .outcome.urgent .call {background:var(--action-primary)}
      .safety-screen .fine {font-size:14px;color:var(--text-muted)}
      .safety-screen :focus-visible {outline:3px solid var(--action-primary);outline-offset:2px}
      @media (max-width:420px) {.safety-screen .choices{grid-template-columns:1fr}.safety-screen .actions{justify-content:stretch}.safety-screen .actions>*{flex:1 1 100%}}
    `}</style>
  </main>
}

export default function SafetyScreenPage() {
  const t = useTranslations('bookingSafety')
  return <Suspense fallback={<main className='safety-screen'><p role='status'>{t('loadingSafetyQuestions')}</p></main>}>
    <SafetyScreenContent />
  </Suspense>
}
