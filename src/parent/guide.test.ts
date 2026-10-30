import { describe, expect, it } from 'vitest'
import type { Assignment, Course } from '@/domain/types'
import type { FamilySnapshot } from '@/integrations/family'
import { buildParentGuide, weekKey } from './guide'

const NOW = new Date(2026, 9, 28, 15, 0)
const at = (d: number, h = 15) => new Date(2026, 9, 28 + d, h, 0).toISOString()
const a = (p: Partial<Assignment & { skipped: boolean }> = {}) => ({ id: 'a', courseId: 'c', title: 'A', description: '', dueAt: at(2), priority: 'medium', estimatedMinutes: 60, status: 'not_started', type: 'essay', submissionInstructions: '', rubricNotes: '', links: [], personalNotes: '', pointsPossible: 10, gradeCategoryId: null, moduleId: null, canvasSubmission: null, source: 'canvas', canvasId: null, htmlUrl: null, completedAt: null, createdAt: at(-9), updatedAt: at(-9), ...p }) as Assignment
const course = { id: 'c', name: 'Algebra', code: 'MATH', instructor: 'Mr. Ruiz', description: '', term: '', color: 'blue', icon: 'calculator', status: 'active', hidden: false, meetingInfo: null, gradeCategories: [{ id: 'hw', name: 'Homework', weight: 40 }, { id: 'tests', name: 'Tests', weight: 60 }], targetGrade: null, source: 'canvas', canvasId: null, createdAt: at(-30) } as unknown as Course
const snap = (assignments: FamilySnapshot['assignments']): FamilySnapshot => ({ v: 1, student: { name: 'Clara', level: 3, xp: 300, streak: 4, dailyGoal: 3, pet: null }, courses: [course], assignments, grades: [], announcements: [], completions: [at(-1), at(-2)] })

describe('parent guide', () => {
  it('starts with the good, explains only the words that show up, then what matters, then how to help', () => {
    const cards = buildParentGuide(
      snap([
        a({ id: 'late', title: 'HW 3', dueAt: at(-1), lockAt: at(1) }),
        a({ id: 'closed', title: 'HW 2', dueAt: at(-5), lockAt: at(-2) }),
        a({ id: 'exam', title: 'Unit test', type: 'exam', dueAt: at(4) }),
        a({ id: 'skip', title: 'Optional reading', skipped: true }),
      ]),
      NOW,
    )
    expect(cards.map((c) => c.id)).toEqual(['good', 'term:late', 'term:closed', 'term:skipped', 'term:weighted', 'focus:late', 'focus:closed', 'focus:exam', 'help'])
    expect(cards[0]).toMatchObject({ kind: 'good', done: 2, streak: 4, calm: false })
    expect(cards.find((c) => c.id === 'focus:late')).toMatchObject({ situation: 'late' })
    expect(cards.find((c) => c.id === 'focus:closed')).toMatchObject({ situation: 'closed' })
  })
  it('a calm week: no scary words, nothing to fix', () => {
    const cards = buildParentGuide(snap([a({ id: 'next', dueAt: at(10) })]), NOW)
    expect(cards.map((c) => c.kind)).toEqual(['good', 'term', 'help'])
    expect(cards[0]).toMatchObject({ calm: true })
  })
  it('shows at most 3 things that matter', () => {
    const late = Array.from({ length: 6 }, (_, i) => a({ id: `l${i}`, dueAt: at(-1), lockAt: at(3) }))
    expect(buildParentGuide(snap(late), NOW).filter((c) => c.kind === 'focus')).toHaveLength(3)
  })
  it('restarts every Monday', () => {
    expect(weekKey(new Date(2026, 9, 28))).toBe(weekKey(new Date(2026, 10, 1)))
    expect(weekKey(new Date(2026, 9, 28))).not.toBe(weekKey(new Date(2026, 10, 2)))
  })
})
