'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'
import { useBookingContext } from '@/contexts/BookingContext'
import {
  getPatientDoctor,
  getPatientBookingAvailability,
  getPatientBookingSlots,
  type PatientDoctor,
  type PatientBookingAvailabilityDay,
  type PatientBookingWorkingHours,
} from '@/lib/api'

function readLabel(service: string | null) {
  switch (service) {
    case 'physical':
      return 'In-person Consultation'
    case 'follow-up':
      return 'Follow-up Consultation'
    default:
      return 'Video Consultation'
  }
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatWorkingTime(value?: string | null) {
  if (!value) return 'Not set'
  const [hourValue, minuteValue = '00'] = value.split(':')
  const hour = Number(hourValue)
  if (!Number.isFinite(hour)) return value
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minuteValue.padStart(2, '0')} ${suffix}`
}

function formatFee(value: number) {
  return value > 0 ? `$${value}` : 'Not configured'
}

function groupSlots(slots: string[]) {
  const groups = [
    { label: 'Morning', slots: [] as string[] },
    { label: 'Afternoon', slots: [] as string[] },
    { label: 'Evening', slots: [] as string[] },
  ]

  slots.forEach((slot) => {
    const [timePart, meridiem] = slot.split(' ')
    const [hourPart] = timePart.split(':')
    let hour = Number(hourPart)
    if (meridiem === 'PM' && hour !== 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0

    if (hour < 12) groups[0].slots.push(slot)
    else if (hour < 17) groups[1].slots.push(slot)
    else groups[2].slots.push(slot)
  })

  return groups.filter((group) => group.slots.length > 0)
}

function parseSlotStart(date: Date, slot: string) {
  const [timePart, meridiem] = slot.split(' ')
  const [hourPart, minutePart = '0'] = timePart.split(':')
  let hour = Number(hourPart)
  const minute = Number(minutePart)
  if (meridiem === 'PM' && hour !== 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0
  const start = new Date(date)
  start.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0)
  return start
}

function profileServices(doctor: PatientDoctor | null) {
  const services = doctor?.profile?.services
  if (!Array.isArray(services)) return []

  return services
    .map((service) => {
      if (!service || typeof service !== 'object') return null
      const item = service as Record<string, unknown>
      return {
        type: typeof item.type === 'string' ? item.type : '',
        duration: typeof item.duration === 'string' ? item.duration : '',
        price: typeof item.price === 'number' ? item.price : null,
      }
    })
    .filter((service): service is { type: string; duration: string; price: number | null } => Boolean(service))
}

function doctorToBookingFallback(doctor: PatientDoctor | null) {
  if (!doctor) return undefined
  return {
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty,
    hospital: doctor.hospital,
    imageUrl: doctor.imageUrl || '',
    consultationFee: doctor.consultationFee,
    experienceYears: doctor.experienceYears,
    rating: doctor.rating,
    languages: doctor.languages,
    insurance: doctor.insurance,
  }
}

function DateTimeSelectionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { bookingState, updateBookingState } = useBookingContext()

  const physicianId = searchParams.get('physicianId') ?? searchParams.get('provider_id') ?? bookingState.physicianId ?? ''
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const [remoteDoctor, setRemoteDoctor] = useState<PatientDoctor | null>(null)
  const [doctorLoadError, setDoctorLoadError] = useState('')
  const bookingFallback = useMemo(() => doctorToBookingFallback(remoteDoctor) ?? physician, [remoteDoctor, physician])
  const physicianData = useMemo(() => getBookingPhysician(searchParams, bookingFallback), [searchParams, bookingFallback])
  const service = bookingState.service ?? searchParams.get('service') ?? searchParams.get('service_type') ?? 'video'
  const serviceDetail = useMemo(() => {
    const services = profileServices(remoteDoctor)
    return services.find((item) => item.type === service) ?? services[0]
  }, [remoteDoctor, service])
  const fee = Number(searchParams.get('fee') ?? serviceDetail?.price ?? physicianData.consultationFee ?? 0)
  const duration = searchParams.get('duration') ?? serviceDetail?.duration ?? '30 min'
  const insurance = searchParams.get('insurance') ?? physicianData.insurance[0] ?? 'Self pay'
  const initialDateParam = searchParams.get('date') ?? bookingState.date
  const initialDate = useMemo(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(initialDateParam ?? '')) {
      const parsed = new Date(`${initialDateParam}T00:00:00`)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed
      }
    }
    return new Date()
  }, [initialDateParam])

  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedSlot, setSelectedSlot] = useState(bookingState.slot ?? searchParams.get('slot') ?? '')
  const [showTimeSheet, setShowTimeSheet] = useState(false)
  const [availability, setAvailability] = useState<PatientBookingAvailabilityDay[]>([])
  const [workingHours, setWorkingHours] = useState<PatientBookingWorkingHours | null>(null)
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const preservedParams = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    return next.toString()
  }, [searchParams, physicianData, service])

  const summaryHref = physicianData.id
    ? `/patient/physicians/${physicianData.id}${preservedParams ? `?${preservedParams}` : ''}`
    : '/patient/find-doctor'

  const selectedDateKey = formatDateKey(selectedDate)
  const quickShortcuts = [
    { label: 'Today', date: new Date() },
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: 'Next Week', date: addDays(new Date(), 7) },
  ]

  const slotGroups = useMemo(() => groupSlots(availableSlots), [availableSlots])
  const firstAvailableDay = availability.find((day) => day.status === 'available')
  const selectedAvailability = availability.find((day) => day.date === selectedDateKey)

  const continueHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    next.set('date', formatDateLabel(selectedDate))
    if (selectedSlot) next.set('slot', selectedSlot)
    return `/patient/consultation-booking/review?${next.toString()}`
  }, [searchParams, physicianData, selectedDate, selectedSlot, service])

  // Save booking state to context when selections change
  useEffect(() => {
    if (physicianData.id) {
      updateBookingState({
        physicianId: physicianData.id,
        physicianName: physicianData.name,
        service,
        date: formatDateLabel(selectedDate),
        slot: selectedSlot,
        step: 'datetime',
      })
    }
  }, [physicianData.id, physicianData.name, service, selectedDate, selectedSlot, updateBookingState])

  useEffect(() => {
    if (!physicianData.id) return

    let cancelled = false
    getPatientBookingAvailability(physicianData.id)
      .then((response) => {
        if (cancelled) return
        setAvailabilityError('')
        setAvailability(response.availability)
        setWorkingHours(response.working_hours ?? null)
        setAvailableDays(response.available_days ?? [])

        const requestedIsAvailable = response.availability.some((day) => day.date === selectedDateKey && day.status === 'available')
        const firstAvailableDate = response.availability.find((day) => day.status === 'available')?.date
        if (!requestedIsAvailable && firstAvailableDate) {
          setSelectedDate(new Date(`${firstAvailableDate}T00:00:00`))
        }
      })
      .catch((error) => {
        console.error('Failed to load provider availability', error)
        if (!cancelled) {
          setAvailability([])
          setAvailableDays([])
          setAvailabilityError('We could not load this doctor schedule. Please try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailability(false)
      })

    return () => {
      cancelled = true
    }
  }, [physicianData.id, selectedDateKey])

  useEffect(() => {
    if (!physicianData.id || !selectedDateKey) return

    let cancelled = false
    getPatientBookingSlots(physicianData.id, selectedDateKey)
      .then((response) => {
        if (cancelled) return
        setAvailableSlots(response.slots)
        setWorkingHours((current) => response.working_hours ?? current)
        setSelectedSlot((current) => response.slots.includes(current) ? current : response.slots[0] ?? '')
      })
      .catch((error) => {
        console.error('Failed to load provider slots', error)
        if (!cancelled) {
          setAvailableSlots([])
          setSelectedSlot('')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })

    return () => {
      cancelled = true
    }
  }, [physicianData.id, selectedDateKey])

  const appointmentEnd = useMemo(() => {
    const parts = duration.match(/(\d+)/)
    const minutes = parts ? Number(parts[1]) : 30
    const start = parseSlotStart(selectedDate, selectedSlot || '9:00 AM')
    start.setMinutes(start.getMinutes() + minutes)
    return `${start.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`
  }, [duration, selectedDate, selectedSlot])

  const canContinue = Boolean(selectedSlot && availableSlots.includes(selectedSlot))

  useEffect(() => {
    if (!physicianId || physician) return

    let cancelled = false
    getPatientDoctor(physicianId)
      .then((doctor) => {
        if (cancelled) return
        setRemoteDoctor(doctor)
        setDoctorLoadError('')
      })
      .catch((error) => {
        console.error('Failed to load selected doctor', error)
        if (!cancelled) {
          setRemoteDoctor(null)
          setDoctorLoadError('We could not load the selected physician details. Please go back and choose the doctor again.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [physicianId, physician])

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div className='dt-page' style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <style>{`
          .dt-grid { display: grid; gap: 16px; grid-template-columns: 280px minmax(0, 1fr) 340px; align-items: start; }
          .dt-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .dt-slot-grid { display: grid; gap: 8px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          @media (max-width: 1120px) {
            .dt-grid { grid-template-columns: 1fr; }
            .dt-side { position: static !important; }
          }
          @media (max-width: 640px) {
            .dt-page { padding: 14px 12px 28px !important; }
            .dt-detail-grid, .dt-slot-grid { grid-template-columns: 1fr; }
          }
        `}</style>
        <Link href={summaryHref} style={{ minHeight: '42px', marginBottom: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 14px', borderRadius: '12px', border: '1px solid rgba(4,53,77,0.1)', background: 'rgba(255,255,255,0.84)', boxShadow: '0 10px 24px rgba(4,53,77,0.08)', color: T.navy, textDecoration: 'none', fontSize: '13px', fontWeight: 800 }}>
          <Ico p={ICONS.arrowBack} size={15} sw={2} color={T.navy} />
          Back
        </Link>
        <div className='dt-grid'>
          <aside style={{ display: 'grid', gap: '12px' }}>
            <section style={{ ...Glass.nav, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.84)', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Booking Progress</p>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.blue }}>60%</p>
              </div>
              <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'rgba(4,53,77,0.08)', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{ width: '60%', height: '100%', background: 'linear-gradient(90deg, #20B5DF 0%, #348CEA 100%)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {['Doctor Selected', 'Consultation Type', 'Date & Time', 'Review', 'Confirmation'].map((step, index) => {
                  const completed = index < 2
                  const active = index === 2
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: active ? 'rgba(32,181,223,0.08)' : completed ? 'rgba(15,158,119,0.08)' : 'rgba(255,255,255,0.7)', border: `1px solid ${active ? 'rgba(32,181,223,0.16)' : completed ? 'rgba(15,158,119,0.16)' : 'rgba(4,53,77,0.08)'}` }}>
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: completed ? T.greenLight : active ? T.blueLight : 'rgba(255,255,255,0.8)', color: completed ? T.green : active ? T.blue : T.slate2, fontSize: '11px', fontWeight: 700 }}>
                        {completed ? <Ico p={ICONS.check} size={10} sw={2.2} color={T.green} /> : index + 1}
                      </span>
                      <span style={{ fontSize: '12px', color: active ? T.navy : T.slate, fontWeight: active ? 700 : 600 }}>{step}</span>
                    </div>
                  )
                })}
              </div>
            </section>

            <section style={{ ...Glass.pill, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.84)', padding: '18px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 9px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
                <Ico p={ICONS.lock} size={11} sw={2.2} color={T.blue} />
                Protected scheduling
              </div>
              <h2 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '18px', fontWeight: 800, color: T.navy, letterSpacing: '-0.02em' }}>{physicianData.name}</h2>
              {doctorLoadError && (
                <div style={{ marginBottom: '10px', borderRadius: '12px', border: '1px solid rgba(220,38,38,0.2)', background: 'rgba(254,242,242,0.9)', color: '#B91C1C', padding: '10px 11px', fontSize: '12px', fontWeight: 700, lineHeight: 1.5 }}>
                  {doctorLoadError}
                </div>
              )}
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physicianData.specialty} · {physicianData.hospital}</p>
              <div style={{ display: 'grid', gap: '7px', fontSize: '12px', color: T.slate2 }}>
	                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Consultation</span><strong style={{ color: T.navy }}>{readLabel(service)}</strong></div>
	                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Duration</span><strong style={{ color: T.navy }}>{duration}</strong></div>
	                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Working hours</span><strong style={{ color: T.navy }}>{formatWorkingTime(workingHours?.start)} - {formatWorkingTime(workingHours?.end)}</strong></div>
	                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Days</span><strong style={{ color: T.navy }}>{availableDays.length ? availableDays.join(', ') : 'Not configured'}</strong></div>
	                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Fee</span><strong style={{ color: T.navy }}>{formatFee(fee)}</strong></div>
	                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Insurance</span><strong style={{ color: T.green }}>{insurance}</strong></div>
              </div>
            </section>
          </aside>

          <section style={{ display: 'grid', gap: '14px' }}>
            <header style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '22px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', background: 'rgba(32,181,223,0.1)', color: T.blue, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                    <Ico p={ICONS.calendar} size={11} sw={2.2} color={T.blue} />
                    Premium scheduling
                  </div>
                  <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Choose Your Appointment</h1>
                  <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7, maxWidth: '760px' }}>Select your preferred consultation date and time. Availability updates smoothly so you can book with confidence and clarity.</p>
                </div>
                <Link href={summaryHref} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: T.blue, fontSize: '13px', fontWeight: 700 }}>
                  <Ico p={ICONS.arrowBack} size={14} sw={1.8} color={T.blue} />
                  Back to Consultation Options
                </Link>
              </div>
            </header>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <button
	                  type='button'
	                  onClick={() => {
	                    const firstAvailable = firstAvailableDay?.date
	                    if (firstAvailable) {
	                      setSelectedDate(new Date(`${firstAvailable}T00:00:00`))
	                    }
	                  }}
	                  disabled={!firstAvailableDay}
	                  style={{ borderRadius: '999px', border: '1px solid rgba(32,181,223,0.34)', background: 'linear-gradient(135deg, rgba(32,181,223,0.12) 0%, rgba(52,140,234,0.12) 100%)', color: T.blue, fontSize: '14px', fontWeight: 700, padding: '12px 16px', cursor: firstAvailableDay ? 'pointer' : 'not-allowed', opacity: firstAvailableDay ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px' }}
                >
                  <Ico p={ICONS.check} size={12} sw={2.2} color={T.blue} />
                  First Available
                </button>
	                {quickShortcuts.map((shortcut) => {
	                  const active = selectedDateKey === formatDateKey(shortcut.date)
	                  const available = availability.some((day) => day.date === formatDateKey(shortcut.date) && day.status === 'available')
	                  return (
	                    <button
	                      key={shortcut.label}
	                      type='button'
	                      disabled={!available}
	                      onClick={() => setSelectedDate(shortcut.date)}
	                      style={{ borderRadius: '999px', border: active ? '1px solid rgba(32,181,223,0.34)' : '1px solid rgba(4,53,77,0.1)', background: active ? 'rgba(32,181,223,0.1)' : 'rgba(255,255,255,0.8)', color: active ? T.blue : T.slate, fontSize: '14px', fontWeight: 700, padding: '12px 16px', cursor: available ? 'pointer' : 'not-allowed', opacity: available ? 1 : 0.5, minHeight: '44px' }}
                    >
                      {shortcut.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Select Date</p>
                  <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Choose your preferred appointment date</h2>
                </div>

	                <input
                  type='date'
                  value={formatDateKey(selectedDate)}
                  onChange={(event) => {
                    const newDate = new Date(event.target.value)
                    if (!isNaN(newDate.getTime())) {
                      setSelectedDate(newDate)
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%',
                    borderRadius: '12px',
                    border: '1px solid rgba(4,53,77,0.12)',
                    padding: '16px', // 44px minimum touch target
                    fontSize: '16px', // Prevent iOS zoom
                    fontWeight: 600,
                    color: T.navy,
                    background: 'rgba(255,255,255,0.95)',
                    outline: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    minHeight: '48px',
	                  }}
	                />
	                {availabilityError && (
	                  <div style={{ borderRadius: '12px', border: '1px solid rgba(220,38,38,0.22)', background: 'rgba(254,242,242,0.9)', color: '#B91C1C', padding: '11px 12px', fontSize: '13px', fontWeight: 600 }}>
	                    {availabilityError}
	                  </div>
	                )}
	                {selectedAvailability && selectedAvailability.status !== 'available' && (
	                  <div style={{ borderRadius: '12px', border: '1px solid rgba(217,119,6,0.22)', background: 'rgba(255,251,235,0.9)', color: T.amber, padding: '11px 12px', fontSize: '13px', fontWeight: 600 }}>
	                    This doctor has no open slot on {formatDateLabel(selectedDate)}.
	                  </div>
	                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', paddingTop: '2px' }}>
                  {[
                    ['Selected Date', T.blue],
                    ['Today', T.green],
                  ].map(([label, color]) => (
                    <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: T.slate, fontWeight: 600 }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Time Slots</p>
                  <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Choose a premium appointment window</h2>
                </div>
	                <div style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(165,224,218,0.24)', color: T.teal, fontSize: '12px', fontWeight: 700 }}>Timezone: {workingHours?.timezone ?? 'Doctor timezone'}</div>
              </div>

              {/* Mobile bottom sheet trigger */}
	              <button
	                type='button'
	                onClick={() => setShowTimeSheet(true)}
	                disabled={!availableSlots.length}
	                style={{
                  width: '100%',
                  borderRadius: '14px',
                  border: '1px solid rgba(32,181,223,0.34)',
                  background: 'linear-gradient(135deg, rgba(32,181,223,0.12) 0%, rgba(52,140,234,0.12) 100%)',
                  color: T.blue,
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 700,
	                  cursor: availableSlots.length ? 'pointer' : 'not-allowed',
	                  opacity: availableSlots.length ? 1 : 0.55,
                  minHeight: '48px',
                  marginBottom: '12px',
                }}
              >
	                Select Time Slot: {selectedSlot || 'No slots available'}
	              </button>

	              <div style={{ display: 'grid', gap: '12px' }}>
	                {(loadingAvailability || loadingSlots) ? (
	                  <div style={{ borderRadius: '14px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.88)', padding: '16px', color: T.slate, fontSize: '13px', fontWeight: 600 }}>
	                    Loading real doctor slots...
	                  </div>
	                ) : slotGroups.length === 0 ? (
	                  <div style={{ borderRadius: '14px', border: '1px solid rgba(4,53,77,0.08)', background: 'rgba(247,250,252,0.88)', padding: '16px', color: T.slate, fontSize: '13px', lineHeight: 1.6 }}>
                    No appointment slots are open for this date. Choose one of the doctor configured days.
	                  </div>
	                ) : slotGroups.map((group) => (
	                  <div key={group.label}>
	                    <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{group.label}</p>
	                    <div className='dt-slot-grid'>
	                      {group.slots.map((slot) => {
	                        const disabled = !availableSlots.includes(slot)
                        const active = selectedSlot === slot
                        return (
                          <button
                            key={slot}
                            type='button'
                            disabled={disabled}
                            onClick={() => setSelectedSlot(slot)}
                            style={{ textAlign: 'left', borderRadius: '14px', border: active ? '1px solid rgba(32,181,223,0.34)' : '1px solid rgba(4,53,77,0.08)', background: active ? 'linear-gradient(135deg, rgba(232,248,252,0.95) 0%, rgba(255,255,255,0.95) 100%)' : disabled ? 'rgba(247,250,252,0.82)' : 'rgba(255,255,255,0.9)', color: disabled ? T.slate2 : T.navy, padding: '14px 16px', cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: active ? Sh.glow : 'none', transition: 'transform 0.16s ease, box-shadow 0.16s ease', minHeight: '48px', fontSize: '16px' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700 }}>{slot}</span>
                              {active ? <span style={{ padding: '4px 7px', borderRadius: '999px', background: T.blueLight, color: T.blue, fontSize: '10px', fontWeight: 700 }}>Selected</span> : disabled ? <span style={{ fontSize: '10px', fontWeight: 700, color: T.slate2 }}>Booked</span> : <span style={{ fontSize: '10px', fontWeight: 700, color: T.green }}>Available</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Mobile Bottom Sheet */}
            {showTimeSheet && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  animation: 'fadeIn 0.2s ease',
                }}
                onClick={() => setShowTimeSheet(false)}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: '600px',
                    backgroundColor: 'rgba(255,255,255,0.98)',
                    borderRadius: '24px 24px 0 0',
                    padding: '20px',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    animation: 'slideUp 0.3s ease',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: T.navy }}>Select Time Slot</h3>
                    <button
                      type='button'
                      onClick={() => setShowTimeSheet(false)}
                      style={{ border: 'none', background: 'transparent', fontSize: '24px', cursor: 'pointer', color: T.slate, padding: '8px' }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: '12px' }}>
	                    {slotGroups.map((group) => (
	                      <div key={group.label}>
	                        <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{group.label}</p>
	                        <div className='dt-slot-grid'>
	                          {group.slots.map((slot) => {
	                            const disabled = !availableSlots.includes(slot)
                            const active = selectedSlot === slot
                            return (
                              <button
                                key={slot}
                                type='button'
                                disabled={disabled}
                                onClick={() => {
                                  setSelectedSlot(slot)
                                  setShowTimeSheet(false)
                                }}
                                style={{ textAlign: 'left', borderRadius: '14px', border: active ? '1px solid rgba(32,181,223,0.34)' : '1px solid rgba(4,53,77,0.08)', background: active ? 'linear-gradient(135deg, rgba(232,248,252,0.95) 0%, rgba(255,255,255,0.95) 100%)' : disabled ? 'rgba(247,250,252,0.82)' : 'rgba(255,255,255,0.9)', color: disabled ? T.slate2 : T.navy, padding: '16px', cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: active ? Sh.glow : 'none', minHeight: '52px', fontSize: '16px' }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '15px', fontWeight: 700 }}>{slot}</span>
                                  {active ? <span style={{ padding: '6px 10px', borderRadius: '999px', background: T.blueLight, color: T.blue, fontSize: '12px', fontWeight: 700 }}>Selected</span> : disabled ? <span style={{ fontSize: '12px', fontWeight: 700, color: T.slate2 }}>Booked</span> : <span style={{ fontSize: '12px', fontWeight: 700, color: T.green }}>Available</span>}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <style jsx>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Appointment Details</p>
                    <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Everything needed for a smooth visit</h2>
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(32,181,223,0.08)', color: T.blue, fontSize: '12px', fontWeight: 700 }}>Automatically detected timezone</div>
                </div>

	                <div className='dt-detail-grid'>
                  {[
                    ['Consultation Type', readLabel(service)],
                    ['Appointment Duration', duration],
                    ['Estimated End Time', appointmentEnd],
                    ['Consultation Fee', formatFee(fee)],
                    ['Insurance Coverage', insurance],
                    ['Cancellation Policy', 'Free up to 24 hours before appointment'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '12px 13px', borderRadius: '14px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</p>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: T.navy }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Preparation Tips</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>A calm, ready experience</h2>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {['Prepare your medical documents', 'Ensure internet connectivity', 'Join 5 minutes early', 'Find a quiet location', 'Keep previous prescriptions nearby'].map((tip) => (
                    <div key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderRadius: '12px', background: 'rgba(247,250,252,0.86)', border: '1px solid rgba(4,53,77,0.08)' }}>
                      <Ico p={ICONS.check} size={12} sw={2.4} color={T.green} />
                      <span style={{ fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </section>

	          <aside className='dt-side' style={{ position: 'sticky', top: '18px', display: 'grid', gap: '12px' }}>
            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '14px', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.3))', display: 'grid', placeItems: 'center' }}>
                  {physicianData.imageUrl ? (
                    <img src={physicianData.imageUrl} alt={physicianData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={22} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Booking Summary</p>
                  <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 800, color: T.navy }}>{physicianData.name}</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                {[
                  ['Consultation', readLabel(service)],
                  ['Selected Date', formatDateLabel(selectedDate)],
                  ['Selected Time', selectedSlot],
                  ['Duration', duration],
                  ['Fee', formatFee(fee)],
                  ['Insurance', insurance],
                  ['Estimated Total', formatFee(fee)],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>

	              <HoverBtn
	                onClick={() => {
	                  if (canContinue) router.push(continueHref)
	                }}
	                base={{
                  width: '100%',
                  minHeight: '46px',
                  borderRadius: '13px',
                  border: 'none',
	                  background: canContinue ? `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)` : 'rgba(4,53,77,0.16)',
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
	                  cursor: canContinue ? 'pointer' : 'not-allowed',
	                  opacity: canContinue ? 1 : 0.65,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(32,181,223,0.28)',
                }}
                on={{ transform: 'translateY(-1px)', boxShadow: '0 8px 18px rgba(32,181,223,0.28)' }}
              >
                Continue
                <Ico p={ICONS.arrowFwd} size={14} sw={2.2} />
              </HoverBtn>

              <Link href={summaryHref} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '10px', color: T.slate2, textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
                <Ico p={ICONS.arrowSm} size={13} sw={2} style={{ transform: 'rotate(180deg)' }} />
                Back
              </Link>
            </section>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '16px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                {['Secure Booking', 'Encrypted Scheduling', 'Instant Confirmation', 'HIPAA-Compliant Platform', 'Verified Physicians'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: T.slate, fontSize: '12px', fontWeight: 600 }}>
                    <Ico p={ICONS.shield} size={12} sw={1.8} color={T.green} />
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}

function DateTimeSelectionPageFallback() {
  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Loading scheduling options</p>
          <h1 style={{ margin: '0 0 8px', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '24px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Preparing your appointment slots</h1>
          <p style={{ margin: 0, fontSize: '14px', color: T.slate, lineHeight: 1.7 }}>We are loading the next available windows for your selected consultation.</p>
        </div>
      </div>
    </main>
  )
}

export default function DateTimeSelectionPage() {
  return (
    <Suspense fallback={<DateTimeSelectionPageFallback />}>
      <DateTimeSelectionPageContent />
    </Suspense>
  )
}
