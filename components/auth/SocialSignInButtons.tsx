'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { beginSocial, socialProviders, type SocialAvailability, type SocialPortal, type SocialProvider } from '@/lib/social-auth'
import { getApiErrorDetail } from '@/lib/api'

export default function SocialSignInButtons({ portal, currentPassword }: { portal: SocialPortal; currentPassword?: string }) {
  const [providers, setProviders] = useState<SocialAvailability | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [pending, setPending] = useState<SocialProvider | null>(null)
  useEffect(() => {
    let current = true
    socialProviders().then(value => { if(current) { setProviders(value); setError('') } })
      .catch(() => { if(current) setError('Sign-in providers could not be checked. Email and password remain available.') })
    return () => { current = false }
  }, [retry])
  async function start(provider: SocialProvider) {
    if (pending || !providers?.[provider].enabled) return
    setPending(provider); setError('')
    try { await beginSocial(provider, portal, currentPassword) }
    catch (failure) { setError(getApiErrorDetail(failure) || 'Provider sign-in could not start. Please retry.'); setPending(null) }
  }
  return <section aria-label={currentPassword !== undefined ? 'Connect a sign-in provider' : 'Alternative sign-in'} style={{ marginTop: 20 }}>
    <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
      {(['google','apple'] as const).map(provider => <button key={provider} type='button' disabled={!providers?.[provider].enabled || !!pending || (currentPassword !== undefined && !currentPassword)} aria-describedby='social-status' onClick={()=>void start(provider)} style={{ flex:'1 1 140px', minHeight:44, padding:'10px 12px', border:'1px solid var(--border)', borderRadius:12, background:'var(--surface)', color:'var(--text)', fontWeight:600, cursor:providers?.[provider].enabled?'pointer':'not-allowed', opacity:providers?.[provider].enabled?1:.65 }}>
        {pending===provider?'Opening secure sign-in…':`${currentPassword !== undefined?'Connect':'Continue with'} ${provider==='google'?'Google':'Apple'}`}
      </button>)}
    </div>
    <p id='social-status' role='status' style={{ color:'var(--text-secondary)', fontSize:13, lineHeight:1.6 }}>{!providers && !error ? 'Checking secure sign-in options…' : providers && !providers.google.enabled && !providers.apple.enabled ? 'Google and Apple sign-in are unavailable while company provider configuration is completed. Use email and password.' : providers && (!providers.google.enabled || !providers.apple.enabled) ? `${!providers.google.enabled?'Google':'Apple'} sign-in configuration is pending.` : 'Provider accounts must first be connected from your signed-in account settings.'}</p>
    {error && <p role='alert' style={{color:'var(--danger)',fontSize:13}}>{error} {!providers && <button type='button' onClick={()=>setRetry(value=>value+1)}>Retry provider check</button>}</p>}
    {currentPassword === undefined && <Link href='/auth/social/connect' style={{color:'var(--link)',fontSize:13}}>Connect a provider after signing in</Link>}
  </section>
}
