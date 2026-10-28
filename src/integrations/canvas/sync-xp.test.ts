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

describe('Canvas sync XP', () => {
  beforeEach(() => useStore.getState().startEmpty())

  it('imports without paying XP for work submitted before connecting', () => {
    const r = useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(null)), account)
    expect(r).toMatchObject({ courses: 1, assignments: 2, events: [] })
    expect(useStore.getState().prefs).toMatchObject({ dataMode: 'canvas', canvasUser: 'Jordan', canvasHost: 'canvas.test' })
    expect(useStore.getState().xpEvents).toHaveLength(0)
  })

  it('pays XP once for a new Canvas submission after connecting', () => {
    useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(null)), account)
    const later = new Date(Date.now() + 1000).toISOString()
    const r = useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(later)), account)
    expect(r.events).toHaveLength(1)
    expect(r.events[0]).toMatchObject({ kind: 'assignment', refId: 'cv_asg_10', late: false })
    const again = useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(later)), account)
    expect(again.events).toHaveLength(0)
    expect(useStore.getState().xpEvents).toHaveLength(1)
  })

  it('does not pay again if the student already checked it off here', () => {
    useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(null)), account)
    useStore.getState().setAssignmentStatus('cv_asg_10', 'completed')
    const r = useStore.getState().applyCanvasSync(mapCanvasSnapshot(snapshot(new Date(Date.now() + 1000).toISOString())), account)
    expect(r.events).toHaveLength(0)
    expect(useStore.getState().xpEvents.filter((e) => e.refId === 'cv_asg_10')).toHaveLength(1)
  })
})
