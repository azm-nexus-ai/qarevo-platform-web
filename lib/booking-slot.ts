import type { PatientBookingSlot } from './api'

/** Carry the server's exact instants through booking; never parse a clock label in the browser's timezone. */
export function resolveBookingSlot(slots: PatientBookingSlot[], label: string, startAt?: string | null) {
  const matches = slots.filter(slot => slot.label === label && (!startAt || slot.start_at === startAt))
  if (matches.length !== 1) throw new Error('This appointment time is no longer available. Go back and choose another time.')
  const slot = matches[0]
  const explicitOffset = /(?:Z|[+-]\d{2}:\d{2})$/
  if (!explicitOffset.test(slot.start_at) || !explicitOffset.test(slot.end_at)
    || !Number.isFinite(Date.parse(slot.start_at)) || !Number.isFinite(Date.parse(slot.end_at))
    || Date.parse(slot.end_at) <= Date.parse(slot.start_at)) {
    throw new Error('The appointment time could not be verified. Please choose another time.')
  }
  return slot
}
