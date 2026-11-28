/** Patient-facing doctor card facts that the API sends in a machine-readable form. */
export type DoctorSlotFields = { nextAvailable?: string; nextAvailableAt?: string | null; services?: { price: number }[] }

/**
 * The earliest bookable slot in the patient's language and local time.
 * `none` is used when the API found no free slot; older API responses without
 * `nextAvailableAt` keep their preformatted label.
 */
export function nextSlotText(doctor: DoctorSlotFields, locale: string, none: string, timeZone?: string): string {
  if (doctor.nextAvailableAt) {
    const start = new Date(doctor.nextAvailableAt)
    if (!Number.isNaN(start.getTime())) {
      return new Intl.DateTimeFormat(locale.startsWith('de') ? 'de-DE' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone }).format(start)
    }
  }
  if (doctor.nextAvailableAt === null || !doctor.nextAvailable || doctor.nextAvailable === 'Not available') return none
  return doctor.nextAvailable
}

/** The lowest published offer price in whole euros, or null when no offer has a price. */
export function lowestOfferPrice(doctor: DoctorSlotFields): number | null {
  const prices = (doctor.services ?? []).map(service => service.price).filter(price => Number.isFinite(price) && price > 0)
  return prices.length ? Math.min(...prices) : null
}

export function formatEuro(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale.startsWith('de') ? 'de-DE' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount)
}
