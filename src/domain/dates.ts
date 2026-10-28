import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfWeek,
  format,
  isValid,
  parse,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import type { ISODateTime, LocalDay } from './types'

/** Parse a stored ISO instant. Returns null for missing or malformed values rather than guessing. */
export function parseInstant(value: ISODateTime | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isValid(d) ? d : null
}

export function toInstant(d: Date): ISODateTime {
  return d.toISOString()
}

/** Local calendar day key, "yyyy-MM-dd", in the browser's time zone. */
export function toLocalDay(d: Date): LocalDay {
  return format(d, 'yyyy-MM-dd')
}

/** Parse a "yyyy-MM-dd" key as local midnight. Strict: rejects anything else. */
export function parseLocalDay(day: LocalDay | null | undefined): Date | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const d = parse(day, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : null
}

/**
 * Combine the values of `<input type="date">` and `<input type="time">` into a UTC instant.
 * Both inputs are interpreted in local time; the format is explicit to avoid ambiguous parsing.
 */
export function combineLocalDateTime(day: string, time: string): ISODateTime | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const t = /^\d{2}:\d{2}$/.test(time) ? time : '23:59'
  const d = parse(`${day} ${t}`, 'yyyy-MM-dd HH:mm', new Date())
  return isValid(d) ? d.toISOString() : null
}

/** Split an instant into local date/time input values. */
export function splitLocalDateTime(value: ISODateTime | null): { day: string; time: string } {
  const d = parseInstant(value)
  if (!d) return { day: '', time: '' }
  return { day: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') }
}

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'later' | 'no_date'

export const DUE_BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  tomorrow: 'Due tomorrow',
  this_week: 'Later this week',
  next_week: 'Next week',
  later: 'Later',
  no_date: 'No due date',
}

/**
 * Classify a deadline relative to `now`. "Overdue" means the due instant has passed, even if it is
 * still the same calendar day. "This week" means before the end of the current week.
 */
export function dueBucket(dueAt: ISODateTime | null, now: Date, weekStartsOn: 0 | 1 = 1): DueBucket {
  const due = parseInstant(dueAt)
  if (!due) return 'no_date'
  if (due.getTime() < now.getTime()) return 'overdue'
  const days = differenceInCalendarDays(due, now)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  const weekEnd = endOfWeek(now, { weekStartsOn })
  if (due <= weekEnd) return 'this_week'
  const nextWeekEnd = endOfWeek(addDays(weekEnd, 1), { weekStartsOn })
  if (due <= nextWeekEnd) return 'next_week'
  return 'later'
}

/** Short human label: "Today 11:59 PM", "Tomorrow 9:00 AM", "Fri 5:00 PM", "Nov 12". */
export function formatDue(dueAt: ISODateTime | null, now: Date): string {
  const d = parseInstant(dueAt)
  if (!d) return 'No due date'
  const days = differenceInCalendarDays(d, now)
  const time = format(d, 'h:mm a')
  if (days === 0) return `Today ${time}`
  if (days === 1) return `Tomorrow ${time}`
  if (days === -1) return `Yesterday ${time}`
  if (days > 1 && days < 7) return `${format(d, 'EEE')} ${time}`
  if (d.getFullYear() === now.getFullYear()) return `${format(d, 'MMM d')}, ${time}`
  return format(d, 'MMM d, yyyy')
}

/** Day-only version of formatDue: "Today", "Fri", "Nov 5". */
export function formatDueDay(dueAt: ISODateTime | null, now: Date): string {
  return formatDue(dueAt, now).replace(/,? \d+:\d+ [AP]M$/, '')
}

/** Relative distance: "in 3h", "2d overdue". */
export function formatRelative(dueAt: ISODateTime | null, now: Date): string {
  const d = parseInstant(dueAt)
  if (!d) return ''
  const mins = differenceInMinutes(d, now)
  const abs = Math.abs(mins)
  let span: string
  if (abs < 60) span = `${Math.max(abs, 1)}m`
  else if (abs < 60 * 48) span = `${Math.round(abs / 60)}h`
  else span = `${Math.round(abs / 1440)}d`
  return mins < 0 ? `${span} overdue` : `in ${span}`
}

export function formatMinutes(mins: number | null | undefined): string {
  if (mins == null || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function weekDays(anchor: Date, weekStartsOn: 0 | 1): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn })
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function nextDays(from: Date, count: number): Date[] {
  const start = startOfDay(from)
  return Array.from({ length: count }, (_, i) => addDays(start, i))
}

export function greeting(now: Date): string {
  const h = now.getHours()
  if (h < 5) return 'Working late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
