/** datetime-local inputs use the clinician's browser timezone. */
export function orderDateFromIso(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const part = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`
}

export function orderDateToIso(value?: string, original?: string | null) {
  if (!value) return ''
  // Preserve seconds and the later occurrence of a repeated DST hour if unchanged.
  if (original && value === orderDateFromIso(original)) return new Date(original).toISOString()
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || orderDateFromIso(date.toISOString()) !== value) {
    throw new Error('Enter a valid local date and time. This time may not exist because the clocks change.')
  }
  // Do not silently choose the first occurrence of an ambiguous autumn hour.
  for (let offset = -180; offset <= 180; offset += 15) {
    if (offset !== 0 && orderDateFromIso(new Date(date.getTime() + offset * 60_000).toISOString()) === value) {
      throw new Error('This local time occurs twice because the clocks change. Choose an unambiguous time or leave the existing scheduled time unchanged.')
    }
  }
  return date.toISOString()
}
