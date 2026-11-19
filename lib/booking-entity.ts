/** Treating-entity booking options for one clinician, for the signed-in patient's coverage. */
import { object, uuid } from './practice'

export type BookingEntity = {
  id: string; name: string; entity_type: 'PRACTICE' | 'INDEPENDENT'; city: string | null; postcode: string | null; currency: string
  public_insurance_eligible: boolean; coverage_type: string; self_pay_fee_minor?: number; self_pay_fee_basis?: string; self_pay_fee_is_reference?: boolean
}
export type BookingOptions = { verification_required: boolean; coverage_type: 'GKV' | 'PKV' | 'SELF_PAY'; entities: BookingEntity[] }

const text = (value: unknown, max = 200) => typeof value === 'string' && value.length <= max

function entity(value: unknown): BookingEntity | null {
  if (!object(value) || !uuid(value.id) || !text(value.name, 160) || !['PRACTICE', 'INDEPENDENT'].includes(String(value.entity_type)) ||
    !(value.city === null || text(value.city, 100)) || !(value.postcode === null || text(value.postcode, 20)) || !text(value.currency, 3) ||
    typeof value.public_insurance_eligible !== 'boolean') return null
  if (value.coverage_type === 'SELF_PAY' && (typeof value.self_pay_fee_minor !== 'number' || !Number.isSafeInteger(value.self_pay_fee_minor) || value.self_pay_fee_minor <= 0)) return null
  return value as unknown as BookingEntity
}

export function bookingOptions(value: unknown): BookingOptions | null {
  if (!object(value) || typeof value.verification_required !== 'boolean' || !['GKV', 'PKV', 'SELF_PAY'].includes(String(value.coverage_type)) || !Array.isArray(value.entities) || value.entities.length > 50) return null
  const entities = value.entities.map(entity)
  return entities.every(Boolean) ? { verification_required: value.verification_required, coverage_type: value.coverage_type as BookingOptions['coverage_type'], entities: entities as BookingEntity[] } : null
}

export const formatMoney = (minor: number, currency: string) => new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(minor / 100)
