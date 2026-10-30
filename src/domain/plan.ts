import { differenceInCalendarDays, differenceInHours } from 'date-fns'
import { isAssignmentDone } from './assignments'
import { parseInstant } from './dates'
import { buildGuide, type ClassGuide, type TurnIn } from './guide'
import type { Assignment, Course, CourseModule, GradeRecord, ModuleItem } from './types'

/**
 * The study plan: everything that protects or raises grades, as one card at a time.
 * Rule-based. Order:
 *   1. Turn in late work that closes within a day
 *   2. Emails asking teachers to reopen closed work (teachers need time to answer)
 *   3. The rest of the late work that's still open, most valuable first
 *   4. Learn what you missed: lessons from the modules of closed work
 *   5. Study for tests in the next two weeks: the class's unfinished lessons
 *   6. Ask about corrections or retakes in a heavy, low category
 */

export type PlanCard =
  | { id: string; kind: 'turn-in'; course: Course; t: TurnIn }
  | { id: string; kind: 'email'; course: Course; items: Assignment[] }
  | { id: string; kind: 'learn'; course: Course; module: CourseModule; lessons: ModuleItem[]; missed: Assignment[] }
  | { id: string; kind: 'study'; course: Course; exam: Assignment; lessons: Array<{ module: CourseModule; item: ModuleItem }>; days: number }
  | { id: string; kind: 'ask-help'; course: Course; category: { name: string; weight: number; percent: number } }

const LESSON_TYPES = new Set(['reading', 'lecture', 'page', 'file', 'link'])
export const STUDY_WINDOW_DAYS = 14

const isLesson = (i: ModuleItem) => LESSON_TYPES.has(i.type)

export interface PlanInput {
  courses: Course[]
  assignments: Assignment[]
  grades: GradeRecord[]
  modules: CourseModule[]
  /** Plan cards the student finished (emails sent, lessons learned...). Turn-in cards finish when the work is done. */
  done: Set<string>
}

export function buildPlan({ courses, assignments, grades, modules, done }: PlanInput, now: Date): PlanCard[] {
  const guide = buildGuide(courses, assignments, grades, now)
  const urgent: PlanCard[] = []
  const emails: PlanCard[] = []
  const turnIns: PlanCard[] = []
  const learn: PlanCard[] = []
  const study: PlanCard[] = []
  const help: PlanCard[] = []

  for (const g of guide as ClassGuide[]) {
    for (const t of g.turnIn) {
      const card: PlanCard = { id: `turn-in:${t.a.id}`, kind: 'turn-in', course: g.course, t }
      if (t.closesAt && differenceInHours(t.closesAt, now) <= 24) urgent.push(card)
      else turnIns.push(card)
    }
    if (g.closed.length) emails.push({ id: `email:${g.course.id}:${g.closed.map((a) => a.id).sort().join(',')}`, kind: 'email', course: g.course, items: g.closed })

    // What you missed: lessons in the modules of closed work, still worth learning for tests.
    const missedModules = new Map<string, Assignment[]>()
    for (const a of g.closed) if (a.moduleId) missedModules.set(a.moduleId, [...(missedModules.get(a.moduleId) ?? []), a])
    for (const [moduleId, missed] of missedModules) {
      const module = modules.find((m) => m.id === moduleId)
      const lessons = module?.items.filter((i) => isLesson(i) && !i.completed) ?? []
      if (module && lessons.length) learn.push({ id: `learn:${module.id}`, kind: 'learn', course: g.course, module, lessons, missed })
    }

    if (g.focus) help.push({ id: `ask-help:${g.course.id}:${g.focus.name}`, kind: 'ask-help', course: g.course, category: g.focus })
  }

  // Tests coming up: the class's unfinished lessons, newest modules first.
  for (const exam of assignments) {
    if (exam.type !== 'exam' || isAssignmentDone(exam)) continue
    const due = parseInstant(exam.dueAt)
    if (!due) continue
    const days = differenceInCalendarDays(due, now)
    if (days < 0 || days > STUDY_WINDOW_DAYS) continue
    const course = courses.find((c) => c.id === exam.courseId)
    if (!course || course.status !== 'active') continue
    const lessons = modules
      .filter((m) => m.courseId === course.id)
      .sort((a, b) => b.position - a.position)
      .flatMap((module) => module.items.filter((i) => isLesson(i) && !i.completed).map((item) => ({ module, item })))
      .slice(0, 6)
    study.push({ id: `study:${exam.id}`, kind: 'study', course, exam, lessons, days })
  }
  study.sort((a, b) => (a.kind === 'study' && b.kind === 'study' ? a.days - b.days : 0))

  urgent.sort((a, b) => (a.kind === 'turn-in' && b.kind === 'turn-in' ? a.t.closesAt!.getTime() - b.t.closesAt!.getTime() : 0))
  turnIns.sort((a, b) => (a.kind === 'turn-in' && b.kind === 'turn-in' ? Number(b.t.closesSoon) - Number(a.t.closesSoon) || (b.t.worth ?? 0) - (a.t.worth ?? 0) : 0))

  return [...urgent, ...emails, ...turnIns, ...learn, ...study, ...help].filter((c) => !done.has(c.id) && !(c.kind === 'learn' && c.lessons.every((l) => l.completed)))
}

/** A polite email asking about corrections, retakes or extra credit. */
export function helpEmail(opts: { teacher: string | null; course: string; category: string; student: string }): { subject: string; body: string } {
  return {
    subject: `${opts.course}: how can I improve my ${opts.category.toLowerCase()} grade?`,
    body: `${opts.teacher ? `Hi ${opts.teacher},` : 'Hello,'}

I’m ${opts.student} from your ${opts.course} class. My ${opts.category.toLowerCase()} grade is lower than I want, and I’d like to work on it.

Do you offer corrections, a retake, or any extra credit for ${opts.category.toLowerCase()}? I’d also be grateful for any advice on how to prepare better for the next one.

Thank you,
${opts.student}`,
  }
}
