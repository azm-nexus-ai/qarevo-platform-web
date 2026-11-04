'use client'
import { useId, useState } from 'react'
import styles from './AccountSecurity.module.css'

export default function PasswordField({ label, value, onChange, autoComplete, error, hint }: {
  label: string; value: string; onChange: (value: string) => void; autoComplete: string; error?: string; hint?: string
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return <div className={styles.field}>
    <label htmlFor={id}>{label} <span className={styles.required}>(Required)</span></label>
    <div className={styles.inputWrap}>
      <input className={styles.input} id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required maxLength={128} value={value} onChange={event => onChange(event.target.value)} aria-invalid={!!error} aria-describedby={describedBy}/>
      <button className={styles.visibility} type='button' onClick={() => setVisible(current => !current)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} title={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}>
        <svg aria-hidden='true' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7'><path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z'/><circle cx='12' cy='12' r='3'/>{visible && <path d='m3 3 18 18'/>}</svg>
      </button>
    </div>
    {hint && <p className={styles.hint} id={`${id}-hint`}>{hint}</p>}
    {error && <p role='alert' className={styles.fieldError} id={`${id}-error`}>{error}</p>}
  </div>
}

