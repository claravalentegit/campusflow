import { differenceInCalendarDays, startOfDay, subDays } from 'date-fns'
import { isAssignmentDone, tasksForAssignment } from './assignments'
import { parseInstant, toLocalDay } from './dates'
import type { Assignment, ISODateTime, StudyTask } from './types'

/**
 * CampusFlow's game layer. Pure functions only.
 *
 * - XP is a ledger of events, so undoing a completion removes exactly the XP it gave.
 * - Bigger work is worth more. Late work still earns XP, but half.
 * - A "gold day" is a day where you completed at least your daily goal of things.
 * - Your streak counts consecutive gold days (today counts once it turns gold).
 */

export type XpKind = 'assignment' | 'task' | 'focus' | 'quest' | 'rescue'

export interface XpEvent {
  id: string
  at: ISODateTime
  amount: number
  kind: XpKind
  /** The assignment, task or session this came from. Used to undo. */
  refId: string
  late?: boolean
  early?: boolean
  boss?: boolean
}

export interface EarnedBadge {
  id: BadgeId
  at: ISODateTime
}

const round5 = (n: number) => Math.round(n / 5) * 5
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function isBoss(a: Pick<Assignment, 'estimatedMinutes' | 'type' | 'id'>, tasks: StudyTask[] = []): boolean {
  if (a.type === 'exam') return true
  if ((a.estimatedMinutes ?? 0) >= 360) return true
  return tasksForAssignment(tasks, a.id).length >= 4
}

/** Full XP an assignment is worth (before any late penalty). */
export function assignmentXp(a: Pick<Assignment, 'estimatedMinutes' | 'type' | 'id'>, tasks: StudyTask[] = []): number {
  const base = a.estimatedMinutes ? clamp(round5(a.estimatedMinutes / 3), 10, 300) : 30
  return isBoss(a, tasks) ? Math.max(base, 100) : base
}

export function taskXp(t: Pick<StudyTask, 'estimatedMinutes'>): number {
  return clamp(round5((t.estimatedMinutes ?? 30) / 3), 5, 100)
}

export function isLateAt(dueAt: string | null, at: Date): boolean {
  const due = parseInstant(dueAt)
  return !!due && at.getTime() > due.getTime()
}

/** XP for completing it right now. */
export function xpForAssignmentNow(a: Assignment, tasks: StudyTask[], now: Date): number {
  const full = assignmentXp(a, tasks)
  return isLateAt(a.dueAt, now) ? Math.max(5, round5(full / 2)) : full
}

export function xpForTaskNow(t: StudyTask, parent: Assignment | undefined, now: Date): number {
  const full = taskXp(t)
  const late = isLateAt(t.dueAt ?? parent?.dueAt ?? null, now)
  return late ? Math.max(5, round5(full / 2)) : full
}

export const QUEST_BONUS = 50

// ——— Levels ———

/** Total XP needed to reach `level` (level 1 starts at 0). Each level needs 100 more than the last. */
export function xpToReach(level: number): number {
  return 50 * (level - 1) * level
}

export function levelFor(totalXp: number): { level: number; into: number; needed: number; progress: number } {
  let level = 1
  while (xpToReach(level + 1) <= totalXp) level++
  const into = totalXp - xpToReach(level)
  const needed = xpToReach(level + 1) - xpToReach(level)
  return { level, into, needed, progress: into / needed }
}

const TITLES = [
  'Fresh Start',
  'Note Taker',
  'Planner',
  'Study Strategist',
  'Focus Knight',
  'Deadline Slayer',
  'Syllabus Sage',
  'Dean’s List',
  'Scholar',
  'Campus Legend',
]
export function levelTitle(level: number): string {
  return TITLES[Math.min(level, TITLES.length) - 1]
}

export function totalXp(events: XpEvent[]): number {
  return events.reduce((s, e) => s + e.amount, 0)
}

// ——— Daily quest & streak ———

const COMPLETION_KINDS: XpKind[] = ['assignment', 'task']

export function completionsOn(events: XpEvent[], day: Date): number {
  const key = toLocalDay(day)
  return events.filter((e) => COMPLETION_KINDS.includes(e.kind) && toLocalDay(new Date(e.at)) === key).length
}

export function xpOn(events: XpEvent[], day: Date): number {
  const key = toLocalDay(day)
  return events.filter((e) => toLocalDay(new Date(e.at)) === key).reduce((s, e) => s + e.amount, 0)
}

export function isGoldDay(events: XpEvent[], day: Date, goal: number): boolean {
  return completionsOn(events, day) >= goal
}

