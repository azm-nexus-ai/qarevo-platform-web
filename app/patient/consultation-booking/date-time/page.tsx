'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { T, Sh, Glass, PAGE_BG } from '@/lib/tokens'
import { buildBookingQueryParams, getBookingPhysician } from '@/lib/booking'
import { PHYSICIANS } from '@/constants/physicians'
import { ICONS } from '@/constants/icons'
import Ico from '@/components/ui/Ico'
import HoverBtn from '@/components/buttons/HoverBtn'

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

function formatShortDate(date: Date) {
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getMonthGrid(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cells: Array<{ date: Date; inMonth: boolean }> = []

  for (let i = 0; i < startOffset; i += 1) {
    const previousMonth = new Date(firstDay)
    previousMonth.setDate(firstDay.getDate() - (startOffset - i))
    cells.push({ date: previousMonth, inMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(date.getFullYear(), date.getMonth(), day), inMonth: true })
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]?.date ?? new Date(date)
    const next = new Date(last)
    next.setDate(last.getDate() + 1)
    cells.push({ date: next, inMonth: false })
  }

  return cells
}

type DayStatus = 'available' | 'limited' | 'booked' | 'selected'

function getAvailabilityStatus(date: Date): DayStatus {
  const today = new Date()
  const tomorrow = addDays(today, 1)
  const key = formatDateKey(date)
  const todayKey = formatDateKey(today)
  const tomorrowKey = formatDateKey(tomorrow)
  const nextWeekend = addDays(today, 5)
  const nextWeekendKey = formatDateKey(nextWeekend)

  if (key === todayKey) return 'limited'
  if (key === tomorrowKey) return 'available'
  if (key === nextWeekendKey) return 'available'
  if (date.getDate() % 4 === 0) return 'booked'
  if (date.getDate() % 3 === 0) return 'limited'
  return 'available'
}

function DateTimeSelectionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physicianId = searchParams.get('physicianId') ?? ''
  const physician = PHYSICIANS.find((item) => item.id === physicianId)
  const physicianData = useMemo(() => getBookingPhysician(searchParams, physician), [searchParams, physician])
  const service = searchParams.get('service') ?? 'video'
  const fee = Number(searchParams.get('fee') ?? physician?.consultationFee ?? 140)
  const duration = searchParams.get('duration') ?? '30 min'
  const insurance = searchParams.get('insurance') ?? 'Axa'
  const initialDateParam = searchParams.get('date')
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
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const [selectedSlot, setSelectedSlot] = useState(searchParams.get('slot') ?? '09:00 AM')
  const [notes, setNotes] = useState(searchParams.get('notes') ?? '')
  const preservedParams = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    return next.toString()
  }, [searchParams, physicianData, service])

  const summaryHref = physicianData.id
    ? `/patient/physicians/${physicianData.id}${preservedParams ? `?${preservedParams}` : ''}`
    : '/patient/find-doctor'

  const monthGrid = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth])
  const selectedDateKey = formatDateKey(selectedDate)
  const quickShortcuts = [
    { label: 'Earliest Available', date: addDays(new Date(), 0) },
    { label: 'Today', date: new Date() },
    { label: 'Tomorrow', date: addDays(new Date(), 1) },
    { label: 'This Weekend', date: addDays(new Date(), 5) },
    { label: 'Next Available Morning', date: addDays(new Date(), 0) },
    { label: 'Next Available Afternoon', date: addDays(new Date(), 1) },
    { label: 'Next Available Evening', date: addDays(new Date(), 2) },
  ]

  const slotGroups = [
    {
      label: 'Morning',
      slots: ['09:00 AM', '09:30 AM', '10:00 AM', '11:30 AM'],
    },
    {
      label: 'Afternoon',
      slots: ['02:00 PM', '03:30 PM', '04:00 PM'],
    },
    {
      label: 'Evening',
      slots: ['05:00 PM', '06:00 PM', '07:30 PM'],
    },
  ]

  const continueHref = useMemo(() => {
    const next = buildBookingQueryParams(searchParams, physicianData, service)
    next.set('date', formatDateLabel(selectedDate))
    next.set('slot', selectedSlot)
    next.set('notes', notes)
    return `/patient/consultation-booking/review?${next.toString()}`
  }, [notes, searchParams, physicianData, selectedDate, selectedSlot, service])

  const appointmentEnd = useMemo(() => {
    const parts = duration.match(/(\d+)/)
    const minutes = parts ? Number(parts[1]) : 30
    const start = new Date(`2026-01-01T09:00:00`)
    start.setMinutes(start.getMinutes() + minutes)
    return `${start.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`
  }, [duration])

  const primaryStatus = getAvailabilityStatus(selectedDate)
  const availableTimes = slotGroups.flatMap((group) => group.slots.filter((slot) => {
    if (primaryStatus === 'booked') return false
    if (primaryStatus === 'limited' && ['09:00 AM', '10:00 AM', '02:00 PM', '05:00 PM'].includes(slot)) return false
    return true
  }))

  return (
    <main style={{ minHeight: '100vh', background: PAGE_BG }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px 40px' }}>
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: '280px minmax(0, 1fr) 340px', alignItems: 'start' }}>
          <aside style={{ display: 'grid', gap: '12px' }}>
            <section style={{ ...Glass.nav, borderRadius: '20px', border: '1px solid rgba(255,255,255,0.84)', padding: '18px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Booking Progress</p>
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
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: T.slate, lineHeight: 1.6 }}>{physicianData.specialty} · {physicianData.hospital}</p>
              <div style={{ display: 'grid', gap: '7px', fontSize: '12px', color: T.slate2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Consultation</span><strong style={{ color: T.navy }}>{readLabel(service)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Duration</span><strong style={{ color: T.navy }}>{duration}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}><span>Fee</span><strong style={{ color: T.navy }}>${fee}</strong></div>
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
                  <Ico p={ICONS.arrowSm} size={14} sw={1.8} color={T.blue} />
                  Back to Consultation Options
                </Link>
              </div>
            </header>

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {quickShortcuts.map((shortcut) => {
                  const active = selectedDateKey === formatDateKey(shortcut.date)
                  return (
                    <button
                      key={shortcut.label}
                      type='button'
                      onClick={() => {
                        setSelectedDate(shortcut.date)
                        setVisibleMonth(new Date(shortcut.date.getFullYear(), shortcut.date.getMonth(), 1))
                      }}
                      style={{ borderRadius: '999px', border: active ? '1px solid rgba(32,181,223,0.34)' : '1px solid rgba(4,53,77,0.1)', background: active ? 'rgba(32,181,223,0.1)' : 'rgba(255,255,255,0.8)', color: active ? T.blue : T.slate, fontSize: '12px', fontWeight: 700, padding: '8px 12px', cursor: 'pointer' }}
                    >
                      {shortcut.label}
                    </button>
                  )
                })}
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Availability Calendar</p>
                    <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>{visibleMonth.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h2>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type='button' onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} style={{ borderRadius: '10px', border: '1px solid rgba(4,53,77,0.1)', background: 'rgba(255,255,255,0.9)', width: '38px', height: '38px', cursor: 'pointer', display: 'grid', placeItems: 'center' }} aria-label='Previous month'>←</button>
                    <button type='button' onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} style={{ borderRadius: '10px', border: '1px solid rgba(4,53,77,0.1)', background: 'rgba(255,255,255,0.9)', width: '38px', height: '38px', cursor: 'pointer', display: 'grid', placeItems: 'center' }} aria-label='Next month'>→</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' }}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                    <div key={`day-${index}`} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: T.slate2, textTransform: 'uppercase' }}>{label}</div>
                  ))}
                  {monthGrid.map((cell) => {
                    const status = getAvailabilityStatus(cell.date)
                    const isSelected = formatDateKey(cell.date) === selectedDateKey
                    const disabled = status === 'booked'
                    const base = {
                      borderRadius: '12px',
                      minHeight: '44px',
                      border: isSelected ? '1px solid rgba(32,181,223,0.34)' : '1px solid rgba(4,53,77,0.08)',
                      background: isSelected ? 'linear-gradient(135deg, rgba(232,248,252,0.95) 0%, rgba(255,255,255,0.95) 100%)' : 'rgba(255,255,255,0.8)',
                      color: cell.inMonth ? T.navy : T.slate2,
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: cell.inMonth ? 1 : 0.7,
                      position: 'relative' as const,
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: isSelected ? Sh.glow : 'none',
                    }
                    return (
                      <button
                        key={formatDateKey(cell.date)}
                        type='button'
                        disabled={disabled}
                        onClick={() => {
                          setSelectedDate(cell.date)
                          setVisibleMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1))
                        }}
                        style={base}
                      >
                        <span>{cell.date.getDate()}</span>
                        {!disabled && (
                          <span style={{ position: 'absolute', bottom: '6px', width: '6px', height: '6px', borderRadius: '50%', background: status === 'limited' ? T.amber : T.green }} />
                        )}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', paddingTop: '2px' }}>
                  {[
                    ['Available', T.green],
                    ['Limited', T.amber],
                    ['Fully Booked', T.slate2],
                    ['Selected', T.blue],
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
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Choose a premium appointment window</h2>
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(165,224,218,0.24)', color: T.teal, fontSize: '12px', fontWeight: 700 }}>Timezone: Africa/Lagos (GMT+1)</div>
              </div>

              <div style={{ display: 'grid', gap: '12px' }}>
                {slotGroups.map((group) => (
                  <div key={group.label}>
                    <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{group.label}</p>
                    <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      {group.slots.map((slot) => {
                        const disabled = !availableTimes.includes(slot)
                        const active = selectedSlot === slot
                        return (
                          <button
                            key={slot}
                            type='button'
                            disabled={disabled}
                            onClick={() => setSelectedSlot(slot)}
                            style={{ textAlign: 'left', borderRadius: '14px', border: active ? '1px solid rgba(32,181,223,0.34)' : '1px solid rgba(4,53,77,0.08)', background: active ? 'linear-gradient(135deg, rgba(232,248,252,0.95) 0%, rgba(255,255,255,0.95) 100%)' : disabled ? 'rgba(247,250,252,0.82)' : 'rgba(255,255,255,0.9)', color: disabled ? T.slate2 : T.navy, padding: '12px 13px', cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: active ? Sh.glow : 'none', transition: 'transform 0.16s ease, box-shadow 0.16s ease' }}
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

            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.card, padding: '18px' }}>
              <div style={{ display: 'grid', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Appointment Details</p>
                    <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Everything needed for a smooth visit</h2>
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: '999px', background: 'rgba(32,181,223,0.08)', color: T.blue, fontSize: '12px', fontWeight: 700 }}>Automatically detected timezone</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                  {[
                    ['Consultation Type', readLabel(service)],
                    ['Appointment Duration', duration],
                    ['Estimated End Time', appointmentEnd],
                    ['Consultation Fee', `$${fee}`],
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
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Patient Notes</p>
                  <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 800, color: T.navy, letterSpacing: '-0.03em' }}>Notes for your physician</h2>
                </div>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={5}
                  placeholder='Describe your symptoms, concerns, or anything you would like your physician to know before the consultation.'
                  style={{ width: '100%', borderRadius: '14px', border: '1px solid rgba(4,53,77,0.12)', padding: '12px 13px', fontFamily: 'inherit', fontSize: '13px', color: T.navy, resize: 'vertical', outline: 'none' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: T.slate2 }}>
                  <span>Optional and private to your booking.</span>
                  <span>{notes.length}/500</span>
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

          <aside style={{ position: 'sticky', top: '18px', display: 'grid', gap: '12px' }}>
            <section style={{ background: 'rgba(255,255,255,0.92)', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.94)', boxShadow: Sh.float, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '50px', height: '50px', borderRadius: '14px', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(32,181,223,0.22), rgba(52,140,234,0.3))', display: 'grid', placeItems: 'center' }}>
                  {physician ? (
                    <img src={physician.imageUrl} alt={physician.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Ico p={ICONS.steth} size={22} sw={1.5} color={T.navy} />
                  )}
                </div>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: T.slate2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Booking Summary</p>
                  <h3 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '16px', fontWeight: 800, color: T.navy }}>{physician?.name ?? 'Selected physician'}</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                {[
                  ['Consultation', readLabel(service)],
                  ['Selected Date', formatDateLabel(selectedDate)],
                  ['Selected Time', selectedSlot],
                  ['Duration', duration],
                  ['Fee', `$${fee}`],
                  ['Insurance', insurance],
                  ['Estimated Total', `$${fee}`],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(4,53,77,0.025)', border: '1px solid rgba(4,53,77,0.06)' }}>
                    <span style={{ fontSize: '12px', color: T.slate2 }}>{label}</span>
                    <span style={{ fontSize: '12px', color: T.navy, fontWeight: 700, textAlign: 'right' }}>{value}</span>
                  </div>
                ))}
              </div>

              <HoverBtn
                onClick={() => router.push(continueHref)}
                base={{
                  width: '100%',
                  minHeight: '46px',
                  borderRadius: '13px',
                  border: 'none',
                  background: `linear-gradient(135deg, ${T.blue} 0%, #348CEA 100%)`,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.015em',
                  cursor: 'pointer',
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
