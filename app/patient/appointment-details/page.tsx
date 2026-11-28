'use client'

import { useLocale, useTranslations } from 'next-intl'
import { appointmentStatusKey } from '@/lib/appointment-status'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import AppointmentRescheduleDialog from '@/components/patient/AppointmentRescheduleDialog'
import { usePatientResource } from '@/lib/use-patient-resource'
import { calendarFile } from '@/lib/calendar-file'

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
  const t = useTranslations('patientAppointmentDetails')
  const tStatus = useTranslations('appointmentStatus')
  const appointmentStatus = (status?: string | null) => { const key = appointmentStatusKey(status); return key ? tStatus(key) : status?.replaceAll('_', ' ') || tStatus('unavailable') }
  const params = useSearchParams()
  const id = params.get('appointmentId')
  const resource = usePatientResource<Appointment>(id ? `/api/v1/patient/appointments/${encodeURIComponent(id)}` : null)
  const { data: appointment, loading } = resource
  const error = resource.error ? resource.errorMessage || t('yourAppointmentCouldNotBe') : ''
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null)
  const active = appointment && ['BOOKED', 'SCHEDULED', 'CONFIRMED'].includes(appointment.status || '')
  const locale = useLocale(), dateLocale = locale.startsWith('de') ? 'de-DE' : 'en-GB'
  const formatTime = (value: string) => new Date(value).toLocaleString(dateLocale, {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: appointment?.time_zone || 'Europe/Berlin',
  })
  /** "in 2 days" / "in 3 Stunden": the nearest sensible unit, only for upcoming appointments. */
  const startsIn = (value: string) => {
    const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000)
    if (!Number.isFinite(minutes) || minutes < 0) return null
    const format = new Intl.RelativeTimeFormat(dateLocale, { numeric: 'auto' })
    return minutes < 90 ? format.format(minutes, 'minute') : minutes < 36 * 60 ? format.format(Math.round(minutes / 60), 'hour') : format.format(Math.round(minutes / 1440), 'day')
  }
  const addToCalendar = () => {
    if (!appointment) return
    const doctor = appointment.provider_name || t('assignedClinician')
    const url = `${window.location.origin}/patient/appointment-details?appointmentId=${encodeURIComponent(appointment.id)}`
    const body = calendarFile({ uid: appointment.id, start: appointment.start_at, end: appointment.end_at, title: t('calendarTitle', { doctor }), description: t('calendarDescription', { url }), url })
    const link = document.createElement('a'), href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }))
    link.href = href; link.download = `qarevo-termin-${appointment.start_at.slice(0, 10)}.ics`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(href), 1000)
  }
  return <PatientPortalShell title={t('appointmentDetails')} description={t('yourSavedAppointmentCareTeam')}>
    <section className="rounded-3xl border border-theme bg-surface p-6 md:p-8" aria-busy={loading}>
      {loading && <p role="status">{t('loadingYourAppointment')}</p>}
      {!id && <p>{t('selectAnAppointmentToView')}</p>}
      {error && <div role="alert"><p>{error}</p><button className="mt-4 min-h-11 text-link underline" onClick={() => resource.retry()}>{t('retryLoadingAppointment')}</button></div>}
      {appointment && <>
        <p className="text-sm font-medium text-muted">{appointmentStatus(appointment.status)}{active && startsIn(appointment.start_at) ? ` · ${t('startsIn', { relative: startsIn(appointment.start_at) as string })}` : ''}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{appointment.provider_name || t('assignedClinician')}</h2>
        {appointment.specialty && <p className="mt-2 text-muted">{appointment.specialty}</p>}
        <dl className="my-6 grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-muted">{t('starts')}</dt><dd className="mt-1 font-medium">{formatTime(appointment.start_at)}</dd></div>
          <div><dt className="text-sm text-muted">{t('ends')}</dt><dd className="mt-1 font-medium">{formatTime(appointment.end_at)}</dd></div>
          <div><dt className="text-sm text-muted">{t('timeZone')}</dt><dd className="mt-1">{appointment.time_zone || 'Europe/Berlin'}</dd></div>
          <div><dt className="text-sm text-muted">{t('bookingReference')}</dt><dd className="mt-1 break-all">QRV-{appointment.id.slice(0, 8)}</dd></div>
        </dl>
        {active && <div className="border-t border-theme pt-6">
          <h3 className="text-lg font-semibold">{t('prepareForYourConsultation')}</h3>
          <p className="mt-2 max-w-2xl text-muted">{t('haveYourIdentificationAndMedication')}</p>
          {/* One page per appointment: what to do before, the room itself, and the summary afterwards. */}
          <ol className="mt-5 grid gap-3">
            {[
              { title: t('steps.device'), text: t('steps.deviceText'), href: '/patient/video-consultation/device-check', action: t('checkCameraAndMicrophone') },
              { title: t('steps.documents'), text: t('steps.documentsText'), href: '/patient/medical-records', action: t('steps.documentsAction') },
              { title: t('steps.questions'), text: t('steps.questionsText'), href: '/patient/messages', action: t('steps.questionsAction') },
              ...(appointment.consultation_id ? [{ title: t('steps.join'), text: t('steps.joinText'), href: `/patient/video-consultation/waiting-room?consultationId=${encodeURIComponent(appointment.consultation_id)}`, action: t('openVideoRoom') }] : []),
            ].map((step, index) => <li key={step.title} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-theme bg-surface-subtle p-4">
              <div className="flex min-w-0 flex-1 items-start gap-3" style={{ minWidth: 'min(100%, 240px)' }}>
                <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-sm font-bold text-link border border-theme">{index + 1}</span>
                <div className="min-w-0"><p className="m-0 font-semibold">{step.title}</p><p className="m-0 mt-1 text-sm text-muted">{step.text}</p></div>
              </div>
              <Link className="inline-flex min-h-11 items-center rounded-xl border border-theme bg-surface px-4 text-link" href={step.href}>{step.action}</Link>
            </li>)}
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="min-h-11 rounded-xl border border-theme px-4 text-link" onClick={addToCalendar}>{t('addToCalendar')}</button>
            <button className="min-h-11 rounded-xl border border-theme px-4 text-link" onClick={() => setRescheduleFor(id)}>{t('rescheduleAppointment')}</button>
          </div>
        </div>}
        {appointment.status === 'COMPLETED' && appointment.consultation_id && <div className="border-t border-theme pt-6">
          <h3 className="text-lg font-semibold">{t('yourCareSummary')}</h3>
          <p className="mt-2 text-muted">{t('reviewYourClinicianSPublished')}</p>
          <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link" href={`/patient/consultation-summary?consultationId=${encodeURIComponent(appointment.consultation_id)}`}>{t('viewCareSummary')}</Link>
        </div>}
        <p className="mt-6 text-sm text-muted">{t('paymentAndInsuranceVerificationAre')}</p>
      </>}
      <Link className="mt-6 inline-flex min-h-11 items-center text-link underline" href="/patient/appointments">{t('backToAppointments')}</Link>
    </section>
    {rescheduleFor === id && appointment && <AppointmentRescheduleDialog appointment={{ id: appointment.id, providerId: appointment.provider_id, physician: appointment.provider_name || t('assignedClinician') }} onClose={() => setRescheduleFor(null)} onSaved={() => { setRescheduleFor(null); resource.retry() }} />}
  </PatientPortalShell>
}

export default function AppointmentDetailsPage() {
  const t = useTranslations('patientAppointmentDetails')
  return <Suspense fallback={<p role="status" className="p-8">{t('loadingAppointment')}</p>}><AppointmentDetails /></Suspense>
}
