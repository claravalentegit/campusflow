import { describe, expect, it } from 'vitest'
import type { XpEvent } from './game'
import { petMood, petStage } from './pet'
import { buildGuide, lateOpen, reopenEmail } from './guide'
import { buildPlan } from './plan'
import { lockState } from './assignments'
import type { Assignment, Course, CourseModule, GradeRecord, ModuleItem } from './types'

const NOW = new Date(2026, 9, 28, 15, 0)
const at = (d: number, h = 15) => new Date(2026, 9, 28 + d, h, 0).toISOString()
const a = (p: Partial<Assignment> = {}) => ({ id: 'a', courseId: 'c', title: 'A', description: '', dueAt: at(2), priority: 'medium', estimatedMinutes: 60, status: 'not_started', type: 'essay', submissionInstructions: '', rubricNotes: '', links: [], personalNotes: '', pointsPossible: null, gradeCategoryId: null, moduleId: null, canvasSubmission: null, source: 'manual', canvasId: null, htmlUrl: null, completedAt: null, createdAt: at(-9), updatedAt: at(-9), ...p }) as Assignment
const ev = (d: number): XpEvent => ({ id: String(d), at: at(d), amount: 10, kind: 'task', refId: 'x' })

describe('pet', () => {
  it('grows with the level', () => {
    expect(petStage(1).stage).toBe('egg')
    expect(petStage(3)).toMatchObject({ stage: 'baby', next: { label: 'Kid', at: 4 } })
    expect(petStage(6).stage).toBe('teen')
    expect(petStage(40)).toMatchObject({ stage: 'legend', next: null })
  })
  it('mood follows late work, then activity', () => {
    const late = (id: string) => a({ id, dueAt: at(-1) })
    expect(petMood([late('1'), late('2')], [ev(0)], NOW)).toEqual({ mood: 'worried', late: 2 })
    expect(petMood([late('1'), a({ id: '2' })], [ev(0)], NOW).mood).toBe('ok')
    expect(petMood([a()], [ev(-3)], NOW).mood).toBe('sleepy')
    expect(petMood([a()], [ev(-1)], NOW).mood).toBe('happy')
    expect(petMood([], [], NOW).mood).toBe('happy')
  })
})

describe('grade guide', () => {
  const course = { id: 'c', name: 'Algebra', code: 'MATH', instructor: 'Mr. Ruiz', description: '', term: '', color: 'blue', icon: 'calculator', status: 'active', hidden: false, meetingInfo: null, gradeCategories: [{ id: 'hw', name: 'Homework', weight: 40 }, { id: 'tests', name: 'Tests', weight: 60 }], targetGrade: null, source: 'manual', canvasId: null, createdAt: at(-30) } as unknown as Course
  const g = (id: string, cat: string, score: number, outOf: number) => ({ id: `g${id}`, courseId: 'c', assignmentId: id, title: id, categoryId: cat, score, outOf, source: 'manual', gradedAt: at(-5) }) as GradeRecord
  const list = [
    a({ id: 'hw1', gradeCategoryId: 'hw', pointsPossible: 20, dueAt: at(-10), status: 'completed' }),
    a({ id: 'hw2', title: 'HW 2', gradeCategoryId: 'hw', pointsPossible: 20, dueAt: at(-2), lockAt: at(1) }), // late, closes tomorrow
    a({ id: 'hw3', title: 'HW 3', gradeCategoryId: 'hw', pointsPossible: 40, dueAt: at(-1), lockAt: at(10) }), // late, open for a while
    a({ id: 'hw4', title: 'HW 4', gradeCategoryId: 'hw', pointsPossible: 20, dueAt: at(-6), lockAt: at(-3) }), // closed
    a({ id: 't1', gradeCategoryId: 'tests', pointsPossible: 100, dueAt: at(-8), status: 'completed' }),
    a({ id: 'next', title: 'Next week', gradeCategoryId: 'hw', pointsPossible: 20, dueAt: at(7) }), // fine, not in the guide
  ]
  const guide = buildGuide([course], list, [g('hw1', 'hw', 18, 20), g('t1', 'tests', 68, 100)], NOW)[0]
  it('lists open work closing soonest first, then by value, and closed work separately', () => {
    expect(guide.turnIn.map((x) => x.a.id)).toEqual(['hw2', 'hw3'])
    expect(guide.turnIn[0].closesSoon).toBe(true)
    expect(guide.closed.map((x) => x.id)).toEqual(['hw4'])
    expect(guide.needsHelp).toBe(true)
  })
  it('estimates the effect on the grade', () => {
    expect(guide.percent).toBeCloseTo(0.4 * 90 + 0.6 * 68, 1)
    expect(guide.ifZeros!).toBeLessThan(guide.percent!)
    expect(guide.ifTurnedIn!).toBeGreaterThan(guide.ifZeros!)
  })
  it('points at a heavy category that is low', () => {
    expect(guide.focus).toMatchObject({ name: 'Tests', weight: 60 })
  })
  it('writes a polite email to reopen closed work', () => {
    const e = reopenEmail({ teacher: 'Mr. Ruiz', course: 'Algebra', items: [list[3]], student: 'Clara', byDate: 'Friday' })
    expect(e.subject).toContain('HW 4')
    expect(e.body).toMatch(/Hi Mr. Ruiz,[\s\S]*reopen it[\s\S]*Friday[\s\S]*Clara$/)
  })
})

