import { parseInstant } from './dates'
import type { Assignment, AssignmentStatus, Priority, StudyTask } from './types'

const OFFICIALLY_SUBMITTED = new Set(['submitted', 'graded', 'pending_review'])

/** True when the student no longer needs to work on the assignment. */
export function isAssignmentDone(a: Assignment): boolean {
  if (a.status === 'completed' || a.status === 'submitted') return true
  return a.canvasSubmission != null && OFFICIALLY_SUBMITTED.has(a.canvasSubmission.state)
}

/** Canvas types that are turned in somewhere else (on paper, in class), so Canvas never shows a submission. */
const OFFLINE_TYPES = new Set(['none', 'on_paper', 'not_graded', 'wiki_page'])

/**
 * A real Canvas assignment that has to be turned in on Canvas: it can only be checked off once Canvas
 * shows it as submitted. Demo and hand-added work, and paper or in-class work, can be checked off anytime.
 */
export function needsCanvasSubmission(a: Assignment): boolean {
  if (a.source !== 'canvas') return false
  const types = a.canvasSubmissionTypes
  if (types && types.length && types.every((t) => OFFLINE_TYPES.has(t))) return false
  return true
}

/** Can the student check this off now? Not if Canvas still needs it turned in. */
export function canCheckOff(a: Assignment): boolean {
  return isAssignmentDone(a) || !needsCanvasSubmission(a)
}

export function isOverdue(a: Pick<Assignment, 'dueAt'>, done: boolean, now: Date): boolean {
  const due = parseInstant(a.dueAt)
  return !done && due != null && due.getTime() < now.getTime()
}

export function isAssignmentOverdue(a: Assignment, now: Date): boolean {
  return isOverdue(a, isAssignmentDone(a), now)
}

export function tasksForAssignment(tasks: StudyTask[], assignmentId: string): StudyTask[] {
  return tasks.filter((t) => t.assignmentId === assignmentId).sort((a, b) => a.position - b.position)
}

/** Minutes of work left: open checklist estimates if a breakdown exists, else the assignment estimate. */
export function remainingMinutes(a: Assignment, tasks: StudyTask[]): number {
  if (isAssignmentDone(a)) return 0
  const steps = tasksForAssignment(tasks, a.id)
  if (steps.length > 0 && steps.some((s) => s.estimatedMinutes != null)) {
    return steps.filter((s) => !s.done).reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0)
  }
  return a.estimatedMinutes ?? 0
}

export function checklistProgress(tasks: StudyTask[], assignmentId: string): { done: number; total: number } {
  const steps = tasksForAssignment(tasks, assignmentId)
  return { done: steps.filter((s) => s.done).length, total: steps.length }
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const STATUS_RANK: Record<AssignmentStatus, number> = { in_progress: 0, not_started: 1, submitted: 2, completed: 3 }

export type AssignmentSort = 'due' | 'priority' | 'status' | 'title'

export function compareByDue(a: { dueAt: string | null }, b: { dueAt: string | null }): number {
  const da = parseInstant(a.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY
  const db = parseInstant(b.dueAt)?.getTime() ?? Number.POSITIVE_INFINITY
  return da - db
}

export function sortAssignments(list: Assignment[], sort: AssignmentSort): Assignment[] {
  const copy = [...list]
  switch (sort) {
    case 'priority':
      return copy.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || compareByDue(a, b))
    case 'status':
      return copy.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || compareByDue(a, b))
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return copy.sort(compareByDue)
  }
}

export interface AssignmentFilter {
  courseId: string | 'all'
  status: AssignmentStatus | 'all' | 'open' | 'overdue'
  query: string
}

export function filterAssignments(list: Assignment[], f: AssignmentFilter, now: Date): Assignment[] {
  const q = f.query.trim().toLowerCase()
  return list.filter((a) => {
    if (f.courseId !== 'all' && a.courseId !== f.courseId) return false
    if (f.status === 'open' && isAssignmentDone(a)) return false
    if (f.status === 'overdue' && !isAssignmentOverdue(a, now)) return false
    if (f.status !== 'all' && f.status !== 'open' && f.status !== 'overdue' && a.status !== f.status) return false
    if (q && !a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false
    return true
  })
}

export type LockState = { kind: 'opens'; at: Date } | { kind: 'closed'; at: Date | null; why: string | null } | null

/**
 * Canvas availability. "opens": not available yet. "closed": the lock date passed (or Canvas locked it),
 * so nothing can be turned in anymore. null: open.
 */
export function lockState(a: Pick<Assignment, 'unlockAt' | 'lockAt' | 'lockedForUser' | 'lockExplanation'>, now: Date): LockState {
  const unlock = parseInstant(a.unlockAt ?? null)
  if (unlock && now < unlock) return { kind: 'opens', at: unlock }
  const lock = parseInstant(a.lockAt ?? null)
  if (lock && now >= lock) return { kind: 'closed', at: lock, why: a.lockExplanation ?? null }
  if (a.lockedForUser) return { kind: 'closed', at: null, why: a.lockExplanation ?? null }
  return null
}
