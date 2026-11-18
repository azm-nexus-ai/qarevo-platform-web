// How a booking will be paid for, decided from the patient's own saved
// insurance, never from the doctor's list of accepted billing options.
// Saved details are patient-reported and unverified; they only choose the route.

export type FundingRoute = 'GKV' | 'PKV' | 'SELF_PAY'

export type BookingFunding = {
  route: FundingRoute
  /** Value the Clinical Workflow Service stores on the episode. */
  episodeInsuranceType: 'statutory' | 'private' | 'self_pay'
  insurer: string
  /** True when no usable insurer is on file, so self-pay must be confirmed. */
  needsSelfPayConfirmation: boolean
  label: string
}

type SavedInsurance = { insurance_type?: unknown; insurance_provider_name?: unknown } | null | undefined

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export function bookingFunding(insurance: SavedInsurance): BookingFunding {
  const type = text(insurance?.insurance_type).toUpperCase().replace(/[\s-]/g, '_')
  const insurer = text(insurance?.insurance_provider_name)
  if (type === 'GKV' && insurer) {
    return { route: 'GKV', episodeInsuranceType: 'statutory', insurer, needsSelfPayConfirmation: false, label: 'Statutory insurance (GKV)' }
  }
  if (type === 'PKV' && insurer) {
    return { route: 'PKV', episodeInsuranceType: 'private', insurer, needsSelfPayConfirmation: false, label: 'Private insurance (PKV)' }
  }
  return { route: 'SELF_PAY', episodeInsuranceType: 'self_pay', insurer: '', needsSelfPayConfirmation: true, label: 'Self-pay' }
}

/** Plain-language pricing basis; never invents an amount the practice has not published. */
export function selfPayPricingBasis(consultationFee: unknown): string {
  const fee = typeof consultationFee === 'number' && Number.isFinite(consultationFee) && consultationFee > 0 ? consultationFee : 0
  const listed = fee
    ? `The practice lists this consultation at ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(fee)}.`
    : 'The practice has not yet published a price for this consultation; you will see the amount before you are charged.'
  return `${listed} Private fees for doctors in Germany follow the official fee schedule (GOÄ). Nothing is charged through Qarevo when you book.`
}
