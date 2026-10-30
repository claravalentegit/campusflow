import { useEffect, useRef } from 'react'
import { levelFor, streak, totalXp } from '@/domain/game'
import type { Announcement, Assignment, Course, GradeRecord } from '@/domain/types'
import { call } from '@/integrations/canvas/adapter'
import { useStore, type AppState } from '@/store/appStore'

/**
 * Family sharing, the student's side. The student links parent devices with a code; their app then
 * uploads a snapshot of what CampusFlow shows (every class, assignment, grade and announcement, plus
 * progress). Private notes are never included.
 */

export interface ParentLink {
  id: string
  name: string
  linkedAt: string
  lastSeenAt: string | null
}

export interface FamilySnapshot {
  v: 1
  student: { name: string; level: number; xp: number; streak: number; dailyGoal: number; pet: string | null }
  courses: Course[]
  assignments: Array<Assignment & { skipped?: boolean; stages?: { done: number; total: number } }>
  grades: GradeRecord[]
  announcements: Announcement[]
  /** Things finished per day, last 14 days, for "done this week". */
  completions: string[]
}

export const familyApi = {
  overview: () => call<{ parents: ParentLink[]; snapshotAt: string | null }>('/api/family'),
  createCode: () => call<{ code: string; expiresAt: number }>('/api/family/code', { method: 'POST', body: '{}' }),
  remove: (parentId: string) => call<{ parents: ParentLink[] }>('/api/family/remove', { method: 'POST', body: JSON.stringify({ parentId }) }),
  upload: (data: FamilySnapshot) => call<{ stored: boolean; parents: number }>('/api/family/snapshot', { method: 'POST', body: JSON.stringify({ data }) }),
}

export function buildSnapshot(s: AppState, now = new Date()): FamilySnapshot {
  const xp = totalXp(s.xpEvents)
  const stagesFor = (id: string) => {
    const steps = s.tasks.filter((t) => t.assignmentId === id)
    return steps.length ? { done: steps.filter((t) => t.done).length, total: steps.length } : undefined
  }
  const strip = (a: Assignment) => ({ ...a, personalNotes: '', description: a.description.slice(0, 600) })
  const since = now.getTime() - 14 * 86_400_000
  return {
    v: 1,
    student: { name: s.prefs.displayName || 'Student', level: levelFor(xp).level, xp, streak: streak(s.xpEvents, now, s.prefs.dailyGoal).days, dailyGoal: s.prefs.dailyGoal, pet: s.prefs.pet?.name ?? null },
    courses: s.courses,
    assignments: [
      ...s.assignments.map((a) => ({ ...strip(a), stages: stagesFor(a.id) })),
      // Skipped work is shown to parents too, clearly labeled, so nothing is hidden.
      ...s.prefs.skipped.map((x) => ({ ...strip(x.assignment), skipped: true })),
    ],
    grades: s.grades,
    announcements: [...s.announcements].sort((a, b) => b.postedAt.localeCompare(a.postedAt)).slice(0, 40).map((a) => ({ ...a, body: a.body.slice(0, 800) })),
    completions: s.xpEvents.filter((e) => (e.kind === 'assignment' || e.kind === 'task') && new Date(e.at).getTime() > since).map((e) => e.at),
  }
}

/**
 * While family sharing is on, keep the parents' copy fresh: upload a few seconds after anything
 * changes (and after every Canvas sync, which changes the data).
 */
export function useFamilySync() {
  const on = useStore((s) => s.prefs.dataMode === 'canvas' && s.prefs.familySharing)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    if (!on) return
    const push = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        try {
          const r = await familyApi.upload(buildSnapshot(useStore.getState()))
          if (!r.parents) useStore.getState().updatePrefs({ familySharing: false })
        } catch {
          /* offline or signed out: try again on the next change */
        }
      }, 4000)
    }
    push()
    const unsub = useStore.subscribe((s, prev) => {
      if (s.assignments !== prev.assignments || s.grades !== prev.grades || s.courses !== prev.courses || s.announcements !== prev.announcements || s.xpEvents !== prev.xpEvents || s.tasks !== prev.tasks || s.prefs.skipped !== prev.prefs.skipped || s.prefs.displayName !== prev.prefs.displayName) push()
    })
    return () => {
      unsub()
      clearTimeout(timer.current)
    }
  }, [on])
}
