import { isAssignmentDone, remainingMinutes, tasksForAssignment } from './assignments'
import { nextDays, parseInstant, toLocalDay } from './dates'
import { availableMinutesOn } from './recommend'
import type { Assignment, Preferences, StudySession, StudyTask } from './types'

export interface DayWorkload {
  day: string
  date: Date
  /** Open tasks planned for the day plus planned study sessions. */
  scheduledMinutes: number
  /** Estimated work for assignments due that day that have no scheduled steps — likely last-minute work. */
  unscheduledDueMinutes: number
  deadlines: number
  capacityMinutes: number
  overloaded: boolean
}

export function computeWorkload(
  input: {
    assignments: Assignment[]
    tasks: StudyTask[]
    sessions: StudySession[]
    prefs: Pick<Preferences, 'availability' | 'overloadThresholdMinutes'>
    courseIds?: Set<string>
  },
  from: Date,
  days: number,
): DayWorkload[] {
  const inScope = (courseId: string | null) => !input.courseIds || courseId == null || input.courseIds.has(courseId)
  const result = nextDays(from, days).map<DayWorkload>((date) => {
    const available = availableMinutesOn(input.prefs, date)
    return {
      day: toLocalDay(date),
      date,
      scheduledMinutes: 0,
      unscheduledDueMinutes: 0,
      deadlines: 0,
      capacityMinutes: available ?? input.prefs.overloadThresholdMinutes,
      overloaded: false,
    }
  })
  const byDay = new Map(result.map((d) => [d.day, d]))

  for (const t of input.tasks) {
    if (t.done || !t.plannedFor || !inScope(t.courseId)) continue
    const slot = byDay.get(t.plannedFor)
    if (slot) slot.scheduledMinutes += t.estimatedMinutes ?? 0
  }
  for (const s of input.sessions) {
    if (s.logged || s.completed || !inScope(s.courseId)) continue
    const start = parseInstant(s.start)
    const end = parseInstant(s.end)
    if (!start || !end) continue
    // Sessions tied to a task are already counted through the task.
    if (s.taskId && input.tasks.some((t) => t.id === s.taskId && t.plannedFor)) continue
    const slot = byDay.get(toLocalDay(start))
    if (slot) slot.scheduledMinutes += Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
  }
  for (const a of input.assignments) {
    if (isAssignmentDone(a) || !inScope(a.courseId)) continue
    const due = parseInstant(a.dueAt)
    if (!due) continue
    const slot = byDay.get(toLocalDay(due))
    if (!slot) continue
    slot.deadlines += 1
    const steps = tasksForAssignment(input.tasks, a.id)
    if (!steps.some((s) => !s.done && s.plannedFor)) slot.unscheduledDueMinutes += remainingMinutes(a, input.tasks)
  }
  for (const d of result) {
    d.overloaded = d.scheduledMinutes + d.unscheduledDueMinutes > d.capacityMinutes
  }
  return result
}
