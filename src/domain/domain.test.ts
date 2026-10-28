import { describe, expect, it } from 'vitest'
import { buildDemoData } from '@/data/demo'
import { filterAssignments, isAssignmentDone, isAssignmentOverdue, remainingMinutes } from './assignments'
import { suggestBreakdown } from './breakdown'
import { buildCalendarItems } from './calendar'
import { combineLocalDateTime, dueBucket, parseLocalDay, toLocalDay } from './dates'
import { requiredForTarget, summarizeCourseGrades } from './grades'
import { recommendNext } from './recommend'
import { searchAll } from './search'
import type { Assignment } from './types'
import { computeWorkload } from './workload'

// Wednesday 28 Oct 2026, 10:00 local time.
const NOW = new Date(2026, 9, 28, 10, 0)
const at = (d: number, h = 23, m = 59) => new Date(2026, 9, 28 + d, h, m).toISOString()

function assignment(p: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a1', courseId: 'c1', title: 'Essay', description: '', dueAt: at(2), priority: 'medium', estimatedMinutes: 120,
    status: 'not_started', type: 'essay', submissionInstructions: '', rubricNotes: '', links: [], personalNotes: '',
    pointsPossible: 100, gradeCategoryId: null, moduleId: null, canvasSubmission: null, source: 'manual', canvasId: null,
    htmlUrl: null, completedAt: null, createdAt: at(-10), updatedAt: at(-10), ...p,
  }
}

describe('dates', () => {
  it('treats a deadline earlier today as overdue, not "due today"', () => {
    expect(dueBucket(new Date(2026, 9, 28, 9, 0).toISOString(), NOW)).toBe('overdue')
    expect(dueBucket(new Date(2026, 9, 28, 23, 59).toISOString(), NOW)).toBe('today')
  })
  it('buckets tomorrow, this week, next week and later (Monday week start)', () => {
    expect(dueBucket(at(1), NOW)).toBe('tomorrow')
    expect(dueBucket(at(3), NOW)).toBe('this_week') // Saturday
    expect(dueBucket(at(5), NOW)).toBe('next_week') // Monday
    expect(dueBucket(at(20), NOW)).toBe('later')
    expect(dueBucket(null, NOW)).toBe('no_date')
  })
  it('parses date inputs strictly in local time', () => {
    const iso = combineLocalDateTime('2026-11-02', '09:30')!
    const d = new Date(iso)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 2, 9, 30])
    expect(combineLocalDateTime('11/02/2026', '09:30')).toBeNull()
    expect(parseLocalDay('2026-13-45')).toBeNull()
    expect(toLocalDay(parseLocalDay('2026-03-08')!)).toBe('2026-03-08')
  })
})

describe('assignments', () => {
  it('distinguishes personal completion from Canvas submission', () => {
    expect(isAssignmentDone(assignment({ status: 'completed' }))).toBe(true)
    expect(isAssignmentDone(assignment({ canvasSubmission: { state: 'submitted', submittedAt: null, syncedAt: at(0), source: 'canvas' } }))).toBe(true)
    expect(isAssignmentDone(assignment({ canvasSubmission: { state: 'unsubmitted', submittedAt: null, syncedAt: at(0), source: 'canvas' } }))).toBe(false)
  })
  it('flags overdue only for open work', () => {
    expect(isAssignmentOverdue(assignment({ dueAt: at(-1) }), NOW)).toBe(true)
    expect(isAssignmentOverdue(assignment({ dueAt: at(-1), status: 'completed' }), NOW)).toBe(false)
    expect(isAssignmentOverdue(assignment({ dueAt: null }), NOW)).toBe(false)
  })
  it('filters by course, status and query', () => {
    const list = [assignment({ id: '1', courseId: 'x', title: 'Lab report' }), assignment({ id: '2', courseId: 'y', status: 'completed' }), assignment({ id: '3', courseId: 'x', dueAt: at(-2), description: 'enzyme kinetics' })]
    expect(filterAssignments(list, { courseId: 'x', status: 'all', query: '' }, NOW).map((a) => a.id)).toEqual(['1', '3'])
    expect(filterAssignments(list, { courseId: 'all', status: 'open', query: '' }, NOW).map((a) => a.id)).toEqual(['1', '3'])
    expect(filterAssignments(list, { courseId: 'all', status: 'overdue', query: '' }, NOW).map((a) => a.id)).toEqual(['3'])
    expect(filterAssignments(list, { courseId: 'all', status: 'all', query: 'ENZYME' }, NOW).map((a) => a.id)).toEqual(['3'])
  })
  it('computes remaining minutes from open checklist steps', () => {
    const a = assignment()
    const step = (id: string, done: boolean, m: number) => ({ id, title: id, courseId: 'c1', assignmentId: 'a1', plannedFor: null, dueAt: null, estimatedMinutes: m, priority: 'medium' as const, done, position: 0, createdAt: at(0), completedAt: null })
    expect(remainingMinutes(a, [])).toBe(120)
    expect(remainingMinutes(a, [step('s1', true, 60), step('s2', false, 45)])).toBe(45)
  })
})

describe('breakdown', () => {
  it('never schedules a step after the due date and splits the estimate', () => {
    const steps = suggestBreakdown({ type: 'essay', dueAt: at(5, 17, 0), estimatedMinutes: 600 }, NOW)
    expect(steps).toHaveLength(6)
    const dueDay = toLocalDay(new Date(at(5)))
    for (const s of steps) expect(s.plannedFor! < dueDay).toBe(true)
    expect(steps[0].plannedFor).toBe(toLocalDay(NOW))
    const total = steps.reduce((s, x) => s + (x.estimatedMinutes ?? 0), 0)
    expect(Math.abs(total - 600)).toBeLessThanOrEqual(30)
  })
  it('leaves steps unscheduled when there is no (future) due date', () => {
    expect(suggestBreakdown({ type: 'lab', dueAt: null, estimatedMinutes: null }, NOW).every((s) => s.plannedFor === null && s.estimatedMinutes === null)).toBe(true)
  })
})

