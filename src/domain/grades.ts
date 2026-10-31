import { isAssignmentDone, isAssignmentOverdue } from './assignments'
import { parseInstant } from './dates'
import type { Assignment, Course, GradeRecord, GradeSource } from './types'

export interface CategoryBreakdown {
  id: string
  name: string
  weight: number
  earned: number
  possible: number
  percent: number | null
  /** Points possible from assignments in this category that have no grade yet. */
  remainingPossible: number
}

export interface CourseGradeSummary {
  courseId: string
  /** Weighted (or points-based) percentage over graded work only. null when nothing is graded. */
  currentPercent: number | null
  method: 'weighted' | 'points' | 'none'
  /** Fraction (0–1) of the final grade that is already graded, when it can be determined. */
  gradedFraction: number | null
  categories: CategoryBreakdown[]
  sources: GradeSource[]
  uncategorizedCount: number
  gradedCount: number
  assumptions: string[]
}

export function letterGrade(pct: number): string {
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A−'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B−'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C−'
  if (pct >= 67) return 'D+'
  if (pct >= 60) return 'D'
  return 'F'
}

/**
 * The course grade. When Canvas reports the grade itself (its own math, including the current grading
 * period, drop rules and missing-work policies), that number is used, so it always matches Canvas.
 * Otherwise it's calculated from the grades and weights (see calculateCourseGrades).
 */
export function summarizeCourseGrades(course: Course, grades: GradeRecord[], assignments: Assignment[]): CourseGradeSummary {
  const calc = calculateCourseGrades(course, grades, assignments)
  const official = course.canvasScore?.percent
  if (official == null) return calc
  return { ...calc, currentPercent: official, sources: calc.sources.includes('canvas') ? calc.sources : [...calc.sources, 'canvas'] }
}

/** Our own calculation from grades and category weights. Used for what-if estimates. */
export function calculateCourseGrades(course: Course, grades: GradeRecord[], assignments: Assignment[]): CourseGradeSummary {
  const records = grades.filter((g) => g.courseId === course.id && g.outOf > 0)
  const gradedAssignmentIds = new Set(records.map((g) => g.assignmentId).filter(Boolean))
  const ungraded = assignments.filter((a) => a.courseId === course.id && !gradedAssignmentIds.has(a.id))
  const sources = [...new Set(records.map((r) => r.source))]
  const assumptions: string[] = []

  if (records.length === 0) {
    return {
      courseId: course.id,
      currentPercent: null,
      method: 'none',
      gradedFraction: null,
      categories: [],
      sources,
      uncategorizedCount: 0,
      gradedCount: 0,
      assumptions: ['No grades recorded yet.'],
    }
  }

  const totalWeight = course.gradeCategories.reduce((s, c) => s + c.weight, 0)
  if (course.gradeCategories.length > 0 && totalWeight > 0) {
    const categories: CategoryBreakdown[] = course.gradeCategories.map((c) => {
      const recs = records.filter((r) => r.categoryId === c.id)
      const earned = recs.reduce((s, r) => s + r.score, 0)
      const possible = recs.reduce((s, r) => s + r.outOf, 0)
      const remainingPossible = ungraded
        .filter((a) => a.gradeCategoryId === c.id)
        .reduce((s, a) => s + (a.pointsPossible ?? 0), 0)
      return { id: c.id, name: c.name, weight: c.weight, earned, possible, percent: possible > 0 ? (earned / possible) * 100 : null, remainingPossible }
    })
    const graded = categories.filter((c) => c.percent != null)
    const gradedWeight = graded.reduce((s, c) => s + c.weight, 0)
    const current = graded.reduce((s, c) => s + (c.percent as number) * c.weight, 0) / gradedWeight
    const unknownRemaining = ungraded.some((a) => a.gradeCategoryId && a.pointsPossible == null)
    const gradedFraction = unknownRemaining
      ? null
      : categories.reduce((s, c) => {
          const total = c.possible + c.remainingPossible
          return s + (total > 0 ? (c.weight * c.possible) / total : 0)
        }, 0) / totalWeight
    const uncategorizedCount = records.filter((r) => !r.categoryId || !course.gradeCategories.some((c) => c.id === r.categoryId)).length
    assumptions.push(
      `Weighted by the categories you entered (${course.gradeCategories.map((c) => `${c.name} ${c.weight}%`).join(', ')}).`,
      'Categories with no graded work are left out, and the remaining weights are scaled up to 100%.',
    )
    if (totalWeight !== 100) assumptions.push(`Your category weights add up to ${totalWeight}%, not 100%.`)
    if (uncategorizedCount) assumptions.push(`${uncategorizedCount} grade(s) have no category and are not counted.`)
    if (unknownRemaining) assumptions.push('Some ungraded assignments have no point value, so the graded share of the course cannot be calculated.')
    return {
      courseId: course.id,
      currentPercent: current,
      method: 'weighted',
      gradedFraction,
      categories,
      sources,
      uncategorizedCount,
      gradedCount: records.length,
      assumptions,
    }
  }

  const earned = records.reduce((s, r) => s + r.score, 0)
  const possible = records.reduce((s, r) => s + r.outOf, 0)
  const remainingPossible = ungraded.reduce((s, a) => s + (a.pointsPossible ?? 0), 0)
  const unknownRemaining = ungraded.some((a) => a.pointsPossible == null)
  assumptions.push('No category weights entered, so every point counts equally (total points earned ÷ points possible).')
  if (unknownRemaining) assumptions.push('Some ungraded assignments have no point value, so the graded share of the course is unknown.')
  return {
    courseId: course.id,
    currentPercent: (earned / possible) * 100,
    method: 'points',
    gradedFraction: unknownRemaining ? null : possible / (possible + remainingPossible),
    categories: [],
    sources,
    uncategorizedCount: 0,
    gradedCount: records.length,
    assumptions,
  }
}

