'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildBookingQueryParams } from '@/lib/booking'

/** Legacy confirmation route rejoins the single API-backed review/submit flow. */
function LegacyConfirmation() {
  const router=useRouter()
  const query=useSearchParams()
  useEffect(()=>{
    const next=buildBookingQueryParams(query,null,null)
    const target=next.get('appointmentId')?'success':'review'
    router.replace(`/patient/consultation-booking/${target}?${next.toString()}`)
  },[router,query])
  return <p role='status' className='p-6'>Opening your saved booking review…</p>
}
export default function ConfirmationPage(){return <Suspense fallback={<p role='status'>Opening booking review…</p>}><LegacyConfirmation/></Suspense>}
