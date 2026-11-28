/** An appointment as an iCalendar (.ics, RFC 5545) event the patient can add to any calendar app. */
export type CalendarEvent = { uid: string; start: string; end: string; title: string; description: string; url?: string; now?: Date }

const stamp = (value: Date) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
/** Text values escape backslash, semicolon, comma and newlines. */
const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
/** Lines longer than 75 octets fold with CRLF + space. */
function fold(line: string) {
  const out: string[] = []
  let rest = line
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 75
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 75) cut--
    out.push(rest.slice(0, cut)); rest = ' ' + rest.slice(cut)
  }
  out.push(rest)
  return out.join('\r\n')
}

export function calendarFile(event: CalendarEvent): string {
  const start = new Date(event.start), end = new Date(event.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Invalid appointment time')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Qarevo Health//Patient portal//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${text(event.uid)}@qarevo.health`, `DTSTAMP:${stamp(event.now ?? new Date())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${text(event.title)}`, `DESCRIPTION:${text(event.description)}`,
    ...(event.url ? [`URL:${event.url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT30M', `DESCRIPTION:${text(event.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}
