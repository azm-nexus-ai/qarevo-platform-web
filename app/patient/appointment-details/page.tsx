'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import AppointmentRescheduleDialog from '@/components/patient/AppointmentRescheduleDialog'
import { apiGet, getApiErrorDetail } from '@/lib/api'

type Appointment = {
  id: string
  consultation_id: string | null
  provider_id: string | null
  provider_name: string | null
  specialty: string | null
  start_at: string
  end_at: string
  time_zone: string | null
  status: string | null
}

function AppointmentDetails() {
  const params = useSearchParams()
  const id = params.get('appointmentId')
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reschedule, setReschedule] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setAppointment(null)
    setError('')
    if (!id) { setLoading(false); return }
    setLoading(true)
    apiGet<Appointment>(`/api/v1/patient/appointments/${encodeURIComponent(id)}`).then(data => {
      if (active) setAppointment(data)
    }).catch(error => {
      if (active) setError(getApiErrorDetail(error) || 'Your appointment could not be loaded. Please retry.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, revision])
  const active = appointment && ['BOOKED', 'SCHEDULED', 'CONFIRMED'].includes(appointment.status || '')
  const formatTime = (value: string) => new Date(value).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: appointment?.time_zone || 'Europe/Berlin',
  })
  return <PatientPortalShell title="Appointment details" description="Your saved appointment, care team and preparation steps.">
    <section className="rounded-3xl border border-theme bg-surface p-6 md:p-8" aria-busy={loading}>
      {loading && <p role="status">Loading your appointment…</p>}
      {!id && <p>Select an appointment to view its details.</p>}
      {error && <div role="alert"><p>{error}</p><button className="mt-4 min-h-11 text-link underline" onClick={() => setRevision(value => value + 1)}>Retry loading appointment</button></div>}
      {appointment && <>
        <p className="text-sm font-medium text-muted">{appointment.status?.replaceAll('_', ' ') || 'Status unavailable'}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{appointment.provider_name || 'Assigned clinician'}</h2>
        {appointment.specialty && <p className="mt-2 text-muted">{appointment.specialty}</p>}
        <dl className="my-6 grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-muted">Starts</dt><dd className="mt-1 font-medium">{formatTime(appointment.start_at)}</dd></div>
          <div><dt className="text-sm text-muted">Ends</dt><dd className="mt-1 font-medium">{formatTime(appointment.end_at)}</dd></div>
          <div><dt className="text-sm text-muted">Time zone</dt><dd className="mt-1">{appointment.time_zone || 'Europe/Berlin'}</dd></div>
          <div><dt className="text-sm text-muted">Booking reference</dt><dd className="mt-1 break-all">QRV-{appointment.id.slice(0, 8)}</dd></div>
        </dl>
        <div className="border-t border-theme pt-6">
          <h3 className="text-lg font-semibold">Prepare for your consultation</h3>
          <p className="mt-2 max-w-2xl text-muted">Have your identification and medication list available. You can check your camera and microphone before the appointment. The video room opens 15 minutes before the scheduled time.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link" href="/patient/video-consultation/device-check">Check camera and microphone</Link>
            {active && appointment.consultation_id && <Link className="inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link" href={`/patient/video-consultation/waiting-room?consultationId=${encodeURIComponent(appointment.consultation_id)}`}>Open video room</Link>}
            {active && <button className="min-h-11 rounded-xl border border-theme px-4 text-link" onClick={() => setReschedule(true)}>Reschedule appointment</button>}
          </div>
        </div>
        <p className="mt-6 text-sm text-muted">Payment and insurance verification are not configured for this development preview. This page does not confirm a charge, refund or insurance coverage.</p>
      </>}
      <Link className="mt-6 inline-flex min-h-11 items-center text-link underline" href="/patient/appointments">Back to appointments</Link>
    </section>
    {reschedule && appointment && <AppointmentRescheduleDialog appointment={{ id: appointment.id, providerId: appointment.provider_id, physician: appointment.provider_name || 'Assigned clinician' }} onClose={() => setReschedule(false)} onSaved={() => { setReschedule(false); setRevision(value => value + 1) }} />}
  </PatientPortalShell>
}

export default function AppointmentDetailsPage() {
  return <Suspense fallback={<p role="status" className="p-8">Loading appointment…</p>}><AppointmentDetails /></Suspense>
}
