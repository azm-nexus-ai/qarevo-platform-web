'use client'

import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PatientPortalShell from '@/components/patient/PatientPortalShell'
import AppointmentRescheduleDialog from '@/components/patient/AppointmentRescheduleDialog'
import { usePatientResource } from '@/lib/use-patient-resource'

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
  const params = useSearchParams()
  const id = params.get('appointmentId')
  const resource = usePatientResource<Appointment>(id ? `/api/v1/patient/appointments/${encodeURIComponent(id)}` : null)
  const { data: appointment, loading } = resource
  const error = resource.error ? resource.errorMessage || 'Your appointment could not be loaded. Please retry.' : ''
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null)
  const active = appointment && ['BOOKED', 'SCHEDULED', 'CONFIRMED'].includes(appointment.status || '')
  const formatTime = (value: string) => new Date(value).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: appointment?.time_zone || 'Europe/Berlin',
  })
  return <PatientPortalShell title={t('appointmentDetails')} description={t('yourSavedAppointmentCareTeam')}>
    <section className="rounded-3xl border border-theme bg-surface p-6 md:p-8" aria-busy={loading}>
      {loading && <p role="status">{t('loadingYourAppointment')}</p>}
      {!id && <p>{t('selectAnAppointmentToView')}</p>}
      {error && <div role="alert"><p>{error}</p><button className="mt-4 min-h-11 text-link underline" onClick={() => resource.retry()}>{t('retryLoadingAppointment')}</button></div>}
      {appointment && <>
        <p className="text-sm font-medium text-muted">{appointment.status?.replaceAll('_', ' ') || 'Status unavailable'}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{appointment.provider_name || 'Assigned clinician'}</h2>
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
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link" href="/patient/video-consultation/device-check">{t('checkCameraAndMicrophone')}</Link>
            {active && appointment.consultation_id && <Link className="inline-flex min-h-11 items-center rounded-xl border border-theme px-4 text-link" href={`/patient/video-consultation/waiting-room?consultationId=${encodeURIComponent(appointment.consultation_id)}`}>{t('openVideoRoom')}</Link>}
            {active && <button className="min-h-11 rounded-xl border border-theme px-4 text-link" onClick={() => setRescheduleFor(id)}>{t('rescheduleAppointment')}</button>}
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
    {rescheduleFor === id && appointment && <AppointmentRescheduleDialog appointment={{ id: appointment.id, providerId: appointment.provider_id, physician: appointment.provider_name || 'Assigned clinician' }} onClose={() => setRescheduleFor(null)} onSaved={() => { setRescheduleFor(null); resource.retry() }} />}
  </PatientPortalShell>
}

export default function AppointmentDetailsPage() {
  const t = useTranslations('patientAppointmentDetails')
  return <Suspense fallback={<p role="status" className="p-8">{t('loadingAppointment')}</p>}><AppointmentDetails /></Suspense>
}
