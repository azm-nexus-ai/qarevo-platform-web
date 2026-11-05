'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { accountChanged, acknowledgePortalScope, readAccountScope } from '@/lib/account-storage'
import { ApiError, getSessionStatus, storeBrowserSession } from '@/lib/api'
import { currentPortal, portalFromPath, readPortalIdentity, rememberPortal, retireLegacyCredentials, portalKey } from '@/lib/portal-scope'
import { BookingProvider } from '@/contexts/BookingContext'
import { SessionGuard, type InitialSessionCheck } from '@/components/ui/SessionGuard'

export function PortalSessionBoundary({children}:{children:ReactNode}) {
  const path=usePathname()
  const portal=typeof window === 'undefined' ? portalFromPath(path) || 'patient' : currentPortal(path)
  return <PortalBoundary key={`${portal}:${/^\/(patient|doctor|admin)(\/|$)|^\/auth\/profile-setup(\/|$)/.test(path)}`} portal={portal} path={path}>{children}</PortalBoundary>
}
function PortalBoundary({children,portal,path}:{children:ReactNode;portal:ReturnType<typeof currentPortal>;path:string}) {
  const protectedPage=/^\/(patient|doctor|admin)(\/|$)|^\/auth\/profile-setup(\/|$)/.test(path)
  const [entryPath] = useState(path)
  const [initialCheck,setInitialCheck]=useState<InitialSessionCheck>()
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0)
  useEffect(()=>{
    rememberPortal(portal); retireLegacyCredentials()
    // Switching portals is deliberate; changing identity inside an open portal is not.
    acknowledgePortalScope(portal)
    if(!protectedPage)return
    let alive=true
    const signIn=portal==='patient'?'/auth/sign-in':`/auth/${portal}/login`
    if(window.localStorage.getItem(portalKey('signed-out',portal))) {
      window.location.replace(`${signIn}?${new URLSearchParams({next:entryPath})}`);return
    }
    const before=readAccountScope(portal)
    const started=performance.now()
    void getSessionStatus().then(result=>{
      if(!alive)return
      const identity=result.browser_session
      if(!identity || (before && before!==JSON.stringify([portal,identity.user_id,identity.session_id]))) throw new Error('Your account changed. Reload this portal to continue.')
      storeBrowserSession(result,portal);
      const receivedAt=performance.now();setInitialCheck({status:result,receivedAt,requestDuration:receivedAt-started,scope:readAccountScope(portal)});setReady(true)
    }).catch(failure=>{
      if(!alive)return
      if(failure instanceof ApiError && [401,403].includes(failure.status)){
        // Only this portal's metadata is retired; other portal sessions are independent.
        if(readPortalIdentity(portal)) {window.localStorage.removeItem(`qarevo:${portal}:identity`);accountChanged(portal)}
        window.location.replace(`${signIn}?${new URLSearchParams({next:entryPath})}`);return
      }
      setError('Secure access could not be confirmed. Check your connection and retry.')
    })
    return()=>{alive=false}
  },[portal,protectedPage,attempt,entryPath])
  if(protectedPage&&!ready)return <main className='grid min-h-dvh place-items-center bg-surface-subtle px-6 text-ink'><section className='max-w-md rounded-2xl border border-theme bg-surface p-8'><h1 className='text-xl font-semibold'>Secure access</h1><p className='mt-3 text-sm' role={error?'alert':'status'}>{error||'Checking your portal session…'}</p>{error&&<button className='mt-5 rounded-xl border border-theme px-5 py-3' onClick={()=>{setError('');setAttempt(x=>x+1)}}>Retry connection</button>}</section></main>
  return <BookingProvider portal={portal}><SessionGuard initialCheck={initialCheck}>{children}</SessionGuard></BookingProvider>
}
