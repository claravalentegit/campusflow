import type { AppData } from '@/domain/types'
import type { CanvasMapped } from './mapping'

function upsert<T extends { id: string }>(existing: T[], incoming: T[], merge: (prev: T, next: T) => T): T[] {
  const byId = new Map(existing.map((r) => [r.id, r]))
  for (const next of incoming) {
    const prev = byId.get(next.id)
    byId.set(next.id, prev ? merge(prev, next) : next)
  }
  return [...byId.values()]
}

/**
 * Merge a Canvas sync into local data.
 * - Canvas owns: names, descriptions, due dates, points, official submission state, Canvas grades.
 * - The student owns: colors, icons, visibility, priority, estimates, personal status, notes, links,
 *   checklists, and anything they created. Those are never overwritten.
 * - Records that disappear from Canvas are kept (the student may have notes on them).
 */
export function mergeCanvasData(data: AppData, incoming: CanvasMapped): AppData {
  const syncedCourseIds = new Set(incoming.courses.map((c) => c.id))
  return {
    ...data,
    courses: upsert(data.courses, incoming.courses, (prev, next) => ({
      ...prev,
      name: next.name,
      code: next.code,
      instructor: next.instructor,
      description: next.description || prev.description,
      term: next.term,
      gradeCategories: prev.gradeCategories.length ? prev.gradeCategories : next.gradeCategories,
    })),
    assignments: upsert(data.assignments, incoming.assignments, (prev, next) => ({
      ...prev,
      title: next.title,
      description: next.description,
      dueAt: next.dueAt,
      pointsPossible: next.pointsPossible,
      gradeCategoryId: prev.gradeCategoryId ?? next.gradeCategoryId,
      moduleId: next.moduleId ?? prev.moduleId,
      canvasSubmission: next.canvasSubmission,
      canvasSubmissionTypes: next.canvasSubmissionTypes,
      htmlUrl: next.htmlUrl,
      unlockAt: next.unlockAt,
      lockAt: next.lockAt,
      lockedForUser: next.lockedForUser,
      lockExplanation: next.lockExplanation,
      updatedAt: next.updatedAt,
    })),
    modules: upsert(data.modules, incoming.modules, (_prev, next) => next),
    announcements: upsert(data.announcements, incoming.announcements, (prev, next) => ({
      ...next,
      important: prev.important,
      read: prev.read || next.read,
    })),
    events: upsert(data.events, incoming.events, (_prev, next) => next),
    grades: [
      // Canvas grades for synced courses are replaced wholesale; manual grades are untouched.
      ...data.grades.filter((g) => !(g.source === 'canvas' && syncedCourseIds.has(g.courseId))),
      ...incoming.grades,
    ],
  }
}
