import { addDays, compareAsc } from 'date-fns'
import { isAssignmentDone, isAssignmentOverdue } from './assignments'
import { parseInstant, toLocalDay } from './dates'
import type { Assignment, ID, LocalDay } from './types'

/**
 * The Rescue plan: a rule-based catch-up plan for late work.
 *
 * - It appears when 2 or more assignments are late.
 * - Smallest first, so the student gets quick wins. Ties go to the one that has been late longest.
 * - Work is spread over the coming days with a daily time budget; big work is split across days.
 */

export const RESCUE_MIN_LATE = 2
export const RESCUE_DAILY_MINUTES = 120
export const RESCUE_BONUS = 50
const DEFAULT_MINUTES = 60

export interface RescueStep {
  assignmentId: ID
  title: string
  courseId: ID
  minutes: number
  /** Days the remaining work is planned on, in order. Empty when done. */
  days: LocalDay[]
  done: boolean
}

export function lateOpen(assignments: Assignment[], now: Date): Assignment[] {
  return assignments.filter((a) => !isAssignmentDone(a) && isAssignmentOverdue(a, now))
}

/** Order for a new plan: smallest first, then longest late. */
export function rescueOrder(late: Assignment[]): ID[] {
  return [...late]
    .sort((x, y) => (x.estimatedMinutes ?? DEFAULT_MINUTES) - (y.estimatedMinutes ?? DEFAULT_MINUTES) || compareAsc(parseInstant(x.dueAt) ?? 0, parseInstant(y.dueAt) ?? 0))
    .map((a) => a.id)
}

/** The plan's steps in their fixed order, with the open ones spread over the days from today. */
export function rescueSteps(ids: ID[], assignments: Assignment[], now: Date, dailyMinutes = RESCUE_DAILY_MINUTES): RescueStep[] {
  const byId = new Map(assignments.map((a) => [a.id, a]))
  let day = 0
  let left = dailyMinutes
  return ids.flatMap((id) => {
    const a = byId.get(id)
    if (!a) return []
    const done = isAssignmentDone(a)
    const minutes = a.estimatedMinutes ?? DEFAULT_MINUTES
    const days: LocalDay[] = []
    if (!done) {
      let need = minutes
      while (need > 0) {
        if (left <= 0) {
          day++
          left = dailyMinutes
        }
        const take = Math.min(need, left)
        const key = toLocalDay(addDays(now, day))
        if (days[days.length - 1] !== key) days.push(key)
        need -= take
        left -= take
      }
    }
    return [{ assignmentId: a.id, title: a.title, courseId: a.courseId, minutes, days, done }]
  })
}
