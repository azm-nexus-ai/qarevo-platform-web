'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { beginSocial, socialProviders, SOCIAL_PROVIDERS, type SocialAvailability, type SocialPortal, type SocialProvider } from '@/lib/social-auth'
import { useTranslations } from 'next-intl'
import { getApiErrorDetail } from '@/lib/api'
import ActionLink from '@/components/ui/ActionLink'
import { usePortalAction } from '@/lib/portal-action'
import styles from './SocialSignInButtons.module.css'

/** Provider marks retain their approved provider colors; Qarevo tokens style the surrounding controls. */
function ProviderMark({ provider }: { provider: SocialProvider }) {
  if (provider === 'microsoft') return <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
    <path fill='#F25022' d='M2 2h9.5v9.5H2z'/><path fill='#7FBA00' d='M12.5 2H22v9.5h-9.5z'/>
    <path fill='#00A4EF' d='M2 12.5h9.5V22H2z'/><path fill='#FFB900' d='M12.5 12.5H22V22h-9.5z'/>
  </svg>
  return provider === 'google' ? <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
    <path fill='#4285F4' d='M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z'/>
    <path fill='#34A853' d='M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z'/>
    <path fill='#FBBC05' d='M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z'/>
    <path fill='#EA4335' d='M12 5.96c1.47 0 2.79.51 3.83 1.51L18.7 4.6A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z'/>
  </svg> : <svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true' focusable='false'><path d='M17.05 12.54c.03 3.02 2.65 4.02 2.68 4.04-.02.07-.42 1.44-1.38 2.86-.84 1.23-1.71 2.46-3.08 2.49-1.34.03-1.77-.8-3.3-.8-1.54 0-2.02.77-3.29.83-1.31.05-2.31-1.33-3.16-2.55-1.72-2.49-3.03-7.02-1.27-10.08a4.9 4.9 0 0 1 4.15-2.51c1.3-.02 2.53.88 3.31.88.77 0 2.23-1.09 3.76-.93.64.03 2.43.26 3.58 1.95-.1.06-2.14 1.25-2.11 3.82ZM14.52 5.1c.7-.86 1.17-2.04 1.04-3.23-1 .04-2.2.67-2.92 1.53-.65.75-1.22 1.95-1.06 3.1 1.11.09 2.24-.57 2.94-1.4Z'/></svg>
}

export default function SocialSignInButtons({ portal, currentPassword }: { portal: SocialPortal; currentPassword?: string }) {
  const t = useTranslations('socialAuth')
  const captureAction = usePortalAction()
  const [providers, setProviders] = useState<SocialAvailability | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const pendingRef = useRef(false)
  const statusId = useId()
  const linking = currentPassword !== undefined
  const names: Record<SocialProvider, string> = { google: 'Google', microsoft: 'Microsoft', apple: 'Apple' }
  useEffect(() => {
    let current = true
    socialProviders().then(value => { if (current) { setProviders(value); setError('') } })
      .catch(() => { if (current) setError(t('checkFailed')) })
    return () => { current = false }
  }, [retry, t])
  async function start(provider: SocialProvider) {
    if (pendingRef.current || !providers?.[provider].enabled) return
    pendingRef.current = true
    setPending(provider); setError('')
    const action = captureAction()
    try { await beginSocial(provider, portal, currentPassword, action.isCurrent) }
    catch (failure) { if (!action.isCurrent()) return; setError(getApiErrorDetail(failure) || t('startFailed')); setPending(null); pendingRef.current = false }
  }
  const unavailable = providers ? SOCIAL_PROVIDERS.filter(provider => !providers[provider].enabled).map(provider => names[provider]) : []
  const status = !providers && !error ? t('checking')
    : providers && unavailable.length === SOCIAL_PROVIDERS.length ? t('allUnavailable')
    : providers && unavailable.length ? t('someUnavailable', { providers: unavailable.join(', ') })
    : linking && !currentPassword ? t('enterPasswordFirst')
    : linking ? t('linkHint') : t('signUpHint')
  return <section className={styles.root} aria-label={linking ? t('connectRegion') : t('alternativeRegion')}>
    <div className={styles.buttons}>
      {SOCIAL_PROVIDERS.map(provider => <button key={provider} type='button'
        className={`${styles.provider} ${styles[provider]}`}
        disabled={!providers?.[provider].enabled || !!pending || (linking && !currentPassword)}
        aria-describedby={statusId} aria-busy={pending === provider}
        aria-label={linking ? t('connectWith', { provider: names[provider] }) : t('continueWith', { provider: names[provider] })}
        onClick={() => void start(provider)}>
        {pending === provider ? <span className={styles.spinner} aria-hidden='true'/> : <ProviderMark provider={provider}/>}
        <span>{pending === provider ? t('opening') : linking ? t('connectWith', { provider: names[provider] }) : t('continueWith', { provider: names[provider] })}</span>
      </button>)}
    </div>
    <p id={statusId} role='status' className={styles.status}>{status}</p>
    {error && <p role='alert' className={styles.error}>{error} {!providers && <button className='q-button q-button-secondary' type='button' onClick={() => setRetry(value => value + 1)}>{t('retry')}</button>}</p>}
    {!linking && <div className={styles.connect}><ActionLink href='/auth/social/connect' pendingLabel={t('openingConnections')}>{t('connectAfterSignIn')}</ActionLink></div>}
  </section>
}
