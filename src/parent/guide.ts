import { differenceInCalendarDays } from 'date-fns'
import { isAssignmentDone, lockState } from '@/domain/assignments'
import { parseInstant } from '@/domain/dates'
import { summarizeCourseGrades } from '@/domain/grades'
import { buildGuide, lateOpen } from '@/domain/guide'
import type { Assignment, Course } from '@/domain/types'
import type { FamilySnapshot } from '@/integrations/family'

/**
 * The parent's weekly guide: a few cards, one at a time, that help a parent understand the week and
 * talk about it kindly. Rule-based. Order:
 *   1. Start with the good (always first)
 *   2. What the Canvas words mean, only the ones that show up in their student's work right now
 *   3. Up to 3 things that really matter this week, each with words to say and words to avoid
 *   4. How to help
 */

export type Term = 'late' | 'missing' | 'closed' | 'waiting' | 'skipped' | 'weighted'
export type Situation = 'late' | 'closed' | 'big'

type Item = FamilySnapshot['assignments'][number]

export type ParentCard =
  | { id: 'good'; kind: 'good'; done: number; streak: number; best: { name: string; percent: number } | null; calm: boolean }
  | { id: string; kind: 'term'; term: Term; examples: string[] }
  | { id: string; kind: 'focus'; situation: Situation; a: Assignment; course: Course; worth: number | null; date: Date | null }
  | { id: 'help'; kind: 'help' }

const isSubmitted = (a: Item) => ['submitted', 'graded', 'pending_review'].includes(a.canvasSubmission?.state ?? '')

export function buildParentGuide(data: FamilySnapshot, now: Date): ParentCard[] {
  const items = data.assignments
  const active = items.filter((a) => !a.skipped)
  const courses = data.courses.filter((c) => c.status === 'active' && !c.hidden)
  const graded = new Set(data.grades.map((g) => g.assignmentId))
  const title = (a: Item) => a.title
  const cards: ParentCard[] = []

  // 1. The good.
  const done = data.completions.filter((at) => now.getTime() - new Date(at).getTime() < 7 * 86_400_000).length
  const best = courses
    .map((c) => ({ name: c.name, percent: summarizeCourseGrades(c, data.grades.filter((g) => g.courseId === c.id), active.filter((a) => a.courseId === c.id)).currentPercent }))
    .filter((x): x is { name: string; percent: number } => x.percent != null)
    .sort((a, b) => b.percent - a.percent)[0]
  const guide = buildGuide(courses, active, data.grades, now)
  const calm = !guide.some((g) => g.turnIn.length || g.closed.length)
  cards.push({ id: 'good', kind: 'good', done, streak: data.student.streak, best: best ?? null, calm })

  // 2. Words that show up in their work right now.
  const terms: Array<[Term, Item[]]> = [
    ['late', lateOpen(active, now)],
    ['missing', active.filter((a) => a.canvasSubmission?.state === 'missing' && !isAssignmentDone(a))],
    ['closed', active.filter((a) => !isAssignmentDone(a) && !graded.has(a.id) && lockState(a, now)?.kind === 'closed')],
    ['waiting', active.filter((a) => isSubmitted(a) && !graded.has(a.id))],
    ['skipped', items.filter((a) => a.skipped)],
  ]
  for (const [term, list] of terms) if (list.length) cards.push({ id: `term:${term}`, kind: 'term', term, examples: list.slice(0, 2).map(title) })
  const weighted = courses.find((c) => c.gradeCategories.length > 1 && c.gradeCategories.some((k) => k.weight > 0))
  if (weighted) {
    const top = [...weighted.gradeCategories].sort((a, b) => b.weight - a.weight)
    cards.push({ id: 'term:weighted', kind: 'term', term: 'weighted', examples: [weighted.name, ...top.slice(0, 2).map((k) => `${k.name} ${k.weight}%`)] })
  }

  // 3. What really matters: late work that can still be turned in, closed work to ask about, big work coming up.
  const focus: ParentCard[] = []
  for (const g of guide) for (const t of g.turnIn) focus.push({ id: `focus:${t.a.id}`, kind: 'focus', situation: 'late', a: t.a, course: g.course, worth: t.worth, date: t.closesAt })
  focus.sort((x, y) => (x.kind === 'focus' && y.kind === 'focus' ? (x.date?.getTime() ?? Infinity) - (y.date?.getTime() ?? Infinity) || (y.worth ?? 0) - (x.worth ?? 0) : 0))
  for (const g of guide) if (g.closed[0]) focus.push({ id: `focus:${g.closed[0].id}`, kind: 'focus', situation: 'closed', a: g.closed[0], course: g.course, worth: null, date: null })
  const big = active
    .filter((a) => !isAssignmentDone(a) && !isSubmitted(a) && (a.type === 'exam' || a.type === 'project' || (a.estimatedMinutes ?? 0) >= 180))
    .map((a) => ({ a, due: parseInstant(a.dueAt) }))
    .filter((x) => x.due && differenceInCalendarDays(x.due, now) >= 0 && differenceInCalendarDays(x.due, now) <= 7)
    .sort((x, y) => x.due!.getTime() - y.due!.getTime())
  for (const { a, due } of big) {
    const course = courses.find((c) => c.id === a.courseId)
    if (course) focus.push({ id: `focus:${a.id}`, kind: 'focus', situation: 'big', a, course, worth: null, date: due })
  }
  cards.push(...focus.slice(0, 3))

  // 4. How to help.
  cards.push({ id: 'help', kind: 'help' })
  return cards
}

/** A stable key for the current week, so the guide starts fresh every Monday. */
export function weekKey(now: Date): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
