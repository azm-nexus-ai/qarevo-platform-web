'use client'
import { authenticatedPortalHandoff, safePortalDestination, type PortalHandoff } from '@/lib/portal-handoff'
import { WrongPortalNotice } from '@/components/auth/PortalSignInReference'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { finishSocial, saveSocialProfile, type SocialResult } from '@/lib/social-auth'
import { getApiErrorDetail } from '@/lib/api'
import { apiErrorInfo } from '@/lib/auth-errors'
import { getOnboarding, onboardingPath } from '@/lib/patient-onboarding'
import { usePortalAction } from '@/lib/portal-action'

class CallbackError extends Error {}

export default function SocialCallback() {
  const t=useTranslations('socialAuth.callback')
  const router=useRouter()
  const captureAction=usePortalAction()
  const started=useRef(false)
  const [error,setError]=useState('')
  const [existing,setExisting]=useState(false)
  const [handoff,setHandoff]=useState<PortalHandoff | null>(null)
  const [connected,setConnected]=useState(false)
  useEffect(()=>{
    if(started.current)return
    started.current=true
    const url=new URL(window.location.href)
    const query=new URLSearchParams(url.hash.slice(1) || url.search.slice(1))
    window.history.replaceState(window.history.state,'',url.pathname)
    const action=captureAction()
    let completed:SocialResult|undefined
    const current=()=>action.isCurrent({completedSession:completed?.browser_session,allowEndedSession:true})
    const exchange = async () => {
      if(query.get('error')) throw new CallbackError(t('cancelled'))
      const code=query.get('code'),state=query.get('state')
      if(!code || !state) throw new CallbackError(t('missing'))
      return finishSocial(code,state)
    }
    void exchange().then(async result=>{
      completed=result
      if(!current())return
      if(result.connected){setConnected(true);return}
      if(result.registration_required){
        // New person: finish the normal registration; the ticket stays in an HttpOnly cookie.
        saveSocialProfile(result)
        router.replace(result.role==='PROVIDER' ? '/auth/doctor-register?social=1' : '/auth/sign-up?social=1');return
      }
      if(result.role==='PROVIDER' && result.mfa_pending){
        sessionStorage.setItem('qarevo:doctor:identifier',result.identifier || '')
        const intended = safePortalDestination(result.intended || null, 'PROVIDER')
        router.replace('/auth/doctor/2fa' + (intended ? `?${new URLSearchParams({ next: intended })}` : ''));return
      }
      if(result.role==='PATIENT' && result.browser_session){
        const progress=await getOnboarding()
        if(!current())return
        router.replace(progress.complete ? safePortalDestination(result.intended || null, 'PATIENT') || '/patient/dashboard' : onboardingPath(progress.next_step));return
      }
      throw new CallbackError(t('incomplete'))
    }).catch(failure=>{
      if(!current())return
      const wrong = authenticatedPortalHandoff(failure)
      setHandoff(wrong)
      if(wrong) return
      const code = apiErrorInfo(failure).code
      if(code==='SOCIAL_ACCOUNT_EXISTS'){setExisting(true);setError(t('accountExists'));return}
      // Transaction errors are written in English by lib/social-auth; show their localised form.
      setError(failure instanceof CallbackError ? failure.message : failure instanceof Error && /browser tab/.test(failure.message) ? t('missing') : getApiErrorDetail(failure) || t('failed'))
    })
  },[router,captureAction,t])
  return <main style={{maxWidth:560,margin:'60px auto',padding:'24px 16px',color:'var(--text)'}}><h1 style={{fontSize:'clamp(22px,5vw,28px)'}}>{connected?t('connectedTitle'):t('title')}</h1>
    {handoff && <WrongPortalNotice handoff={handoff}/>}
    {handoff ? null : error?<p role='alert'>{error}</p>:connected?<p>{t('connectedBody')}</p>:<p role='status'>{t('verifying')}</p>}
    {(error || connected || handoff) && <nav aria-label={t('returnNav')} style={{display:'flex',gap:20,flexWrap:'wrap'}}>
      <Link href='/auth/sign-in'>{t('patientSignIn')}</Link><Link href='/auth/doctor/login'>{t('clinicianSignIn')}</Link>
      {existing && <Link href='/auth/forgot-password'>{t('forgotPassword')}</Link>}
    </nav>}
  </main>
}
