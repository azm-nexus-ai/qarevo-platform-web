import { MEDICATION_FIELDS, DAYPARTS, medicationInstruction, careInstruction, scheduleTime } from './clinical-instructions'
import { consultationSummaryId } from './patient-consultation-summary'

export type AuthoringKind = 'medication' | 'care-plan'
export type AuthoringForm = { values: Record<string, string>; times: string[]; clockTimes: string }
export function emptyAuthoringForm(kind: AuthoringKind): AuthoringForm {
  return { values: kind === 'medication' ? Object.fromEntries([...MEDICATION_FIELDS.map(field => [field.key, '']), ['episode_id', ''], ['status', 'Active']]) : { title: '', status: 'Active', progress: '', description: '', episode_id: '' }, times: [], clockTimes: '' }
}
export function savedAuthoringForm(kind: AuthoringKind, value: unknown): AuthoringForm {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const episodeId = typeof raw.episode_id === 'string' ? raw.episode_id : ''
  if (kind === 'medication') {
    const record = medicationInstruction(value)
    return { values: Object.fromEntries([...MEDICATION_FIELDS.map(field => [field.key, record[field.key] ?? '']), ['episode_id', episodeId], ['status', record.status ?? '']]), times: record.times.filter(time => DAYPARTS.some(part => part === time)), clockTimes: record.times.filter(time => !DAYPARTS.some(part => part === time)).join(', ') }
  }
  const record = careInstruction(value)
  return { values: { title: record.title ?? '', status: record.status ?? '', description: record.description ?? '', progress: record.progress === null ? '' : String(record.progress), episode_id: episodeId }, times: [], clockTimes: '' }
}
export function authoringChanges(kind: AuthoringKind, form: AuthoringForm, baseline: AuthoringForm, editing: boolean) {
  const errors: Record<string, string> = {}, payload: Record<string, unknown> = {}
  const fields = kind === 'medication' ? [...MEDICATION_FIELDS, { key: 'status', label: 'Clinical status', required: true, max: 80 }] : [{ key: 'title', label: 'Title', required: true, max: 220 }, { key: 'status', label: 'Clinical status', required: true, max: 80 }, { key: 'description', label: 'Description', max: 10000 }]
  for (const field of fields) {
    if (kind === 'medication' && !editing && field.key === 'status') continue
    const value = (form.values[field.key] ?? '').trim(), changed = form.values[field.key] !== baseline.values[field.key]
    if (editing && !changed) continue
    if ('required' in field && field.required && !value) errors[field.key] = `${field.label} is required.`
    else if (value.length > field.max) errors[field.key] = `${field.label} must be ${field.max.toLocaleString('en')} characters or fewer.`
    payload[field.key] = value
  }
  const episode = form.values.episode_id.trim()
  if (!editing) {
    if (episode && !consultationSummaryId(episode)) errors.episode_id = 'Enter a valid episode UUID or leave this optional field blank.'
    payload.episode_id = episode || null
  }
  if (kind === 'medication' && (!editing || JSON.stringify(form.times) !== JSON.stringify(baseline.times) || form.clockTimes !== baseline.clockTimes)) {
    const times = [...form.times, ...(form.clockTimes.trim() ? form.clockTimes.split(',').map(time => time.trim()) : [])]
    if (times.length > 24 || times.some(time => !scheduleTime(time)) || new Set(times).size !== times.length) errors.times = 'Use up to 24 unique dayparts or 24-hour HH:MM times. Separate clock times with commas.'
    payload.times = times
  }
  if (kind === 'care-plan' && (!editing || form.values.progress !== baseline.values.progress)) {
    const value = form.values.progress.trim()
    if (value && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 100)) errors.progress = 'Progress must be a whole number from 0 to 100, or blank when not recorded.'
    payload.progress = value ? Number(value) : null
  }
  return { errors, payload }
}
