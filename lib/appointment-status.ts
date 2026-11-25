/** Appointment status codes from the API mapped to `appointmentStatus` message keys. Unknown codes are shown as sent. */
const KEYS: Record<string, string> = {
  BOOKED: 'booked', SCHEDULED: 'scheduled', CONFIRMED: 'confirmed', PENDING: 'pending', PENDING_PAYMENT: 'pendingPayment',
  IN_PROGRESS: 'inProgress', COMPLETED: 'completed', CANCELLED: 'cancelled', CANCELED: 'cancelled', NO_SHOW: 'noShow',
  RESCHEDULED: 'rescheduled', EXPIRED: 'expired',
}
export function appointmentStatusKey(status: string | null | undefined): string | null {
  return KEYS[(status ?? '').trim().toUpperCase()] ?? null
}
