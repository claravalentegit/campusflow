import { differenceInMinutes } from 'date-fns'
import { isAssignmentDone, remainingMinutes, tasksForAssignment } from './assignments'
import { formatMinutes, parseInstant, parseLocalDay, toLocalDay } from './dates'
import type { Assignment, Course, Preferences, Priority, StudyTask, Weekday } from './types'
import { WEEKDAYS } from './types'

export interface Recommendation {
  kind: 'assignment' | 'task'
  id: string
  title: string
  courseId: string | null
  assignmentId: string | null
  dueAt: string | null
  estimatedMinutes: number | null
  score: number
  reasons: string[]
}

const PRIORITY_POINTS: Record<Priority, number> = { high: 25, medium: 10, low: 0 }

export function availableMinutesOn(prefs: Pick<Preferences, 'availability'>, day: Date): number | null {
  if (!prefs.availability) return null
  return prefs.availability[WEEKDAYS[day.getDay()] as Weekday] ?? null
}

/**
 * Transparent, rule-based ranking of what to work on next.
 *  - Urgency: overdue > due within 24h > 48h > 72h > this week > later > no date.
 *  - The student's own priority.
 *  - Tasks planned for today (or carried over from earlier days).
 *  - Large remaining effort relative to the time left before the deadline.
 *  - Whether it fits the time the student said they have today (only if provided).
 * Assignments with an open checklist are represented by their next unfinished step.
 */
export function recommendNext(
  input: { assignments: Assignment[]; tasks: StudyTask[]; courses: Course[]; prefs: Pick<Preferences, 'availability'> },
  now: Date,
  limit = 3,
): Recommendation[] {
  const activeCourseIds = new Set(input.courses.filter((c) => c.status === 'active' && !c.hidden).map((c) => c.id))
  const available = availableMinutesOn(input.prefs, now)
  const today = toLocalDay(now)
  const items: Recommendation[] = []

  const score = (
    base: Omit<Recommendation, 'score' | 'reasons'>,
    priority: Priority,
    plannedFor: string | null,
    remaining: number,
  ): Recommendation => {
    const reasons: string[] = []
    let s = 0
    const due = parseInstant(base.dueAt)
    if (due) {
      const hours = differenceInMinutes(due, now) / 60
      if (hours < 0) {
        s += 100
        reasons.push('Past its due date')
      } else if (hours <= 24) {
        s += 80
        reasons.push(`Due in ${Math.max(1, Math.round(hours))}h`)
      } else if (hours <= 48) {
        s += 65
        reasons.push('Due within 2 days')
      } else if (hours <= 72) {
        s += 50
        reasons.push('Due within 3 days')
      } else if (hours <= 24 * 7) {
        s += 35
        reasons.push('Due this week')
      } else s += 15
      if (hours > 0 && remaining > 0 && remaining / 60 > hours * 0.2) {
        s += 15
        reasons.push(`${formatMinutes(remaining)} of work left before the deadline`)
      }
    } else s += 5
    s += PRIORITY_POINTS[priority]
    if (priority === 'high') reasons.push('You marked it high priority')
    if (plannedFor === today) {
      s += 25
      reasons.push('Planned for today')
    } else if (plannedFor && plannedFor < today) {
      s += 20
      const d = parseLocalDay(plannedFor)
      reasons.push(`Carried over from ${d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : 'earlier'}`)
    }
    if (available != null && base.estimatedMinutes != null) {
      if (base.estimatedMinutes <= available) {
        s += 5
        reasons.push(`Fits your ${formatMinutes(available)} available today`)
      } else reasons.push(`Longer than your ${formatMinutes(available)} today — start with part of it`)
    }
    return { ...base, score: s, reasons }
  }

  for (const a of input.assignments) {
    if (isAssignmentDone(a) || !activeCourseIds.has(a.courseId)) continue
    const steps = tasksForAssignment(input.tasks, a.id)
    const nextStep = steps.find((t) => !t.done)
    const remaining = remainingMinutes(a, input.tasks)
    if (nextStep) {
      items.push(
        score(
          {
            kind: 'task',
            id: nextStep.id,
            title: nextStep.title,
            courseId: a.courseId,
            assignmentId: a.id,
            dueAt: a.dueAt,
            estimatedMinutes: nextStep.estimatedMinutes,
          },
          a.priority === 'high' || nextStep.priority === 'high' ? 'high' : a.priority,
          nextStep.plannedFor,
          remaining,
        ),
      )
    } else if (steps.length === 0) {
      items.push(
        score(
          {
            kind: 'assignment',
            id: a.id,
            title: a.title,
            courseId: a.courseId,
            assignmentId: a.id,
            dueAt: a.dueAt,
            estimatedMinutes: a.estimatedMinutes,
          },
          a.priority,
          null,
          remaining,
        ),
      )
    }
  }

  for (const t of input.tasks) {
    if (t.done || t.assignmentId) continue
    if (t.courseId && !activeCourseIds.has(t.courseId)) continue
    items.push(
      score(
        {
          kind: 'task',
          id: t.id,
          title: t.title,
          courseId: t.courseId,
          assignmentId: null,
          dueAt: t.dueAt,
          estimatedMinutes: t.estimatedMinutes,
        },
        t.priority,
        t.plannedFor,
        t.estimatedMinutes ?? 0,
      ),
    )
  }

  return items
    .sort((a, b) => b.score - a.score || (parseInstant(a.dueAt)?.getTime() ?? Infinity) - (parseInstant(b.dueAt)?.getTime() ?? Infinity))
    .slice(0, limit)
}
