import { describe, expect, it } from 'vitest'
import { goalProgress, type GoalRule, type RewardGoal } from './goals'
import type { Course, GradeRecord } from './types'

// Wednesday Oct 28, 2026.
const NOW = new Date(2026, 9, 28, 15, 0)
const on = (day: number, n = 1) => Array.from({ length: n }, (_, i) => new Date(2026, 9, day, 10 + i).toISOString())
const goal = (rule: GoalRule, startDay = '2026-10-19'): RewardGoal => ({ id: 'g', parentId: 'p', parentName: 'Mom', createdAt: '', startDay, rule, reward: '$20', emoji: '💵', status: 'active', givenAt: null })
const data = (completions: string[]) => ({ completions, courses: [], grades: [], assignments: [] })

describe('reward goals', () => {
  const streak = goal({ kind: 'streak', perDay: 2, days: 5, weekdaysOnly: true })
  it('counts school days in a row, skipping weekends, and today doesn’t break it', () => {
    // Thu 22, Fri 23, (weekend), Mon 26, Tue 27 → 4 in a row; today (Wed 28) has only 1 so far.
    const p = goalProgress(streak, data([...on(22, 2), ...on(23, 2), ...on(26, 3), ...on(27, 2), ...on(28)]), NOW)
    expect(p).toMatchObject({ value: 4, target: 5, unit: 'days', reached: false })
    expect(goalProgress(streak, data([...on(22, 2), ...on(23, 2), ...on(26, 3), ...on(27, 2), ...on(28, 2)]), NOW).reached).toBe(true)
  })
  it('a missed day restarts the streak, but the best run is kept', () => {
    const p = goalProgress(streak, data([...on(19, 2), ...on(20, 2), ...on(21, 2), ...on(26, 2)]), NOW)
    expect(p).toMatchObject({ value: 0, best: 3, reached: false })
  })
  it('work before the goal started doesn’t count', () => {
    expect(goalProgress(goal({ kind: 'total', count: 3, by: '2026-10-31' }, '2026-10-27'), data([...on(20, 5), ...on(27, 2)]), NOW)).toMatchObject({ value: 2, reached: false, missed: false })
  })
  it('a total goal can be missed after its date', () => {
    expect(goalProgress(goal({ kind: 'total', count: 10, by: '2026-10-25' }), data(on(20, 3)), NOW)).toMatchObject({ reached: false, missed: true })
  })
  it('a grade goal reads the class grade', () => {
    const course = { id: 'c', name: 'Algebra', gradeCategories: [], status: 'active' } as unknown as Course
    const grades = [{ id: 'g1', courseId: 'c', assignmentId: 'a', title: 'a', categoryId: null, score: 92, outOf: 100, source: 'canvas', gradedAt: '' }] as GradeRecord[]
    const p = goalProgress(goal({ kind: 'grade', courseId: 'c', courseName: 'Algebra', percent: 90, by: null }), { completions: [], courses: [course], grades, assignments: [] }, NOW)
    expect(p).toMatchObject({ value: 92, unit: 'percent', reached: true })
  })
})
