import { isSameDay } from 'date-fns'
import { isAssignmentDone, isAssignmentOverdue } from './assignments'
import { parseInstant, parseLocalDay } from './dates'
import type { AppData, CalendarEventKind } from './types'

export type CalendarItemKind = 'deadline' | 'session' | 'reminder' | 'task' | CalendarEventKind

export interface CalendarItem {
  key: string
  kind: CalendarItemKind
  title: string
  courseId: string | null
  start: Date
  end: Date | null
  allDay: boolean
  done: boolean
  overdue: boolean
  ref: { type: 'assignment' | 'session' | 'event' | 'reminder' | 'task'; id: string }
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Merge every dated record into one list for the calendar, removing duplicates:
 *  - a calendar event linked to an assignment (Canvas exposes deadlines as calendar events too),
 *  - an event that shares a Canvas id with an assignment,
 *  - an exam/deadline event with the same course, title, and day as an assignment.
 */
export function buildCalendarItems(
  data: Pick<AppData, 'assignments' | 'events' | 'sessions' | 'reminders' | 'tasks'>,
  now: Date,
  options: { courseIds?: Set<string>; includeTasks?: boolean } = {},
): CalendarItem[] {
  const inScope = (courseId: string | null) => !options.courseIds || courseId == null || options.courseIds.has(courseId)
  const items: CalendarItem[] = []
  const assignmentIds = new Set(data.assignments.map((a) => a.id))
  const assignmentCanvasIds = new Set(data.assignments.map((a) => a.canvasId).filter(Boolean))

  for (const a of data.assignments) {
    const due = parseInstant(a.dueAt)
    if (!due || !inScope(a.courseId)) continue
    items.push({
      key: `a:${a.id}`,
      kind: a.type === 'exam' ? 'exam' : 'deadline',
      title: a.title,
      courseId: a.courseId,
      start: due,
      end: null,
      allDay: false,
      done: isAssignmentDone(a),
      overdue: isAssignmentOverdue(a, now),
      ref: { type: 'assignment', id: a.id },
    })
  }
  const assignmentItems = [...items]

  for (const e of data.events) {
    if (!inScope(e.courseId)) continue
    if (e.linkedAssignmentId && assignmentIds.has(e.linkedAssignmentId)) continue
    if (e.canvasId && assignmentCanvasIds.has(e.canvasId)) continue
    const start = parseInstant(e.start)
    if (!start) continue
    const duplicate = assignmentItems.some(
      (a) => a.courseId === e.courseId && isSameDay(a.start, start) && normalize(a.title) === normalize(e.title),
    )
    if (duplicate) continue
    items.push({
      key: `e:${e.id}`,
      kind: e.kind,
      title: e.title,
      courseId: e.courseId,
      start,
      end: parseInstant(e.end),
      allDay: e.allDay,
      done: false,
      overdue: false,
      ref: { type: 'event', id: e.id },
    })
  }

  for (const s of data.sessions) {
    const start = parseInstant(s.start)
    if (!start || !inScope(s.courseId)) continue
    items.push({
      key: `s:${s.id}`,
      kind: 'session',
      title: s.title,
      courseId: s.courseId,
      start,
      end: parseInstant(s.end),
      allDay: false,
      done: s.completed,
      overdue: false,
      ref: { type: 'session', id: s.id },
    })
  }

  for (const r of data.reminders) {
    const at = parseInstant(r.remindAt)
    if (!at || !inScope(r.courseId)) continue
    items.push({
      key: `r:${r.id}`,
      kind: 'reminder',
      title: r.title,
      courseId: r.courseId,
      start: at,
      end: null,
      allDay: false,
      done: r.done,
      overdue: false,
      ref: { type: 'reminder', id: r.id },
    })
  }

  if (options.includeTasks) {
    for (const t of data.tasks) {
      const day = parseLocalDay(t.plannedFor)
      if (!day || !inScope(t.courseId)) continue
      items.push({
        key: `t:${t.id}`,
        kind: 'task',
        title: t.title,
        courseId: t.courseId,
        start: day,
        end: null,
        allDay: true,
        done: t.done,
        overdue: false,
        ref: { type: 'task', id: t.id },
      })
    }
  }

  return items.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
}

export function itemsOnDay(items: CalendarItem[], day: Date): CalendarItem[] {
  return items.filter((i) => isSameDay(i.start, day))
}
