import { differenceInHours } from 'date-fns'
import { isAssignmentDone, isAssignmentOverdue, lockState } from './assignments'
import { parseInstant } from './dates'
import { calculateCourseGrades, summarizeCourseGrades } from './grades'
import type { Assignment, Course, GradeRecord } from './types'

/**
 * The Grade guide: for each class, a few clear steps to protect or raise the grade.
 * Rule-based, and honest about estimates.
 *
 * - Turn in: late work that's still open on Canvas, closing soonest first, then most valuable.
 *   (Work that isn't late yet is on Today, so it's not repeated here.)
 * - Ask your teacher: work that's closed on Canvas and not graded (it may be counting as zero).
 * - Focus: a heavy grade category that's low.
 */

export const CLOSING_SOON_HOURS = 72

export interface TurnIn {
  a: Assignment
  late: boolean
  closesAt: Date | null
  closesSoon: boolean
  /** Rough share of the final grade this assignment is worth, in percent. */
  worth: number | null
}

export interface ClassGuide {
  course: Course
  percent: number | null
  /** Estimated grade if the missing work (open and closed) were graded as zero. */
  ifZeros: number | null
  /** Estimated grade if the open work were turned in for full credit (closed work still zero). */
  ifTurnedIn: number | null
  turnIn: TurnIn[]
  closed: Assignment[]
  focus: { name: string; weight: number; percent: number } | null
  needsHelp: boolean
}

/** Late work that can still be turned in (closed assignments can't be). */
export function lateOpen(assignments: Assignment[], now: Date): Assignment[] {
  return assignments.filter((a) => !isAssignmentDone(a) && isAssignmentOverdue(a, now) && lockState(a, now)?.kind !== 'closed')
}

function worthOf(a: Assignment, course: Course, mine: Assignment[]): number | null {
  if (!a.pointsPossible) return null
  const weights = course.gradeCategories
  const total = weights.reduce((s, c) => s + c.weight, 0)
  if (weights.length && total > 0 && a.gradeCategoryId) {
    const cat = weights.find((c) => c.id === a.gradeCategoryId)
    if (!cat) return null
    const catPoints = mine.filter((x) => x.gradeCategoryId === cat.id).reduce((s, x) => s + (x.pointsPossible ?? 0), 0)
    return catPoints ? (a.pointsPossible / catPoints) * (cat.weight / total) * 100 : null
  }
  const all = mine.reduce((s, x) => s + (x.pointsPossible ?? 0), 0)
  return all ? (a.pointsPossible / all) * 100 : null
}

function withScores(course: Course, grades: GradeRecord[], items: Assignment[], score: (a: Assignment) => number): GradeRecord[] {
  const graded = new Set(grades.map((g) => g.assignmentId))
  const extra: GradeRecord[] = items
    .filter((a) => a.pointsPossible && !graded.has(a.id))
    .map((a) => ({ id: `guess_${a.id}`, courseId: course.id, assignmentId: a.id, title: a.title, categoryId: a.gradeCategoryId, score: score(a), outOf: a.pointsPossible!, source: 'manual', gradedAt: '' }))
  return [...grades, ...extra]
}

export function buildGuide(courses: Course[], assignments: Assignment[], grades: GradeRecord[], now: Date): ClassGuide[] {
  return courses
    .filter((c) => c.status === 'active' && !c.hidden)
    .map((course) => {
      const mine = assignments.filter((a) => a.courseId === course.id)
      const myGrades = grades.filter((g) => g.courseId === course.id)
      const gradedIds = new Set(myGrades.map((g) => g.assignmentId))
      const turnIn: TurnIn[] = []
      const closed: Assignment[] = []
      for (const a of mine) {
        if (isAssignmentDone(a) || gradedIds.has(a.id)) continue
        const lock = lockState(a, now)
        if (lock?.kind === 'opens') continue
        const late = isAssignmentOverdue(a, now) || a.canvasSubmission?.state === 'missing'
        if (lock?.kind === 'closed') {
          if (late) closed.push(a)
          continue
        }
        const closesAt = parseInstant(a.lockAt ?? null)
        const closesSoon = !!closesAt && differenceInHours(closesAt, now) <= CLOSING_SOON_HOURS
        if (late) turnIn.push({ a, late, closesAt, closesSoon, worth: worthOf(a, course, mine) })
      }
      // Closing soonest first (those are the ones you can lose), then the most valuable.
      turnIn.sort((x, y) => Number(y.closesSoon) - Number(x.closesSoon) || (x.closesSoon && y.closesSoon ? x.closesAt!.getTime() - y.closesAt!.getTime() : 0) || (y.worth ?? 0) - (x.worth ?? 0))

      const summary = summarizeCourseGrades(course, myGrades, mine)
      const percent = summary.currentPercent
      // What-ifs use our own math, shifted so "now" lines up with the grade Canvas shows.
      const ours = calculateCourseGrades(course, myGrades, mine).currentPercent
      const shift = percent != null && ours != null ? percent - ours : 0
      const whatIf = (g: GradeRecord[]) => {
        const p = calculateCourseGrades(course, g, mine).currentPercent
        return p == null ? null : Math.max(0, p + shift)
      }
      const missingAll = [...turnIn.filter((t) => t.late).map((t) => t.a), ...closed]
      const ifZeros = percent == null || !missingAll.length ? null : whatIf(withScores(course, myGrades, missingAll, () => 0))
      const ifTurnedIn = percent == null || !turnIn.length ? null : whatIf(withScores(course, withScores(course, myGrades, closed, () => 0), turnIn.map((t) => t.a), (a) => a.pointsPossible ?? 0))
      const low = summary.method === 'weighted' ? summary.categories.filter((k) => k.percent != null && k.percent < 75 && k.weight >= 25).sort((a, b) => b.weight - a.weight)[0] : undefined
      const focus = low ? { name: low.name, weight: low.weight, percent: low.percent! } : null
      return { course, percent, ifZeros, ifTurnedIn, turnIn, closed, focus, needsHelp: turnIn.length > 0 || closed.length > 0 || !!focus }
    })
    .sort((a, b) => Number(b.needsHelp) - Number(a.needsHelp) || Number(b.turnIn.some((t) => t.closesSoon)) - Number(a.turnIn.some((t) => t.closesSoon)) || b.closed.length + b.turnIn.length - (a.closed.length + a.turnIn.length))
}

/** A polite email asking a teacher to reopen closed work. The student reviews and sends it. */
export function reopenEmail(opts: { teacher: string | null; course: string; items: Assignment[]; student: string; byDate: string }): { subject: string; body: string } {
  const titles = opts.items.map((a) => a.title)
  const list = titles.length === 1 ? `“${titles[0]}”` : titles.map((t) => `- ${t}`).join('\n')
  const greeting = opts.teacher ? `Hi ${opts.teacher},` : 'Hello,'
  return {
    subject: titles.length === 1 ? `${opts.course}: could “${titles[0]}” be reopened?` : `${opts.course}: question about ${titles.length} closed assignments`,
    body: `${greeting}

I’m ${opts.student} from your ${opts.course} class. I missed the deadline for ${titles.length === 1 ? list : `these assignments:\n${list}\n`}${titles.length === 1 ? ' and it’s now closed on Canvas' : 'They’re now closed on Canvas'}. I’m sorry about that.

Would it be possible to reopen ${titles.length === 1 ? 'it' : 'them'} so I can still turn ${titles.length === 1 ? 'it' : 'them'} in, even for partial credit? I can have ${titles.length === 1 ? 'it' : 'everything'} done by ${opts.byDate}.

Thank you for your time,
${opts.student}`,
  }
}
