'use client'

import { useEffect, useRef, useState, type FormEvent, type CSSProperties } from 'react'
import Link from 'next/link'
import { ApiError, apiPost, getApiErrorDetail, resendVerificationEmail } from '@/lib/api'
import { PAGE_BG, Sh, T } from '@/lib/tokens'

type Phase = 'loading' | 'ready' | 'verifying' | 'verified' | 'error' | 'resending' | 'resent'

type VerificationResult = {
    message: string
    email_verified: true
    role: 'PATIENT' | 'PROVIDER'
    next_action: 'SIGN_IN' | 'CONTINUE_CLINICIAN_ONBOARDING'
}

export default function VerifyEmailLinkPage() {
    const initialized = useRef(false)
    const busy = useRef(false)
    const [token, setToken] = useState('')
    const [phase, setPhase] = useState<Phase>('loading')
    const [message, setMessage] = useState('Checking your link…')
    const [result, setResult] = useState<VerificationResult | null>(null)

    useEffect(() => {
        const readLink = () => {
            const url = new URL(window.location.href)
            const candidate = new URLSearchParams(url.hash.slice(1)).get('token')
                ?? url.searchParams.get('token')
                ?? ''

            if (!candidate && initialized.current) return
            initialized.current = true
            window.history.replaceState(window.history.state, '', url.pathname)
            setResult(null)

            if (!/^[A-Za-z0-9_-]{43}$/.test(candidate)) {
                setToken('')
                setPhase('error')
                setMessage('Open the complete link from your latest verification email, or request a new email below.')
                return
            }

            setToken(candidate)
            setPhase('ready')
            setMessage('Confirm below to verify the email address associated with this link.')
        }

        readLink()
        window.addEventListener('hashchange', readLink)
        return () => window.removeEventListener('hashchange', readLink)
    }, [])

    const verify = async () => {
        if (!token || busy.current) return
        busy.current = true
        setPhase('verifying')
        setMessage('Verifying your email…')

        try {
            const data = await apiPost<VerificationResult>(
                '/api/v1/auth/verify-email',
                { token },
            )

            const validAction =
                (data.role === 'PATIENT' && data.next_action === 'SIGN_IN') ||
                (data.role === 'PROVIDER' && data.next_action === 'CONTINUE_CLINICIAN_ONBOARDING')

            if (data.email_verified !== true || !validAction || typeof data.message !== 'string') {
                throw new Error('Unexpected response')
            }

            setResult(data)
            setToken('')
            setPhase('verified')
            setMessage(data.message)
        } catch (error) {
            setPhase('error')
            const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500

            if (rejected) setToken('')

            setMessage(rejected
                ? getApiErrorDetail(error) || 'This link cannot be used. Request a new email below.'
                : 'We could not confirm verification. Try again, or sign in if your email was already verified.')
        } finally {
            busy.current = false
        }
    }

    const resend = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (busy.current || phase === 'resent') return

        const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
        if (!email) return

        busy.current = true
        setPhase('resending')
        setMessage('Requesting a new verification email…')

        try {
            await resendVerificationEmail({ email })
            setToken('')
            setPhase('resent')
            setMessage('A new verification email was accepted for delivery. Open the latest email to continue.')
        } catch (error) {
            setPhase('error')
            setMessage(error instanceof ApiError
                ? getApiErrorDetail(error) || 'We could not request another email. Please try again later.'
                : 'We could not reach the service. Please try again.')
        } finally {
            busy.current = false
        }
    }

    const waiting = phase === 'verifying' || phase === 'resending'

    const buttonStyle: CSSProperties = {
        width: '100%', padding: '14px 18px', borderRadius: '12px',
        border: 'none', background: T.navy, color: '#fff',
        font: 'inherit', fontWeight: 700,
        cursor: waiting ? 'wait' : 'pointer',
        opacity: waiting ? 0.65 : 1,
    }

    return (
        <main style={{
            minHeight: '100vh', background: PAGE_BG, display: 'grid',
            placeItems: 'center', padding: '32px 20px',
        }}>
            <section aria-labelledby="verification-title" aria-busy={waiting} style={{
                width: '100%', maxWidth: '460px', padding: '32px', borderRadius: '24px',
                background: T.card, border: '1px solid ' + T.border, boxShadow: Sh.card,
            }}>
                <Link href="/" style={{ color: T.navy, fontWeight: 800, textDecoration: 'none' }}>
                    Qarevo Health
                </Link>

                <h1 id="verification-title" style={{ color: T.navy, fontSize: '28px', margin: '28px 0 12px' }}>
                    {phase === 'verified' ? 'Email verified' : phase === 'resent' ? 'Check your inbox' : 'Verify your email'}
                </h1>

                <p role={phase === 'error' ? 'alert' : 'status'} style={{
                    color: phase === 'error' ? T.red : T.slate, lineHeight: 1.65,
                }}>
                    {message}
                </p>

                {token && phase !== 'verified' && (
                    <button type="button" onClick={verify} disabled={waiting} style={buttonStyle}>
                        {phase === 'verifying' ? 'Verifying…' : 'Verify email'}
                    </button>
                )}

                {phase === 'verified' && result?.next_action === 'SIGN_IN' && (
                    <Link href="/auth/sign-in?next=profile-setup" style={{
                        ...buttonStyle, display: 'block', textAlign: 'center',
                        textDecoration: 'none', boxSizing: 'border-box',
                    }}>
                        Sign in and complete your profile
                    </Link>
                )}

                {phase === 'verified' && result?.next_action === 'CONTINUE_CLINICIAN_ONBOARDING' && (
                    <p style={{ color: T.slate, lineHeight: 1.65 }}>
                        Return to your clinician registration tab to complete the remaining onboarding checks.
                    </p>
                )}

                {phase !== 'verified' && phase !== 'loading' && phase !== 'resent' && (
                    <details style={{ marginTop: '24px', color: T.slate }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                            Request a new verification email
                        </summary>

                        <form onSubmit={resend} style={{ marginTop: '16px' }}>
                            <label htmlFor="resend-email">Your registered email address</label>
                            <input
                                id="resend-email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                maxLength={254}
                                disabled={waiting}
                                style={{
                                    boxSizing: 'border-box', width: '100%', padding: '12px',
                                    margin: '8px 0 12px', border: '1px solid ' + T.border,
                                    borderRadius: '10px', font: 'inherit',
                                }}
                            />
                            <button type="submit" disabled={waiting} style={buttonStyle}>
                                {phase === 'resending' ? 'Requesting…' : 'Send verification email'}
                            </button>
                        </form>
                    </details>
                )}

                {phase !== 'verified' && (
                    <p style={{ marginTop: '24px', fontSize: '14px', color: T.slate }}>
                        Already verified? <Link href="/auth/sign-in">Sign in</Link>
                    </p>
                )}
            </section>
        </main>
    )
}