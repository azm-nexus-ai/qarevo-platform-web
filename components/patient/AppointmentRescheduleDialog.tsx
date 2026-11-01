'use client'

import { useEffect, useRef, useState } from 'react'
import { apiPost, getApiErrorDetail, getPatientBookingAvailability, getPatientBookingSlots, type PatientBookingSlot } from '@/lib/api'
import { resolveBookingSlot } from '@/lib/booking-slot'

type Props = {
  appointment: { id: string; providerId?: string | null; physician: string }
  onClose: () => void
  onSaved: () => void
}

export default function AppointmentRescheduleDialog({ appointment, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [dates, setDates] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState<PatientBookingSlot[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  useEffect(() => {
    let active = true
    if (!appointment.providerId) {
      setLoading(false)
      setError('This appointment has no assigned clinician. Contact support to reschedule.')
      return
    }
    getPatientBookingAvailability(appointment.providerId).then(data => {
      if (!active) return
      const available = data.availability.filter(day => (day.slot_count || 0) > 0).map(day => day.date)
      setDates(available)
      if (!available.length) setError('No new times are available. Your existing appointment is unchanged.')
    }).catch(error => {
      if (active) setError(getApiErrorDetail(error) || 'Availability could not be loaded. Close and retry.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [appointment.providerId])

  useEffect(() => {
    if (!date || !appointment.providerId) return
    let active = true
    setLoading(true)
    setError('')
    getPatientBookingSlots(appointment.providerId, date).then(data => {
      if (!active) return
      setSlots(data.slot_details || [])
      if (!data.slot_details?.length) setError('No times remain on this date. Choose another date.')
    }).catch(error => {
      if (active) setError(getApiErrorDetail(error) || 'Times could not be loaded. Choose a date to retry.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [date, appointment.providerId])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!date || !selected || !appointment.providerId) {
      setError('Select an available date and time before confirming.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const fresh = await getPatientBookingSlots(appointment.providerId, date)
      const label = slots.find(slot => slot.start_at === selected)?.label || ''
      const slot = resolveBookingSlot(fresh.slot_details || [], label, selected)
      await apiPost(`/api/v1/appointments/${encodeURIComponent(appointment.id)}/reschedule`, {
        start_at: slot.start_at, end_at: slot.end_at, reason: 'Patient requested reschedule',
      })
      onSaved()
    } catch (error) {
      setError(getApiErrorDetail(error) || (error instanceof Error ? error.message : 'Rescheduling failed. Your existing appointment is unchanged.'))
    } finally { setSaving(false) }
  }

  return <dialog ref={dialog} onCancel={event => { if (saving) event.preventDefault(); else onClose() }}
    aria-labelledby="reschedule-title" className="qarevo-reschedule-dialog">
    <style>{`
      .qarevo-reschedule-dialog { margin: auto; width: min(520px, calc(100% - 24px)); max-height: 90dvh; overflow: auto; padding: clamp(20px, 4vw, 32px); border-radius: 24px; border: 1px solid var(--border); background: var(--surface); color: var(--ink); box-shadow: 0 24px 80px #0003; }
      .qarevo-reschedule-dialog::backdrop { background: #061b2abb; backdrop-filter: blur(4px); }
      .qarevo-reschedule-dialog label { display: grid; gap: 8px; font-weight: 600; margin-top: 20px; }
      .qarevo-reschedule-dialog select, .qarevo-reschedule-dialog button { min-height: 44px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-subtle); color: var(--ink); }
    `}</style>
    <form onSubmit={save} noValidate aria-busy={saving || loading}>
      <h2 id="reschedule-title" className="text-2xl font-semibold tracking-tight">Reschedule appointment</h2>
      <p className="mt-2 text-muted">{appointment.physician}. Your current time stays booked until the new time is confirmed.</p>
      <label htmlFor="reschedule-date">Date — required
        <select id="reschedule-date" value={date} disabled={saving} onChange={event => { setDate(event.target.value); setSelected(''); setSlots([]); setError('') }}>
          <option value="">Select a date</option>
          {dates.map(value => <option key={value} value={value}>{new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })}</option>)}
        </select>
      </label>
      <label htmlFor="reschedule-time">Time — required
        <select id="reschedule-time" value={selected} disabled={saving} onChange={event => { setSelected(event.target.value); setError('') }}>
          <option value="">Select a time</option>
          {slots.map(slot => <option key={slot.start_at} value={slot.start_at}>{slot.label} · {slot.time_zone} · {slot.duration_minutes} min</option>)}
        </select>
      </label>
      {loading && <p role="status" className="mt-4">Loading current availability…</p>}
      {error && <p role="alert" className="mt-4 text-red-700 dark:text-red-300">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="font-semibold">{saving ? 'Saving appointment…' : 'Confirm reschedule'}</button>
        <button type="button" disabled={saving} onClick={onClose}>Keep current appointment</button>
      </div>
    </form>
  </dialog>
}
