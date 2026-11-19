/** Settlement contracts: statements, lines and fee schedules (amounts in minor units or ten-thousandths). */
import { object, uuid } from './practice'

export type SettlementLine = { consultation_id: string; completed_at: string; coverage_type: string; segment: 'GKV_KNOWN' | 'GKV_UNKNOWN' | 'PRIVATE'; band: number; joint_seconds: number; schedule_key: string; fee_e4: number; tariff_e4_per_minute: string }
export type Statement = {
  id: string; practice_id: string; practice_name?: string | null; period: string; currency: string; status: 'DRAFT' | 'ISSUED'; line_count: number
  net_e4: number; net_minor: number; vat_rate_percent: string; vat_minor: number; gross_minor: number; invoice_number: string | null; issued_at: string | null; version: number
  lines?: SettlementLine[]
}
export const SEGMENT_LABELS: Record<string, string> = { GKV_KNOWN: 'GKV, known patient', GKV_UNKNOWN: 'GKV, new patient', PRIVATE: 'PKV / self-pay' }

const int = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
function line(value: unknown): SettlementLine | null {
  return object(value) && uuid(value.consultation_id) && typeof value.completed_at === 'string' && ['GKV_KNOWN', 'GKV_UNKNOWN', 'PRIVATE'].includes(String(value.segment)) &&
    int(value.band) && int(value.joint_seconds) && typeof value.schedule_key === 'string' && int(value.fee_e4) ? value as unknown as SettlementLine : null
}
export function statement(value: unknown): Statement | null {
  if (!object(value) || !uuid(value.id) || !uuid(value.practice_id) || typeof value.period !== 'string' || !/^\d{4}-\d{2}$/.test(value.period) ||
    !['DRAFT', 'ISSUED'].includes(String(value.status)) || !int(value.line_count) || !int(value.net_e4) || !int(value.net_minor) || !int(value.vat_minor) ||
    !int(value.gross_minor) || typeof value.currency !== 'string' || !int(value.version)) return null
  if (value.lines !== undefined) {
    if (!Array.isArray(value.lines)) return null
    const lines = value.lines.map(line)
    if (!lines.every(Boolean)) return null
    return { ...(value as unknown as Statement), lines: lines as SettlementLine[] }
  }
  return value as unknown as Statement
}
export function statements(value: unknown): Statement[] | null {
  if (!object(value) || !Array.isArray(value.statements)) return null
  const rows = value.statements.map(statement)
  return rows.every(Boolean) ? rows as Statement[] : null
}
export const money = (minor: number, currency: string) => new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(minor / 100)
export const preciseMoney = (e4: number, currency: string) => new Intl.NumberFormat('de-DE', { style: 'currency', currency, minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(e4 / 10000)
export const previousMonth = () => { const now = new Date(); const date = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
