'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { apiGet, getApiErrorDetail } from '@/lib/api'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import { PATIENT_ROUTES } from '@/constants/patient-navigation'

type SavedAppointment = {
  id: string; provider_id: string | null; provider_name: string | null; specialty: string | null
  consultation_id: string | null; start_at: string; end_at: string; time_zone: string | null; status: string | null
}

function SavedBooking({ id }: { id: string }) {
  const [appointment, setAppointment] = useState<SavedAppointment | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    if (!id) return
    apiGet<SavedAppointment>(`/api/v1/patient/appointments/${encodeURIComponent(id)}`)
      .then(value => {
        if (!value.id || value.id !== id || !Number.isFinite(Date.parse(value.start_at)) || !Number.isFinite(Date.parse(value.end_at))) throw new Error('The saved appointment details are incomplete. Please open your appointments list.')
        if (active) setAppointment(value)
      })
      .catch(failure => { if (active) setError(getApiErrorDetail(failure) || 'Your saved booking could not be loaded. Please retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, revision])
  const confirmed = appointment && ['BOOKED','SCHEDULED','CONFIRMED'].includes(appointment.status || '')
  const title = loading ? 'Verifying your booking' : confirmed ? 'Your consultation is booked' : appointment ? 'Your appointment status' : 'Booking confirmation unavailable'
  const zone = appointment?.time_zone || 'Europe/Berlin'
  const formatDate = (value: string) => {
    try { return new Date(value).toLocaleString('en-GB', {dateStyle:'full',timeStyle:'short',timeZone:zone}) }
    catch { return new Date(value).toLocaleString('en-GB', {timeZone:'Europe/Berlin'}) }
  }
  function downloadCalendar() {
    if (!appointment) return
    const date = (value:string) => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')
    const escape = (value:string) => value.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[;,]/g,'\\$&')
    const text = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Qarevo Health//Appointments//EN','BEGIN:VEVENT',`UID:${appointment.id}@qarevo-appointments`,`DTSTAMP:${date(new Date().toISOString())}`,`DTSTART:${date(appointment.start_at)}`,`DTEND:${date(appointment.end_at)}`,`SUMMARY:${escape('Qarevo consultation with '+(appointment.provider_name || 'your clinician'))}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n')
    const url = URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'}))
    const anchor = document.createElement('a'); anchor.href=url; anchor.download='qarevo-appointment.ics'; anchor.click()
    setTimeout(()=>URL.revokeObjectURL(url),0)
  }
  return <PatientPortalShell eyebrow='Consultation booking' title={title} description='Your saved appointment is the source of truth. Review its details and prepare for your consultation.'>
    <section aria-busy={loading} className='rounded-3xl border border-theme bg-surface p-5 md:p-8'>
      {loading && <p role='status'>Checking your saved appointment…</p>}
      {!loading && !id && <p role='alert'>No saved appointment was selected. Open your appointments list to check whether your booking was completed.</p>}
      {error && <div role='alert'><p>{error}</p><button className='mt-4 min-h-11 rounded-xl border border-theme px-4 text-link' onClick={()=>{setError(''); setAppointment(null); setLoading(true); setRevision(value=>value+1)}}>Retry loading booking</button></div>}
      {appointment && <>
        <p className='text-sm font-semibold text-muted'>Saved status: {appointment.status?.replaceAll('_',' ') || 'Unavailable'}</p>
        <h2 className='mt-3 text-2xl font-semibold tracking-tight'>{appointment.provider_name || 'Assigned clinician'}</h2>
        {appointment.specialty && <p className='mt-2 text-muted'>{appointment.specialty}</p>}
        <dl className='my-6 grid gap-5 sm:grid-cols-2'>
          <div><dt className='text-sm text-muted'>Starts</dt><dd className='mt-1 font-medium'>{formatDate(appointment.start_at)}</dd></div>
          <div><dt className='text-sm text-muted'>Ends</dt><dd className='mt-1 font-medium'>{formatDate(appointment.end_at)}</dd></div>
          <div><dt className='text-sm text-muted'>Time zone</dt><dd className='mt-1'>{zone}</dd></div>
          <div><dt className='text-sm text-muted'>Appointment ID</dt><dd className='mt-1 break-all'>{appointment.id}</dd></div>
        </dl>
        {confirmed && <><p className='max-w-2xl text-muted'>Your appointment is saved and available in your appointments list. Keep identification, medication details and any questions ready. Check your camera and microphone before joining.</p>
          <div className='mt-5 flex flex-wrap gap-3'>
            <Link className='inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link' href={`/patient/appointment-details?appointmentId=${encodeURIComponent(appointment.id)}`}>View appointment details</Link>
            <button className='min-h-11 rounded-xl border border-theme px-4 text-link' onClick={downloadCalendar}>Download calendar event</button>
            <Link className='inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link' href='/patient/video-consultation/device-check'>Check camera and microphone</Link>
          </div>
        </>}
      </>}
      <nav aria-label='Booking navigation' className='mt-8 flex flex-wrap gap-4 border-t border-theme pt-6'>
        <Link className='inline-flex min-h-11 items-center text-link' href={PATIENT_ROUTES.appointments}>View my appointments</Link>
        <Link className='inline-flex min-h-11 items-center text-link' href={PATIENT_ROUTES.dashboard}>Back to dashboard</Link>
      </nav>
    </section>
  </PatientPortalShell>
}

function BookingConfirmation() {
  const params = useSearchParams()
  const requested = params.get('appointmentId') || ''
  const id = /^[a-zA-Z0-9_-]{1,80}$/.test(requested) ? requested : ''
  return <SavedBooking key={id} id={id} />
}

export default function SuccessPage() {
  return <Suspense fallback={<p role='status'>Opening your booking…</p>}><BookingConfirmation /></Suspense>
}
