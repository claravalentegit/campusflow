import { describe, expect, it } from 'vitest'
import { buildDemoData } from '@/data/demo'
import { assignmentEvent, assignmentXp, completionsOn, isBoss, levelFor, qualifyingBadges, streak, taskXp, totalXp, xpForAssignmentNow, xpToReach, type XpEvent } from './game'
import type { Assignment } from './types'

const NOW = new Date(2026, 9, 28, 15, 0)
const at = (d: number, h = 15) => new Date(2026, 9, 28 + d, h, 0).toISOString()
const a = (p: Partial<Assignment> = {}) => ({ id: 'a', courseId: 'c', title: 'A', description: '', dueAt: at(2), priority: 'medium', estimatedMinutes: 120, status: 'not_started', type: 'essay', submissionInstructions: '', rubricNotes: '', links: [], personalNotes: '', pointsPossible: null, gradeCategoryId: null, moduleId: null, canvasSubmission: null, source: 'manual', canvasId: null, htmlUrl: null, completedAt: null, createdAt: at(-5), updatedAt: at(-5), ...p }) as Assignment
const ev = (d: number, kind: XpEvent['kind'] = 'task', amount = 20, h = 15): XpEvent => ({ id: `${d}-${Math.random()}`, at: at(d, h), amount, kind, refId: 'x' })

describe('XP values', () => {
  it('scales with effort and gives bosses at least 100', () => {
    expect(assignmentXp(a({ estimatedMinutes: 30 }))).toBe(10)
    expect(assignmentXp(a({ estimatedMinutes: 150 }))).toBe(50)
    expect(assignmentXp(a({ estimatedMinutes: null }))).toBe(30)
    expect(assignmentXp(a({ estimatedMinutes: 2000 }))).toBe(300)
    expect(isBoss(a({ type: 'exam', estimatedMinutes: 60 }))).toBe(true)
    expect(assignmentXp(a({ type: 'exam', estimatedMinutes: 60 }))).toBe(100)
    expect(taskXp({ estimatedMinutes: 90 })).toBe(30)
  })
  it('halves XP for late work but never below 5', () => {
    expect(xpForAssignmentNow(a({ dueAt: at(-1), estimatedMinutes: 150 }), [], NOW)).toBe(25)
    expect(xpForAssignmentNow(a({ dueAt: at(-1), estimatedMinutes: 15 }), [], NOW)).toBe(5)
    const e = assignmentEvent(a({ dueAt: at(-1) }), [], NOW, 'id')
    expect(e.late).toBe(true)
    expect(assignmentEvent(a({ dueAt: at(5) }), [], NOW, 'id').early).toBe(true)
  })
})

describe('levels', () => {
  it('needs 100 more XP per level', () => {
    expect([1, 2, 3, 4].map(xpToReach)).toEqual([0, 100, 300, 600])
    expect(levelFor(0)).toMatchObject({ level: 1, into: 0, needed: 100 })
    expect(levelFor(299)).toMatchObject({ level: 2, into: 199, needed: 200 })
    expect(levelFor(300).level).toBe(3)
  })
})

describe('streaks and the daily quest', () => {
  it('counts consecutive gold days and keeps the streak alive until today ends', () => {
    const events = [-3, -2, -1].flatMap((d) => [ev(d), ev(d), ev(d)])
    expect(streak(events, NOW, 3)).toEqual({ days: 3, todayDone: false })
    const withToday = [...events, ev(0), ev(0), ev(0)]
    expect(streak(withToday, NOW, 3)).toEqual({ days: 4, todayDone: true })
  })
  it('breaks on a missed day and ignores focus/quest XP for completion counts', () => {
    const events = [ev(-3), ev(-3), ev(-3), ev(-1), ev(-1), ev(-1), ev(0, 'focus'), ev(0, 'quest')]
    expect(streak(events, NOW, 3).days).toBe(1)
    expect(completionsOn(events, NOW)).toBe(0)
  })
})

describe('badges', () => {
  it('unlocks from what actually happened', () => {
    const b = qualifyingBadges([{ ...ev(0, 'assignment', 30, 7), late: true }], NOW, 3)
    expect(b.has('first-step')).toBe(true)
    expect(b.has('early-bird')).toBe(true)
    expect(b.has('comeback')).toBe(true)
    expect(b.has('boss-slayer')).toBe(false)
    expect(qualifyingBadges([], NOW, 3).size).toBe(0)
  })
})

describe('demo game state', () => {
  it('starts mid-semester with a 5-day streak and an unplayed today', () => {
    const d = buildDemoData(NOW)
    expect(streak(d.xpEvents, NOW, 3)).toEqual({ days: 5, todayDone: false })
    expect(levelFor(totalXp(d.xpEvents)).level).toBeGreaterThanOrEqual(5)
    expect(d.badges.map((x) => x.id)).toContain('on-fire')
  })
})
