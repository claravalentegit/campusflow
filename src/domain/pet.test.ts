import { describe, expect, it } from 'vitest'
import type { XpEvent } from './game'
import { petMood, petStage } from './pet'
import { lateOpen, rescueOrder, rescueSteps } from './rescue'
import type { Assignment } from './types'

const NOW = new Date(2026, 9, 28, 15, 0)
const at = (d: number, h = 15) => new Date(2026, 9, 28 + d, h, 0).toISOString()
const a = (p: Partial<Assignment> = {}) => ({ id: 'a', courseId: 'c', title: 'A', description: '', dueAt: at(2), priority: 'medium', estimatedMinutes: 60, status: 'not_started', type: 'essay', submissionInstructions: '', rubricNotes: '', links: [], personalNotes: '', pointsPossible: null, gradeCategoryId: null, moduleId: null, canvasSubmission: null, source: 'manual', canvasId: null, htmlUrl: null, completedAt: null, createdAt: at(-9), updatedAt: at(-9), ...p }) as Assignment
const ev = (d: number): XpEvent => ({ id: String(d), at: at(d), amount: 10, kind: 'task', refId: 'x' })

describe('pet', () => {
  it('grows with the level', () => {
    expect(petStage(1).stage).toBe('egg')
    expect(petStage(3)).toMatchObject({ stage: 'baby', next: { label: 'Kid', at: 4 } })
    expect(petStage(6).stage).toBe('teen')
    expect(petStage(40)).toMatchObject({ stage: 'legend', next: null })
  })
  it('mood follows late work, then activity', () => {
    const late = (id: string) => a({ id, dueAt: at(-1) })
    expect(petMood([late('1'), late('2')], [ev(0)], NOW)).toEqual({ mood: 'worried', late: 2 })
    expect(petMood([late('1'), a({ id: '2' })], [ev(0)], NOW).mood).toBe('ok')
    expect(petMood([a()], [ev(-3)], NOW).mood).toBe('sleepy')
    expect(petMood([a()], [ev(-1)], NOW).mood).toBe('happy')
    expect(petMood([], [], NOW).mood).toBe('happy')
  })
})

describe('rescue plan', () => {
  const list = [
    a({ id: 'big', title: 'Lab', estimatedMinutes: 180, dueAt: at(-4) }),
    a({ id: 'small', title: 'Post', estimatedMinutes: 15, dueAt: at(-1) }),
    a({ id: 'mid', title: 'HW', estimatedMinutes: 40, dueAt: at(-2) }),
    a({ id: 'done', estimatedMinutes: 10, dueAt: at(-2), status: 'completed', completedAt: at(-1) }),
    a({ id: 'future', estimatedMinutes: 5, dueAt: at(3) }),
  ]
  it('only includes open late work, smallest first', () => {
    expect(rescueOrder(lateOpen(list, NOW))).toEqual(['small', 'mid', 'big'])
  })
  it('spreads the work over days within the daily budget', () => {
    const steps = rescueSteps(['small', 'mid', 'big'], list, NOW, 120)
    expect(steps.map((s) => s.days.length)).toEqual([1, 1, 2])
    expect(steps[0].days[0]).toBe('2026-10-28')
    expect(steps[2].days).toEqual(['2026-10-28', '2026-10-29'])
  })
  it('keeps finished steps in place without days, and skips deleted ones', () => {
    const steps = rescueSteps(['done', 'gone', 'small'], list, NOW)
    expect(steps.map((s) => [s.assignmentId, s.done, s.days.length])).toEqual([
      ['done', true, 0],
      ['small', false, 1],
    ])
  })
})