describe('locks', () => {
  it('knows when work opens and when it closes', () => {
    expect(lockState(a({ unlockAt: at(2) }), NOW)?.kind).toBe('opens')
    expect(lockState(a({ lockAt: at(-1) }), NOW)?.kind).toBe('closed')
    expect(lockState(a({ lockAt: at(1) }), NOW)).toBeNull()
    expect(lockState(a({ lockedForUser: true, lockExplanation: 'Locked by teacher' }), NOW)).toMatchObject({ kind: 'closed', why: 'Locked by teacher' })
    expect(lockState(a({}), NOW)).toBeNull()
  })
  it('closed work is not counted as fixable late work', () => {
    const list = [a({ id: 'open', dueAt: at(-1), lockAt: at(2) }), a({ id: 'closed', dueAt: at(-3), lockAt: at(-1) })]
    expect(lateOpen(list, NOW).map((x) => x.id)).toEqual(['open'])
  })
})

describe('study plan', () => {
  const course = { id: 'c', name: 'Algebra', code: 'MATH', instructor: 'Mr. Ruiz', description: '', term: '', color: 'blue', icon: 'calculator', status: 'active', hidden: false, meetingInfo: null, gradeCategories: [], targetGrade: null, source: 'manual', canvasId: null, createdAt: at(-30) } as unknown as Course
  const lesson = (id: string, type: string, completed = false) => ({ id, title: id, type, assignmentId: null, url: null, completed }) as ModuleItem
  const modules = [
    { id: 'm1', courseId: 'c', title: 'Unit 1', position: 0, items: [lesson('notes-1', 'file'), lesson('quiz', 'quiz')], source: 'manual', canvasId: null },
    { id: 'm2', courseId: 'c', title: 'Unit 2', position: 1, items: [lesson('video-2', 'lecture'), lesson('done-2', 'reading', true)], source: 'manual', canvasId: null },
  ] as CourseModule[]
  const list = [
    a({ id: 'urgent', title: 'Closes soon', pointsPossible: 10, dueAt: at(-1), lockAt: at(0, 20) }),
    a({ id: 'open', title: 'Open late', pointsPossible: 50, dueAt: at(-2), lockAt: at(5) }),
    a({ id: 'closed', title: 'Closed', pointsPossible: 10, dueAt: at(-5), lockAt: at(-2), moduleId: 'm1' }),
    a({ id: 'exam', title: 'Unit test', type: 'exam', pointsPossible: 100, dueAt: at(6) }),
  ]
  const plan = buildPlan({ courses: [course], assignments: list, grades: [], modules, done: new Set() }, NOW)
  it('orders cards: urgent turn-in, email, other turn-ins, learn, study', () => {
    expect(plan.map((c) => c.kind)).toEqual(['turn-in', 'email', 'turn-in', 'learn', 'study'])
    expect(plan[0].id).toBe('turn-in:urgent')
  })
  it('learn and study cards point at unfinished lessons only', () => {
    const learn = plan.find((c) => c.kind === 'learn')!
    expect(learn.kind === 'learn' && learn.lessons.map((l) => l.id)).toEqual(['notes-1'])
    const study = plan.find((c) => c.kind === 'study')!
    expect(study.kind === 'study' && study.lessons.map((l) => l.item.id)).toEqual(['video-2', 'notes-1'])
  })
  it('drops cards the student finished', () => {
    const next = buildPlan({ courses: [course], assignments: list, grades: [], modules, done: new Set(plan.filter((c) => c.kind === 'email').map((c) => c.id)) }, NOW)
    expect(next.some((c) => c.kind === 'email')).toBe(false)
  })
})