export interface TargetResult {
  /** Average needed on the remaining work, in percent. */
  requiredPercent: number | null
  explanation: string
}

export function requiredForTarget(summary: CourseGradeSummary, target: number): TargetResult {
  if (summary.currentPercent == null) return { requiredPercent: null, explanation: 'Add at least one grade to calculate this.' }
  const f = summary.gradedFraction
  if (f == null) return { requiredPercent: null, explanation: 'Add point values to the remaining assignments to calculate this.' }
  if (f >= 0.999) return { requiredPercent: null, explanation: 'All known work is graded — there is nothing left to raise the grade.' }
  const required = (target - summary.currentPercent * f) / (1 - f)
  const share = Math.round((1 - f) * 100)
  if (required > 100) return { requiredPercent: required, explanation: `You would need ${required.toFixed(1)}% on the remaining ${share}% of the grade, which is above 100%.` }
  if (required <= 0) return { requiredPercent: required, explanation: `You have already secured ${target}% based on the graded ${100 - share}% of the course.` }
  return { requiredPercent: required, explanation: `You need an average of ${required.toFixed(1)}% on the remaining ${share}% of the grade.` }
}

export function gradeTrend(courseId: string, grades: GradeRecord[]): Array<{ date: Date; percent: number; title: string }> {
  return grades
    .filter((g) => g.courseId === courseId && g.outOf > 0)
    .map((g) => ({ date: parseInstant(g.gradedAt) ?? new Date(0), percent: (g.score / g.outOf) * 100, title: g.title }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function missingAndUngraded(courseId: string, assignments: Assignment[], grades: GradeRecord[], now: Date) {
  const graded = new Set(grades.filter((g) => g.courseId === courseId).map((g) => g.assignmentId))
  const list = assignments.filter((a) => a.courseId === courseId)
  return {
    missing: list.filter((a) => isAssignmentOverdue(a, now)),
    awaitingGrade: list.filter((a) => isAssignmentDone(a) && !graded.has(a.id) && a.pointsPossible != null),
  }
}

