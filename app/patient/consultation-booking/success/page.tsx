'use client'

import { useTranslations } from 'next-intl'
import { appointmentStatusKey } from '@/lib/appointment-status'
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
  const t = useTranslations('bookingSuccess')
  const tStatus = useTranslations('appointmentStatus')
  const appointmentStatus = (status?: string | null) => { const key = appointmentStatusKey(status); return key ? tStatus(key) : status?.replaceAll('_', ' ') || tStatus('unavailable') }
  const [appointment, setAppointment] = useState<SavedAppointment | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    if (!id) return
    apiGet<SavedAppointment>(`/api/v1/patient/appointments/${encodeURIComponent(id)}`)
      .then(value => {
        if (!value.id || value.id !== id || !Number.isFinite(Date.parse(value.start_at)) || !Number.isFinite(Date.parse(value.end_at))) throw new Error(t('theSavedAppointmentDetailsAre'))
        if (active) setAppointment(value)
      })
      .catch(failure => { if (active) setError(getApiErrorDetail(failure) || t('yourSavedBookingCouldNot')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, revision, t])
  const confirmed = appointment && ['BOOKED','SCHEDULED','CONFIRMED'].includes(appointment.status || '')
  const title = loading ? 'Verifying your booking' : confirmed ? 'Your consultation is booked' : appointment ? t('yourAppointmentStatus') : t('bookingConfirmationUnavailable')
  const zone = appointment?.time_zone || 'Europe/Berlin'
  const formatDate = (value: string) => {
    try { return new Date(value).toLocaleString('en-GB', {dateStyle:'full',timeStyle:'short',timeZone:zone}) }
    catch { return new Date(value).toLocaleString('en-GB', {timeZone:'Europe/Berlin'}) }
  }
  function downloadCalendar() {
    if (!appointment) return
    const date = (value:string) => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')
    const escape = (value:string) => value.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[;,]/g,'\\$&')
    const text = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Qarevo Health//Appointments//EN','BEGIN:VEVENT',`UID:${appointment.id}@qarevo-appointments`,`DTSTAMP:${date(new Date().toISOString())}`,`DTSTART:${date(appointment.start_at)}`,`DTEND:${date(appointment.end_at)}`,`SUMMARY:${escape('Qarevo consultation with '+(appointment.provider_name || t('yourClinician')))}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n')
    const url = URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'}))
    const anchor = document.createElement('a'); anchor.href=url; anchor.download='qarevo-appointment.ics'; anchor.click()
    setTimeout(()=>URL.revokeObjectURL(url),0)
  }
  return <PatientPortalShell eyebrow={t('consultationBooking')} title={title} description={t('yourSavedAppointmentIsThe')}>
    <section aria-busy={loading} className='rounded-3xl border border-theme bg-surface p-5 md:p-8'>
      {loading && <p role='status'>{t('checkingYourSavedAppointment')}</p>}
      {!loading && !id && <p role='alert'>{t('noSavedAppointmentWasSelected')}</p>}
      {error && <div role='alert'><p>{error}</p><button className='mt-4 min-h-11 rounded-xl border border-theme px-4 text-link' onClick={()=>{setError(''); setAppointment(null); setLoading(true); setRevision(value=>value+1)}}>{t('retryLoadingBooking')}</button></div>}
      {appointment && <>
        <p className='text-sm font-semibold text-muted'>{t('savedStatus', { status: appointmentStatus(appointment.status) })}</p>
        <h2 className='mt-3 text-2xl font-semibold tracking-tight'>{appointment.provider_name || t('assignedClinician')}</h2>
        {appointment.specialty && <p className='mt-2 text-muted'>{appointment.specialty}</p>}
        <dl className='my-6 grid gap-5 sm:grid-cols-2'>
          <div><dt className='text-sm text-muted'>{t('starts')}</dt><dd className='mt-1 font-medium'>{formatDate(appointment.start_at)}</dd></div>
          <div><dt className='text-sm text-muted'>{t('ends')}</dt><dd className='mt-1 font-medium'>{formatDate(appointment.end_at)}</dd></div>
          <div><dt className='text-sm text-muted'>{t('timeZone')}</dt><dd className='mt-1'>{zone}</dd></div>
          <div><dt className='text-sm text-muted'>{t('appointmentId')}</dt><dd className='mt-1 break-all'>{appointment.id}</dd></div>
        </dl>
        {confirmed && <><p className='max-w-2xl text-muted'>{t('yourAppointmentIsSavedAnd')}</p>
          <div className='mt-5 flex flex-wrap gap-3'>
            <Link className='inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link' href={`/patient/appointment-details?appointmentId=${encodeURIComponent(appointment.id)}`}>{t('viewAppointmentDetails')}</Link>
            <button className='min-h-11 rounded-xl border border-theme px-4 text-link' onClick={downloadCalendar}>{t('downloadCalendarEvent')}</button>
            <Link className='inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link' href='/patient/video-consultation/device-check'>{t('checkCameraAndMicrophone')}</Link>
          </div>
        </>}
      </>}
      <nav aria-label={t('bookingNavigation')} className='mt-8 flex flex-wrap gap-4 border-t border-theme pt-6'>
        <Link className='inline-flex min-h-11 items-center text-link' href={PATIENT_ROUTES.appointments}>{t('viewMyAppointments')}</Link>
        <Link className='inline-flex min-h-11 items-center text-link' href={PATIENT_ROUTES.dashboard}>{t('backToDashboard')}</Link>
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
  const t = useTranslations('bookingSuccess')
  return <Suspense fallback={<p role='status'>{t('openingYourBooking')}</p>}><BookingConfirmation /></Suspense>
}
