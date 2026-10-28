import { describe, expect, it } from 'vitest'
import { EMPTY_DATA } from '@/domain/types'
import { htmlToText, mapCanvasSnapshot } from './mapping'
import { mergeCanvasData } from './merge'
import type { CanvasRawSnapshot } from './types'

const raw: CanvasRawSnapshot = {
  fetchedAt: '2026-10-28T15:00:00.000Z',
  courses: [
    {
      course: { id: 101, name: 'Organic Chemistry', course_code: 'CHEM 232', teachers: [{ display_name: 'Dr. Ada Ng' }], term: { name: 'Fall 2026' } },
      assignmentGroups: [{ id: 1, name: 'Homework', group_weight: 30 }, { id: 2, name: 'Exams', group_weight: 70 }],
      assignments: [
        { id: 9, course_id: 101, name: 'Problem Set 4', description: '<p>Do <b>1–10</b> &amp; show work</p>', due_at: '2026-10-30T22:00:00Z', points_possible: 20, html_url: 'https://canvas.test/courses/101/assignments/9', submission_types: ['online_upload'], assignment_group_id: 1, submission: { workflow_state: 'graded', submitted_at: '2026-10-20T10:00:00Z', score: 18, graded_at: '2026-10-22T10:00:00Z' } },
        { id: 10, course_id: 101, name: 'Midterm', description: null, due_at: '2026-11-05T15:00:00Z', points_possible: 100, html_url: 'https://canvas.test/x', submission_types: ['online_quiz'], assignment_group_id: 2, submission: { workflow_state: 'unsubmitted', submitted_at: null, missing: false } },
      ],
      modules: [{ id: 5, name: 'Week 1', position: 1, items: [{ id: 50, title: 'Problem Set 4', type: 'Assignment', content_id: 9, completion_requirement: { completed: true } }] }],
      announcements: [{ id: 7, title: 'Welcome', message: '<p>Hi</p>', posted_at: '2026-10-01T00:00:00Z', read_state: 'read' }],
    },
  ],
  events: [{ id: 'assignment_10', title: 'Midterm', start_at: '2026-11-05T15:00:00Z', end_at: null, context_code: 'course_101', assignment: { id: 10 } }],
}

describe('Canvas mapping', () => {
  const mapped = mapCanvasSnapshot(raw)
  it('maps courses, assignments, modules and grades with canvas provenance', () => {
    expect(mapped.courses[0]).toMatchObject({ code: 'CHEM 232', instructor: 'Dr. Ada Ng', source: 'canvas', canvasId: '101' })
    expect(mapped.courses[0].gradeCategories.map((c) => c.weight)).toEqual([30, 70])
    expect(mapped.assignments[0]).toMatchObject({ title: 'Problem Set 4', description: 'Do 1–10 & show work', type: 'problem_set', moduleId: 'cv_mod_5' })
    expect(mapped.assignments[1].type).toBe('exam')
    expect(mapped.grades).toEqual([expect.objectContaining({ score: 18, outOf: 20, source: 'canvas' })])
    expect(mapped.events[0].linkedAssignmentId).toBe(mapped.assignments[1].id)
  })
  it('records official submission state separately from personal status', () => {
    expect(mapped.assignments[0].status).toBe('not_started')
    expect(mapped.assignments[0].canvasSubmission).toMatchObject({ state: 'graded', source: 'canvas' })
  })
  it('strips HTML instead of rendering it', () => {
    expect(htmlToText('<script>alert(1)</script><p>a<br>b</p>')).toBe('alert(1)a\nb')
  })
})

describe('Canvas merge', () => {
  it('keeps student-owned fields on re-sync and updates Canvas-owned ones', () => {
    const first = mergeCanvasData(EMPTY_DATA, mapCanvasSnapshot(raw))
    const edited = {
      ...first,
      courses: first.courses.map((c) => ({ ...c, color: 'rose' as const, hidden: true })),
      assignments: first.assignments.map((a) => ({ ...a, priority: 'high' as const, personalNotes: 'mine', status: 'in_progress' as const, estimatedMinutes: 90 })),
      grades: [...first.grades, { id: 'm1', courseId: first.courses[0].id, assignmentId: null, title: 'Old quiz', categoryId: null, score: 5, outOf: 10, source: 'manual' as const, gradedAt: raw.fetchedAt }],
    }
    const raw2 = structuredClone(raw)
    raw2.courses[0].assignments[0].due_at = '2026-10-31T22:00:00Z'
    const second = mergeCanvasData(edited, mapCanvasSnapshot(raw2))
    const a = second.assignments.find((x) => x.canvasId === '9')!
    expect(a.dueAt).toBe('2026-10-31T22:00:00Z')
    expect(a).toMatchObject({ priority: 'high', personalNotes: 'mine', status: 'in_progress', estimatedMinutes: 90 })
    expect(second.courses[0]).toMatchObject({ color: 'rose', hidden: true })
    expect(second.grades.filter((g) => g.source === 'canvas')).toHaveLength(1)
    expect(second.grades.some((g) => g.id === 'm1')).toBe(true)
  })
})