describe('recommendations', () => {
  const course = { id: 'c1', status: 'active', hidden: false } as never
  it('puts overdue work first and explains why', () => {
    const recs = recommendNext({ assignments: [assignment({ id: 'later', dueAt: at(6) }), assignment({ id: 'late', dueAt: at(-1) })], tasks: [], courses: [course], prefs: { availability: null } }, NOW)
    expect(recs[0].id).toBe('late')
    expect(recs[0].reasons).toContain('Past its due date')
  })
  it('does not mention available time when the student has not provided it', () => {
    const recs = recommendNext({ assignments: [assignment()], tasks: [], courses: [course], prefs: { availability: null } }, NOW)
    expect(recs[0].reasons.some((r) => /available/i.test(r))).toBe(false)
  })
  it('skips hidden courses', () => {
    const recs = recommendNext({ assignments: [assignment()], tasks: [], courses: [{ id: 'c1', status: 'active', hidden: true } as never], prefs: { availability: null } }, NOW)
    expect(recs).toHaveLength(0)
  })
})

describe('workload', () => {
  it('counts unscheduled due work on the due day and flags overload', () => {
    const days = computeWorkload({ assignments: [assignment({ dueAt: at(1), estimatedMinutes: 300 })], tasks: [], sessions: [], prefs: { availability: null, overloadThresholdMinutes: 240 } }, NOW, 3)
    expect(days[1].unscheduledDueMinutes).toBe(300)
    expect(days[1].deadlines).toBe(1)
    expect(days[1].overloaded).toBe(true)
    expect(days[0].overloaded).toBe(false)
  })
})

describe('grades', () => {
  const course = { id: 'c1', gradeCategories: [{ id: 'hw', name: 'HW', weight: 40 }, { id: 'ex', name: 'Exams', weight: 60 }] } as never
  const g = (id: string, categoryId: string, score: number, outOf: number) => ({ id, courseId: 'c1', assignmentId: null, title: id, categoryId, score, outOf, source: 'manual' as const, gradedAt: at(-1) })
  it('weights categories and rescales when some are ungraded', () => {
    const s = summarizeCourseGrades(course, [g('h1', 'hw', 9, 10)], [])
    expect(s.method).toBe('weighted')
    expect(s.currentPercent).toBeCloseTo(90)
    const s2 = summarizeCourseGrades(course, [g('h1', 'hw', 9, 10), g('e1', 'ex', 70, 100)], [])
    expect(s2.currentPercent).toBeCloseTo(0.4 * 90 + 0.6 * 70)
  })
  it('never invents a grade without data', () => {
    expect(summarizeCourseGrades(course, [], []).currentPercent).toBeNull()
  })
  it('calculates the average needed for a target', () => {
    const s = summarizeCourseGrades({ id: 'c1', gradeCategories: [] } as never, [g('a', '', 80, 100)], [assignment({ id: 'x', pointsPossible: 100 })])
    expect(s.gradedFraction).toBeCloseTo(0.5)
    expect(requiredForTarget(s, 90).requiredPercent).toBeCloseTo(100)
  })
})

describe('calendar', () => {
  it('does not show an assignment twice when Canvas also lists it as an event', () => {
    const a = assignment({ id: 'mid', title: 'Midterm 2', type: 'exam', dueAt: at(3, 19, 0), canvasId: '55' })
    const ev = (p: object) => ({ id: 'e', title: 'Midterm 2', courseId: 'c1', kind: 'exam' as const, start: at(3, 19, 0), end: null, allDay: false, location: '', notes: '', source: 'canvas' as const, canvasId: null, linkedAssignmentId: null, ...p })
    for (const e of [ev({ id: 'e1', linkedAssignmentId: 'mid' }), ev({ id: 'e2', canvasId: '55' }), ev({ id: 'e3', title: 'midterm 2' })]) {
      const items = buildCalendarItems({ assignments: [a], events: [e], sessions: [], reminders: [], tasks: [] }, NOW)
      expect(items).toHaveLength(1)
    }
    const other = buildCalendarItems({ assignments: [a], events: [ev({ id: 'e4', title: 'Review session' })], sessions: [], reminders: [], tasks: [] }, NOW)
    expect(other).toHaveLength(2)
  })
})

describe('demo data', () => {
  const data = buildDemoData(NOW)
  it('has at least four active courses, all marked as demo', () => {
    expect(data.courses.filter((c) => c.status === 'active').length).toBeGreaterThanOrEqual(4)
    expect([...data.courses, ...data.assignments, ...data.grades].every((r) => r.source === 'demo')).toBe(true)
  })
  it('includes overdue, due-today and upcoming work', () => {
    const buckets = new Set(data.assignments.filter((a) => !isAssignmentDone(a)).map((a) => dueBucket(a.dueAt, NOW)))
    for (const b of ['overdue', 'today', 'tomorrow', 'next_week'] as const) expect(buckets.has(b)).toBe(true)
  })
  it('never labels demo submission state as Canvas', () => {
    expect(data.assignments.every((a) => !a.canvasSubmission || a.canvasSubmission.source === 'demo')).toBe(true)
  })
  it('search finds assignments by title', () => {
    expect(searchAll(data, 'flood')[0]).toMatchObject({ category: 'assignment', id: 'asg_cs_mp4' })
  })
})
