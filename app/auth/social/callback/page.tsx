'use client'
import { authenticatedPortalHandoff, safePortalDestination, type PortalHandoff } from '@/lib/portal-handoff'
import { WrongPortalNotice } from '@/components/auth/PortalSignInReference'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { finishSocial, type SocialResult } from '@/lib/social-auth'
import { getApiErrorDetail } from '@/lib/api'
import { getOnboarding, onboardingPath } from '@/lib/patient-onboarding'
import { usePortalAction } from '@/lib/portal-action'

export default function SocialCallback() {
  const router=useRouter()
  const captureAction=usePortalAction()
  const started=useRef(false)
  const [error,setError]=useState('')
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
      if(query.get('error')) throw new Error('Provider sign-in was cancelled or declined. You can try again or use email and password.')
      const code=query.get('code'),state=query.get('state')
      if(!code || !state) throw new Error('The provider callback is missing. Start sign-in again in this browser tab.')
      return finishSocial(code,state)
    }
    void exchange().then(async result=>{
      completed=result
      if(!current())return
      if(result.connected){setConnected(true);return}
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
      throw new Error('The sign-in response was incomplete. Please use email and password.')
    }).catch(failure=>{if(!current())return;const wrong = authenticatedPortalHandoff(failure);setHandoff(wrong);setError(wrong ? '' : getApiErrorDetail(failure) || 'Provider sign-in failed. Please try again.')})
  },[router,captureAction])
  return <main style={{maxWidth:560,margin:'60px auto',padding:24,color:'var(--text)'}}><h1>{connected?'Sign-in provider connected':'Completing secure sign-in'}</h1>
    {handoff && <WrongPortalNotice handoff={handoff}/>}
    {handoff ? null : error?<p role='alert'>{error}</p>:connected?<p>Your provider is now linked to this account. Future provider sign-in still enforces the account’s role, status and any required second factor.</p>:<p role='status'>Verifying the provider response…</p>}
    {(error || connected || handoff) && <nav aria-label='Return to sign-in' style={{display:'flex',gap:20,flexWrap:'wrap'}}><Link href='/auth/sign-in'>Patient sign-in</Link><Link href='/auth/doctor/login'>Clinician sign-in</Link></nav>}
  </main>
}
