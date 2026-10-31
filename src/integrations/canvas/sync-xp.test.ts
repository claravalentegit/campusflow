import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/store/appStore'
import { mapCanvasSnapshot } from './mapping'
import type { CanvasRawSnapshot } from './types'

const snapshot = (submittedAt: string | null): CanvasRawSnapshot => ({
  fetchedAt: new Date().toISOString(),
  events: [],
  courses: [
    {
      course: { id: 1, name: 'Linear Algebra', course_code: 'MATH 415' },
      assignmentGroups: [],
      modules: [],
      announcements: [],
      assignments: [
        { id: 10, course_id: 1, name: 'Homework 6', description: null, due_at: new Date(Date.now() + 86400000).toISOString(), points_possible: 20, html_url: 'https://x/10', submission: submittedAt ? { workflow_state: 'submitted', submitted_at: submittedAt } : { workflow_state: 'unsubmitted', submitted_at: null } },
        { id: 11, course_id: 1, name: 'Homework 5', description: null, due_at: new Date(Date.now() - 86400000 * 5).toISOString(), points_possible: 20, html_url: 'https://x/11', submission: { workflow_state: 'graded', submitted_at: new Date(Date.now() - 86400000 * 6).toISOString(), score: 18 } },
      ],
    },
  ],
})
const account = { userName: 'Jordan', baseHost: 'canvas.test' }

describe('Canvas sync: turned-in work', () => {
  beforeEach(() => useStore.getState().startEmpty())

  it('imports without paying XP for work submitted before connecting', () => {
    const r = useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(null)), account)
    expect(r).toMatchObject({ courses: 1, assignments: 2, turnedIn: [] })
    expect(useStore.getState().prefs.toClaim).toEqual([])
    expect(useStore.getState().prefs).toMatchObject({ dataMode: 'canvas', canvasUser: 'Jordan', canvasHost: 'canvas.test' })
    expect(useStore.getState().xpEvents).toHaveLength(0)
  })

  it('lists a new Canvas submission to cross off, and pays its XP once when crossed off', () => {
    useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(null)), account)
    const later = new Date(Date.now() + 1000).toISOString()
    const r = useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(later)), account)
    expect(r.turnedIn).toEqual(['cv_asg_10'])
    expect(useStore.getState().xpEvents).toHaveLength(0)
    expect(useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(later)), account).turnedIn).toEqual([])
    const events = useStore.getState().claimTurnedIn(['cv_asg_10'])
    expect(events[0]).toMatchObject({ kind: 'assignment', refId: 'cv_asg_10', late: false })
    expect(useStore.getState().prefs.toClaim).toEqual([])
    expect(useStore.getState().claimTurnedIn(['cv_asg_10'])).toEqual([])
    expect(useStore.getState().xpEvents).toHaveLength(1)
  })

  it('lists work Canvas shows as done without a turn-in time (graded by the teacher)', () => {
    useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(null)), account)
    const graded = mapCanvasSnapshot(snapshot(null))
    graded.assignments = graded.assignments.map((a) => (a.id === 'cv_asg_10' ? { ...a, canvasSubmission: { ...a.canvasSubmission!, state: 'graded' } } : a))
    expect(useStore.getState().applyCanvasSync(graded, account).turnedIn).toEqual(['cv_asg_10'])
  })

  it('catches up once on turned-in work that never earned XP', () => {
    useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(null)), account)
    useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(new Date().toISOString())), account)
    // As if an older version skipped it (and this student connected before the catch-up existed).
    useStore.setState((s) => ({ prefs: { ...s.prefs, toClaim: [], turnedInRecovered: false } }))
    expect(useStore.getState().recoverTurnedIn()).toBe(2) // Homework 6 and the recently graded Homework 5
    expect(useStore.getState().recoverTurnedIn()).toBe(0)
  })

  it('does not pay again if the student already checked it off here', () => {
    useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(null)), account)
    useStore.getState().setAssignmentStatus('cv_asg_10', 'completed')
    const r = useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(new Date(Date.now() + 1000).toISOString())), account)
    expect(r.turnedIn).toEqual([])
    expect(useStore.getState().xpEvents.filter((e) => e.refId === 'cv_asg_10')).toHaveLength(1)
  })
})
