'use client'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost } from '@/lib/api'
import { usePracticeAction } from '@/lib/use-practice-action'
import { PRACTICE_AUTH, practiceControl } from '@/lib/practice'
import { PortalButton, PortalCard } from '@/components/patient/PatientPortalPrimitives'
import { FieldFeedback, ValidationSummary, focusValidation } from '@/components/ui/ValidationFeedback'
import { ActionFeedback, PracticeGate } from './PracticeShared'
import { Entry, challengeResult, verifiedSession } from './PracticeAuth'

const strongPassword = (value: string) => value.length >= 8 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)

export default function PracticeRegister() {
  return <Entry title='Register your practice' description='Create the owner account for a practice. After you confirm your email you can invite clinicians, upload your verification documents and accept the platform agreement.'>
    <PracticeGate><RegisterForm /></PracticeGate>
  </Entry>
}

type Fields = { first_name: string; last_name: string; practice_name: string; email: string; password: string }
const labels: Record<keyof Fields, string> = { first_name: 'First name', last_name: 'Last name', practice_name: 'Practice name', email: 'Work email', password: 'Password' }

function RegisterForm() {
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
    if (challenge) { if (!/^\d{6}$/.test(code)) next.code = 'Enter the six-digit code from your email.' }
    else {
      if (!fields.first_name.trim()) next.first_name = 'Enter your first name.'
      if (!fields.last_name.trim()) next.last_name = 'Enter your last name.'
      if (fields.practice_name.trim().length < 2) next.practice_name = 'Enter the practice name (at least 2 characters).'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()) || fields.email.trim().length > 255) next.email = 'Enter a valid email address.'
      if (!strongPassword(fields.password)) next.password = 'Use 8–128 characters with an uppercase letter, a lowercase letter, a number and a special character.'
    }
    setErrors(next); if (Object.keys(next).length) { focusValidation(event.currentTarget); return }
    if (challenge) await action.run(signal => apiPost(PRACTICE_AUTH + '/verify', { challenge_id: challenge.id, code }, undefined, signal),
      result => { verifiedSession(result); setCode(''); router.replace('/practice/verification'); return 'Email confirmed. Opening your practice workspace.' }, undefined, true)
    else await action.run(signal => apiPost(PRACTICE_AUTH + '/register', { ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, key === 'password' ? value : value.trim()])), country: 'DE' }, undefined, signal),
      result => { setChallenge(challengeResult(result)); setNow(Date.now()); setFields(previous => ({ ...previous, password: '' })); return 'If this email can be used for a new practice account, we have sent a six-digit code. Check your inbox and spam folder.' })
  }

  const input = (key: keyof Fields, type = 'text', autoComplete = 'off') => <div key={key} className='min-w-0'>
    <label htmlFor={'register-' + key} className='mb-2 block text-sm font-semibold text-ink'>{labels[key]} (Required)</label>
    <input id={'register-' + key} type={type} autoComplete={autoComplete} value={fields[key]} maxLength={key === 'practice_name' ? 160 : key === 'email' ? 255 : key === 'password' ? 128 : 100}
      onChange={event => set(key)(event.target.value)} className={practiceControl} aria-invalid={!!errors[key]} aria-describedby={`register-${key}-hint register-${key}-error`} />
    <FieldFeedback name={'register-' + key} error={errors[key]} hint={key === 'email' ? 'We send a code to confirm this mailbox. Use an address the practice controls.' : key === 'practice_name' ? 'As patients should see it. You can change it later.' : undefined} />
  </div>

  return <PortalCard><form noValidate onSubmit={submit} aria-busy={action.busy} className='grid gap-4'>
    <ValidationSummary errors={errors} />
    {!challenge ? <>
      <div className='grid min-w-0 gap-4 sm:grid-cols-2'>{input('first_name', 'text', 'given-name')}{input('last_name', 'text', 'family-name')}</div>
      {input('practice_name', 'text', 'organization')}
      {input('email', 'email', 'email')}
      <div className='min-w-0'>
        <label htmlFor='register-password' className='mb-2 block text-sm font-semibold text-ink'>Password (Required)</label>
        <div className='flex min-w-0 flex-wrap gap-2'>
          <input id='register-password' type={show ? 'text' : 'password'} autoComplete='new-password' maxLength={128} value={fields.password} onChange={event => set('password')(event.target.value)}
            className={practiceControl + ' flex-1'} aria-invalid={!!errors.password} aria-describedby='register-password-hint register-password-error' />
          <PortalButton type='button' onClick={() => setShow(value => !value)} aria-pressed={show}>{show ? 'Hide password' : 'Show password'}</PortalButton>
        </div>
        <FieldFeedback name='register-password' error={errors.password} hint='8–128 characters with an uppercase letter, a lowercase letter, a number and a special character.' />
      </div>
    </> : <>
      <p className='text-sm leading-7 text-secondary'>Enter the code we sent to {fields.email.trim()}. It expires after five minutes.</p>
      <div><label htmlFor='register-code' className='mb-2 block text-sm font-semibold text-ink'>Verification code (Required)</label>
        <input id='register-code' inputMode='numeric' autoComplete='one-time-code' maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} className={practiceControl} aria-invalid={!!errors.code} aria-describedby='register-code-error' />
        <FieldFeedback name='register-code' error={errors.code} /></div>
    </>}
    <ActionFeedback action={action} />
    <PortalButton type='submit' tone='primary' disabled={action.busy}>{action.busy ? 'Please wait…' : challenge ? 'Confirm email and continue' : 'Create practice account'}</PortalButton>
    {challenge && <PortalButton type='button' disabled={action.busy || remaining > 0} onClick={() => void action.run(signal => apiPost(PRACTICE_AUTH + '/resend', { challenge_id: challenge.id }, undefined, signal), result => { setChallenge(challengeResult(result)); setNow(Date.now()); return 'If eligible, we have sent the code again.' })}>{remaining ? `Resend available in ${remaining}s` : 'Send the code again'}</PortalButton>}
    <p className='text-sm text-secondary'>Already registered? <Link href='/auth/practice/login' className='font-semibold text-brand underline underline-offset-4'>Sign in</Link>. Independent doctors register in the <Link href='/auth/doctor-register' className='font-semibold text-brand underline underline-offset-4'>doctor portal</Link>.</p>
  </form></PortalCard>
}
