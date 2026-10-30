import { addDays, format, isWeekend, parse } from 'date-fns'
import { summarizeCourseGrades } from './grades'
import type { Assignment, Course, GradeRecord } from './types'

/**
 * Reward goals: a parent sets a goal and a real-life reward ("2 things a day for 15 school days → $20").
 * Pure functions only. Progress comes from what the student actually finished, so nobody has to
 * report it. CampusFlow never handles the reward itself: the parent gives it and taps "I gave it".
 */

export type GoalRule =
  | { kind: 'streak'; perDay: number; days: number; weekdaysOnly: boolean }
  | { kind: 'total'; count: number; by: string }
  | { kind: 'grade'; courseId: string; courseName: string; percent: number; by: string | null }

export interface RewardGoal {
  id: string
  parentId: string
  parentName: string
  createdAt: string
  /** Local day ("yyyy-MM-dd") the goal starts counting from. Earlier work doesn't count. */
  startDay: string
  rule: GoalRule
  reward: string
  emoji: string
  status: 'active' | 'given' | 'cancelled'
  givenAt: string | null
}

export interface GoalData {
  /** When the student finished things (assignments and tasks), as ISO instants. */
  completions: string[]
  courses: Course[]
  grades: GradeRecord[]
  assignments: Assignment[]
}

export interface GoalProgress {
  value: number
  target: number
  unit: 'days' | 'things' | 'percent'
  reached: boolean
  /** The deadline passed without reaching the goal. */
  missed: boolean
  /** Streaks: the longest run so far (the current one may have restarted). */
  best?: number
}

export const REWARD_EMOJIS = ['💵', '🎮', '🍕', '🎬', '🛍️', '📱', '🎁', '⭐'] as const

const day = (d: Date) => format(d, 'yyyy-MM-dd')
const parseDay = (s: string) => parse(s, 'yyyy-MM-dd', new Date())

export function goalProgress(goal: RewardGoal, data: GoalData, now: Date): GoalProgress {
  const today = day(now)
  const counts = new Map<string, number>()
  for (const at of data.completions) {
    const d = day(new Date(at))
    if (d >= goal.startDay && d <= today) counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  const r = goal.rule
  if (r.kind === 'streak') {
    let run = 0
    let best = 0
    for (let d = parseDay(goal.startDay); day(d) <= today; d = addDays(d, 1)) {
      if (r.weekdaysOnly && isWeekend(d)) continue
      const ok = (counts.get(day(d)) ?? 0) >= r.perDay
      if (ok) best = Math.max(best, ++run)
      else if (day(d) !== today) run = 0 // today isn't over yet, so it can't break the streak
    }
    return { value: Math.min(run, r.days), target: r.days, unit: 'days', reached: best >= r.days, missed: false, best }
  }
  if (r.kind === 'total') {
    let n = 0
    for (const [d, c] of counts) if (d <= r.by) n += c
    const reached = n >= r.count
    return { value: Math.min(n, r.count), target: r.count, unit: 'things', reached, missed: !reached && today > r.by }
  }
  const course = data.courses.find((c) => c.id === r.courseId)
  const pct = course ? summarizeCourseGrades(course, data.grades.filter((g) => g.courseId === course.id), data.assignments.filter((a) => a.courseId === course.id)).currentPercent : null
  const reached = pct != null && pct >= r.percent
  return { value: pct == null ? 0 : Math.round(pct * 10) / 10, target: r.percent, unit: 'percent', reached, missed: !reached && !!r.by && today > r.by }
}

/** Goals worth showing: active ones, and rewards given in the last week. */
export function visibleGoals(goals: RewardGoal[], now: Date): RewardGoal[] {
  return goals.filter((g) => g.status === 'active' || (g.status === 'given' && g.givenAt && now.getTime() - new Date(g.givenAt).getTime() < 7 * 86_400_000))
}
