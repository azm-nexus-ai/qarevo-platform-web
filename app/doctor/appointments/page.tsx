'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getApiErrorDetail, getDoctorAppointments, isAuthError, type DoctorAppointmentsResponse } from '@/lib/api'
import ClinicalStatusBadge from '@/components/ui/ClinicalStatusBadge'
import { PortalButton } from '@/components/patient/PatientPortalPrimitives'

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function DoctorAppointments() {
  const router = useRouter()
  const [result, setResult] = useState<{ key: string; data: DoctorAppointmentsResponse | null; error: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const requestKey = `${statusFilter}:${page}:${revision}`
  const loading = result?.key !== requestKey
  const data = loading ? null : result?.data
  const error = loading ? '' : result?.error

  useEffect(() => {
    let current = true
    getDoctorAppointments(statusFilter || undefined, { page, page_size: 10 })
      .then(appointments => {
        if (current) setResult({ key: requestKey, data: appointments, error: '' })
      })
      .catch(failure => {
        if (!current) return
        if (isAuthError(failure)) { router.replace('/auth/doctor/login'); return }
        setResult({ key: requestKey, data: null, error: getApiErrorDetail(failure) || 'Unable to load appointments. Please try again.' })
      })
    return () => { current = false }
  }, [router, statusFilter, page, requestKey])

  const refresh = () => setRevision(value => value + 1)
  const cards: [string, number | undefined][] = [
    ['Total appointments', data?.total_count],
    ['Filtered results', data?.filtered_count],
    ['Upcoming', data?.upcoming_count],
  ]

  return <div className='space-y-6'>
    <header className='flex flex-wrap items-end justify-between gap-4'>
      <div className='min-w-0'><h1 className='text-2xl font-bold text-ink'>Appointments</h1><p className='mt-1 text-sm text-muted'>Your complete appointment history and upcoming bookings.</p></div>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='grid gap-2'><label htmlFor='appointment-status' className='text-sm font-semibold text-secondary'>Appointment status</label>
          <select id='appointment-status' value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1) }} className='min-h-11 max-w-full rounded-xl border border-theme bg-surface px-4 py-2 text-ink'>
            <option value=''>All statuses</option><option value='booked'>Booked</option><option value='scheduled'>Scheduled</option><option value='completed'>Completed</option><option value='cancelled'>Cancelled</option><option value='no_show'>No show</option>
          </select>
        </div>
        <PortalButton type='button' disabled={loading} onClick={refresh}>Refresh appointments</PortalButton>
      </div>
    </header>

    <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>{cards.map(([label, count]) => <section key={label} aria-label={label} className='rounded-xl border border-theme bg-surface p-5'>
      <h2 className='text-sm font-medium text-secondary'>{label}</h2><p className='mt-2 text-3xl font-bold text-ink'>{count ?? '—'}</p>
      {label === 'Upcoming' && <p className='mt-2 text-xs text-muted'>Future bookings across all pages and filters.</p>}
    </section>)}</div>

    <section aria-labelledby='appointments-title' aria-busy={loading} className='rounded-2xl border border-theme bg-surface p-5 sm:p-6'>
      <h2 id='appointments-title' className='portal-h2'>Appointment list</h2>
      {loading ? <p role='status' className='py-8 text-center text-muted'>Loading appointments…</p>
        : error ? <div role='alert' className='rounded-xl border border-theme bg-surface-subtle p-5 text-ink'><p className='mb-4'>{error}</p><PortalButton type='button' onClick={refresh}>Try again</PortalButton></div>
        : data && <>
          {!data.appointments.length ? <div className='py-8 text-center'><h3 className='portal-h3'>{statusFilter ? 'No matching appointments' : 'No appointments yet'}</h3><p className='text-muted'>{statusFilter ? 'Choose All statuses to see your complete appointment history.' : 'Patient bookings will appear here once scheduled.'}</p>{statusFilter && <PortalButton type='button' onClick={() => { setStatusFilter(''); setPage(1) }}>Show all appointments</PortalButton>}</div>
            : <div className='grid gap-3'>{data.appointments.map(appointment => <button key={appointment.appointment_id} type='button' onClick={() => router.push(`/doctor/appointments/${appointment.appointment_id}`)} className='flex w-full flex-col items-start justify-between gap-4 rounded-xl border border-theme bg-canvas p-4 text-left transition-colors hover:bg-surface-subtle sm:flex-row sm:items-center'>
              <span className='flex min-w-0 items-center gap-3'><span aria-hidden className='grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-subtle font-semibold text-ink'>{appointment.patient_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PT'}</span>
                <span className='min-w-0'><span className='block break-words font-semibold text-ink'>{appointment.patient_name}</span><span className='block text-sm text-muted'>{formatDate(appointment.start_at)}</span>{appointment.consultation_modality && <span className='mt-1 block text-xs text-secondary'>{appointment.consultation_modality}</span>}</span>
              </span><span className='flex shrink-0 items-center gap-3'><ClinicalStatusBadge status={appointment.status} domain='appointment' /><span aria-hidden className='text-muted'>→</span></span>
            </button>)}</div>}
          <div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-theme pt-4'><p className='text-sm text-muted'>Page {data.page} · Showing {data.appointments.length} of {data.filtered_count}</p>
            <div className='flex flex-wrap gap-2'><PortalButton type='button' disabled={!data.has_previous} onClick={() => setPage(current => Math.max(1, current - 1))}>Previous appointments</PortalButton><PortalButton type='button' disabled={!data.has_next} onClick={() => setPage(current => current + 1)}>Next appointments</PortalButton></div>
          </div>
        </>}
    </section>
  </div>
}
