'use client'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { apiPost } from '@/lib/api'
import { usePracticeAction } from '@/lib/use-practice-action'
import { PRACTICE_AUTH, practiceControl } from '@/lib/practice'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback, PracticeGate } from './PracticeShared'
import { Entry, challengeResult, verifiedSession } from './PracticeAuth'

const strongPassword = (value: string) => value.length >= 8 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)

export default function PracticeRegister() {
  const t = useTranslations('practiceWs.register')
  return <Entry title={t('title')} description={t('description')}>
    <PracticeGate><RegisterForm /></PracticeGate>
  </Entry>
}

type Fields = { first_name: string; last_name: string; practice_name: string; email: string; password: string }
const labels = { first_name: 'firstName', last_name: 'lastName', practice_name: 'practiceName', email: 'email', password: 'password' } as const

function RegisterForm() {
  const t = useTranslations('practiceWs.register'), auth = useTranslations('auth.practice'), f = useTranslations('practiceWs.fields'), entry = useTranslations('practiceWs.entry')
  const router = useRouter(), action = usePracticeAction('practice-register')
  const [fields, setFields] = useState<Fields>({ first_name: '', last_name: '', practice_name: '', email: '', password: '' })
  const [show, setShow] = useState(false), [code, setCode] = useState(''), [errors, setErrors] = useState<Record<string, string>>({})
  const [challenge, setChallenge] = useState<ReturnType<typeof challengeResult> | null>(null), [now, setNow] = useState(0)
  useEffect(() => { if (!challenge) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [challenge])
  const remaining = challenge ? Math.max(0, Math.ceil((challenge.resend - now) / 1000)) : 0
  const set = (key: keyof Fields) => (value: string) => setFields(previous => ({ ...previous, [key]: value }))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (action.busy) return
    const next: Record<string, string> = {}
    if (challenge) { if (!/^\d{6}$/.test(code)) next.code = t('codeError') }
    else {
      if (!fields.first_name.trim()) next.first_name = t('firstNameError')
      if (!fields.last_name.trim()) next.last_name = t('lastNameError')
      if (fields.practice_name.trim().length < 2) next.practice_name = t('practiceNameError')
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) || fields.email.trim().length > 255) next.email = t('emailError')
      if (!strongPassword(fields.password)) next.password = t('passwordError')
    }
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    if (challenge) await action.run(signal => apiPost(PRACTICE_AUTH + '/verify', { challenge_id: challenge.id, code }, undefined, signal),
      result => { verifiedSession(result, entry('sessionUnverified')); setCode(''); router.replace('/practice/verification'); return t('confirmed') }, undefined, true)
    else await action.run(signal => apiPost(PRACTICE_AUTH + '/register', { ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, key === 'password' ? value : value.trim()])), country: 'DE' }, undefined, signal),
      result => { setChallenge(challengeResult(result, entry('challengeFailed'))); setNow(Date.now()); setFields(previous => ({ ...previous, password: '' })); return t('codeSent') })
  }

  const input = (key: keyof Fields, type = 'text', autoComplete = 'off') => <div key={key} className='min-w-0'>
    <label htmlFor={'register-' + key} className='mb-2 block text-sm font-semibold text-ink'>{f('required', { label: t(labels[key]) })}</label>
    <input id={'register-' + key} type={type} autoComplete={autoComplete} value={fields[key]} maxLength={key === 'practice_name' ? 160 : key === 'email' ? 255 : key === 'password' ? 128 : 100}
      onChange={event => set(key)(event.target.value)} className={practiceControl} aria-invalid={!!errors[key]} aria-describedby={`register-${key}-hint register-${key}-error`} />
    <FieldFeedback name={'register-' + key} error={errors[key]} hint={key === 'email' ? t('emailHint') : key === 'practice_name' ? t('practiceNameHint') : undefined} />
  </div>

  return <PortalCard><form noValidate onSubmit={submit} aria-busy={action.busy} className='grid gap-4'>
    <ValidationSummary errors={errors} />
    {!challenge ? <>
      <div className='grid min-w-0 gap-4 sm:grid-cols-2'>{input('first_name', 'text', 'given-name')}{input('last_name', 'text', 'family-name')}</div>
      {input('practice_name', 'text', 'organization')}
      {input('email', 'email', 'email')}
      <div className='min-w-0'>
        <label htmlFor='register-password' className='mb-2 block text-sm font-semibold text-ink'>{f('required', { label: t('password') })}</label>
        <div className='flex min-w-0 flex-wrap gap-2'>
          <input id='register-password' type={show ? 'text' : 'password'} autoComplete='new-password' maxLength={128} value={fields.password} onChange={event => set('password')(event.target.value)}
            className={practiceControl + ' flex-1'} aria-invalid={!!errors.password} aria-describedby='register-password-hint register-password-error' />
          <PortalButton type='button' onClick={() => setShow(value => !value)} aria-pressed={show}>{show ? auth('hidePassword') : auth('showPassword')}</PortalButton>
        </div>
        <FieldFeedback name='register-password' error={errors.password} hint={t('passwordHint')} />
      </div>
    </> : <>
      <p className='text-sm leading-7 text-secondary'>{t('codeIntro', { email: fields.email.trim() })}</p>
      <div><label htmlFor='register-code' className='mb-2 block text-sm font-semibold text-ink'>{auth('codeLabel')}</label>
        <input id='register-code' inputMode='numeric' autoComplete='one-time-code' maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className={practiceControl} aria-invalid={!!errors.code} aria-describedby='register-code-error' />
        <FieldFeedback name='register-code' error={errors.code} /></div>
    </>}
    <ActionFeedback action={action} />
    <PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? t('wait') : challenge ? t('confirmContinue') : t('create')}</PortalButton>
    {challenge && <PortalButton type='button' disabled={action.busy || remaining > 0} onClick={() => void action.run(signal => apiPost(PRACTICE_AUTH + '/resend', { challenge_id: challenge.id }, undefined, signal), result => { setChallenge(challengeResult(result, entry('challengeFailed'))); setNow(Date.now()); return t('resent') })}>{remaining ? auth('resendIn', { seconds: remaining }) : t('sendAgain')}</PortalButton>}
    <p className='text-sm text-secondary'>{t.rich('footer', { signIn: chunks => <Link href='/auth/practice/login' className='font-semibold text-brand underline underline-offset-4'>{chunks}</Link>, doctor: chunks => <Link href='/auth/doctor-register' className='font-semibold text-brand underline underline-offset-4'>{chunks}</Link> })}</p>
  </form></PortalCard>
}
