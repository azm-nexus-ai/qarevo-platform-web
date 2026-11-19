'use client'
import { useFormatter } from 'next-intl'
import { TIME_ZONE } from './locale'

/** Money from integer minor units (cents) or ten-thousandths, in the active locale's format. */
export function useMoney() {
  const format = useFormatter()
  return {
    minor: (minor: number, currency: string) => format.number(minor / 100, { style: 'currency', currency }),
    e4: (e4: number, currency: string) => format.number(e4 / 10000, { style: 'currency', currency, minimumFractionDigits: 4, maximumFractionDigits: 4 }),
  }
}

/** Dates and times shown in Europe/Berlin, whatever the browser's zone. */
export function useDates() {
  const format = useFormatter()
  const parse = (value: string | Date) => typeof value === 'string' ? new Date(value) : value
  return {
    date: (value: string | Date) => format.dateTime(parse(value), { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' }),
    dateTime: (value: string | Date) => format.dateTime(parse(value), { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }
}