/** Consecutive gold days ending today, or ending yesterday if today isn't gold yet (the streak is still alive). */
export function streak(events: XpEvent[], now: Date, goal: number): { days: number; todayDone: boolean } {
  const todayDone = isGoldDay(events, now, goal)
  let day = todayDone ? startOfDay(now) : subDays(startOfDay(now), 1)
  let days = 0
  while (isGoldDay(events, day, goal) && days < 3650) {
    days++
    day = subDays(day, 1)
  }
  return { days, todayDone }
}

// ——— Badges ———

export type BadgeId = 'first-step' | 'early-bird' | 'night-owl' | 'ahead' | 'boss-slayer' | 'comeback' | 'on-fire' | 'unstoppable' | 'deep-focus' | 'thousand'

export interface BadgeDef {
  id: BadgeId
  name: string
  description: string
  icon: 'footprints' | 'sunrise' | 'moon' | 'rocket' | 'crown' | 'heart' | 'flame' | 'zap' | 'brain' | 'gem'
  color: 'gold' | 'purple' | 'fire' | 'green' | 'blue' | 'pink'
}

export const BADGES: BadgeDef[] = [
  { id: 'first-step', name: 'First Step', description: 'Complete anything', icon: 'footprints', color: 'green' },
  { id: 'early-bird', name: 'Early Bird', description: 'Finish something before 9 AM', icon: 'sunrise', color: 'gold' },
  { id: 'night-owl', name: 'Night Owl', description: 'Finish something after 11 PM', icon: 'moon', color: 'blue' },
  { id: 'ahead', name: 'Ahead of the Game', description: 'Complete an assignment 2+ days early', icon: 'rocket', color: 'purple' },
  { id: 'boss-slayer', name: 'Boss Slayer', description: 'Defeat a boss level', icon: 'crown', color: 'purple' },
  { id: 'comeback', name: 'Comeback Kid', description: 'Catch up on late work', icon: 'heart', color: 'pink' },
  { id: 'on-fire', name: 'On Fire', description: 'Reach a 3-day streak', icon: 'flame', color: 'fire' },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Reach a 7-day streak', icon: 'zap', color: 'fire' },
  { id: 'deep-focus', name: 'Deep Focus', description: 'Finish 5 focus sessions', icon: 'brain', color: 'blue' },
  { id: 'thousand', name: 'Thousand Club', description: 'Earn 1,000 XP', icon: 'gem', color: 'gold' },
]

export function badgeDef(id: BadgeId): BadgeDef {
  return BADGES.find((b) => b.id === id) as BadgeDef
}

/** Badges whose conditions are met by the current data. */
export function qualifyingBadges(events: XpEvent[], now: Date, goal: number): Set<BadgeId> {
  const out = new Set<BadgeId>()
  const completions = events.filter((e) => COMPLETION_KINDS.includes(e.kind))
  if (completions.length) out.add('first-step')
  if (completions.some((e) => new Date(e.at).getHours() < 9)) out.add('early-bird')
  if (completions.some((e) => new Date(e.at).getHours() >= 23)) out.add('night-owl')
  if (events.some((e) => e.kind === 'assignment' && e.early)) out.add('ahead')
  if (events.some((e) => e.kind === 'assignment' && e.boss)) out.add('boss-slayer')
  if (completions.some((e) => e.late)) out.add('comeback')
  const s = streak(events, now, goal).days
  if (s >= 3) out.add('on-fire')
  if (s >= 7) out.add('unstoppable')
  if (events.filter((e) => e.kind === 'focus').length >= 5) out.add('deep-focus')
  if (totalXp(events) >= 1000) out.add('thousand')
  return out
}

/** Build the XP event for completing an assignment now. */
export function assignmentEvent(a: Assignment, tasks: StudyTask[], now: Date, id: string): XpEvent {
  const due = parseInstant(a.dueAt)
  return {
    id,
    at: now.toISOString(),
    amount: xpForAssignmentNow(a, tasks, now),
    kind: 'assignment',
    refId: a.id,
    late: isLateAt(a.dueAt, now),
    early: !!due && differenceInCalendarDays(due, now) >= 2,
    boss: isBoss(a, tasks),
  }
}

export function taskEvent(t: StudyTask, parent: Assignment | undefined, now: Date, id: string): XpEvent {
  return { id, at: now.toISOString(), amount: xpForTaskNow(t, parent, now), kind: 'task', refId: t.id, late: isLateAt(t.dueAt ?? parent?.dueAt ?? null, now) }
}

/** How far along a course is: share of its assignments done (by XP weight). */
export function courseMastery(assignments: Assignment[], tasks: StudyTask[]): number {
  const total = assignments.reduce((s, a) => s + assignmentXp(a, tasks), 0)
  if (!total) return 0
  return assignments.filter(isAssignmentDone).reduce((s, a) => s + assignmentXp(a, tasks), 0) / total
}
