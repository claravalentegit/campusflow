import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { buildDemoData } from '@/data/demo'
import { newId } from '@/domain/ids'
import { isAssignmentDone } from '@/domain/assignments'
import { assignmentEvent, levelFor, taskEvent, totalXp, type BadgeId, type XpEvent } from '@/domain/game'
import type {
  Announcement,
  AppData,
  Assignment,
  AssignmentStatus,
  CalendarEvent,
  Course,
  CourseModule,
  ModuleItem,
  GradeRecord,
  Note,
  Preferences,
  Reminder,
  Resource,
  StudySession,
  StudyTask,
} from '@/domain/types'
import { EMPTY_DATA } from '@/domain/types'
import { mergeCanvasData } from '@/integrations/canvas/merge'
import type { CanvasMapped } from '@/integrations/canvas/mapping'
import { deleteStoredFile } from './fileStore'
import { toast } from './ui'

export const DEFAULT_PREFS: Preferences = {
  displayName: 'Alex',
  theme: 'system',
  sidebarCompact: false,
  weekStartsOn: 1,
  availability: null,
  overloadThresholdMinutes: 300,
  focusMinutes: 25,
  dataMode: 'demo',
  aiConsent: false,
  lastCanvasSyncAt: null,
  onboarded: false,
  dailyGoal: 3,
  sound: true,
  lastSeenLevel: 1,
  questCelebratedOn: null,
  canvasConnectedAt: null,
  canvasUser: null,
  canvasHost: null,
  pet: null,
  skipped: [],
  familySharing: false,
}

function freshDemo(prefs: Preferences) {
  const data = buildDemoData()
  return { ...data, focus: null, prefs: { ...prefs, skipped: [], dataMode: 'demo' as const, lastCanvasSyncAt: null, lastSeenLevel: levelFor(totalXp(data.xpEvents)).level, questCelebratedOn: null } }
}

export interface FocusState {
  title: string
  courseId: string | null
  assignmentId: string | null
  taskId: string | null
  startedAt: string
  durationMinutes: number
}

type Draft<T extends { id: string }> = Omit<T, 'id'> & { id?: string }

interface Actions {
  // Courses
  addCourse: (c: Draft<Course>) => Course
  updateCourse: (id: string, patch: Partial<Course>) => void
  deleteCourse: (id: string) => void
  // Assignments
  addAssignment: (a: Draft<Assignment>) => Assignment
  updateAssignment: (id: string, patch: Partial<Assignment>) => void
  /** Returns the XP event when this completes the assignment. */
  setAssignmentStatus: (id: string, status: AssignmentStatus) => XpEvent | null
  deleteAssignment: (id: string) => void
  /** Take an assignment out of CampusFlow (it stays on Canvas). Future syncs ignore it. */
  skipAssignment: (id: string) => void
  /** Bring a skipped assignment back. */
  unskipAssignment: (id: string) => void
  // Tasks
  addTask: (t: Draft<StudyTask>) => StudyTask
  addTasks: (ts: Array<Draft<StudyTask>>) => void
  updateTask: (id: string, patch: Partial<StudyTask>) => void
  /** Returns the XP event when this completes the task. */
  toggleTask: (id: string) => XpEvent | null
  deleteTask: (id: string) => void
  // Sessions, events, reminders
  addSession: (s: Draft<StudySession>) => StudySession
  updateSession: (id: string, patch: Partial<StudySession>) => void
  deleteSession: (id: string) => void
  addEvent: (e: Draft<CalendarEvent>) => CalendarEvent
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  addReminder: (r: Draft<Reminder>) => Reminder
  updateReminder: (id: string, patch: Partial<Reminder>) => void
  deleteReminder: (id: string) => void
  // Notes & resources
  addNote: (n: Draft<Note>) => Note
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  addResource: (r: Draft<Resource>) => Resource
  updateResource: (id: string, patch: Partial<Resource>) => void
  deleteResource: (id: string) => void
  // Grades
  addGrade: (g: Draft<GradeRecord>) => GradeRecord
  updateGrade: (id: string, patch: Partial<GradeRecord>) => void
  deleteGrade: (id: string) => void
  // Course content
  toggleModuleItem: (moduleId: string, itemId: string) => void
  addModule: (courseId: string, title: string) => CourseModule
  renameModule: (id: string, title: string) => void
  deleteModule: (id: string) => void
  addModuleItem: (moduleId: string, item: Omit<ModuleItem, 'id'>) => void
  deleteModuleItem: (moduleId: string, itemId: string) => void
  updateAnnouncement: (id: string, patch: Partial<Announcement>) => void
  dismissNotification: (id: string) => void
  addXpEvent: (e: XpEvent) => void
  removeXpEvent: (id: string) => void
  addBadge: (id: BadgeId) => void
  // Focus
  startFocus: (f: Omit<FocusState, 'startedAt' | 'durationMinutes'> & { durationMinutes?: number }) => void
  finishFocus: (logSession: boolean) => void
  // Preferences & data
  updatePrefs: (patch: Partial<Preferences>) => void
  resetDemoData: () => void
  startEmpty: () => void
  /** Merge a Canvas sync. Returns XP events for work newly submitted on Canvas since connecting. */
  applyCanvasSync: (mapped: CanvasMapped, account: { userName: string; baseHost: string }) => { events: XpEvent[]; courses: number; assignments: number }
  disconnectCanvas: (removeData: boolean) => void
}

export interface AppState extends AppData {
  prefs: Preferences
  focus: FocusState | null
}

export type Store = AppState & Actions

const now = () => new Date().toISOString()

function patchById<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r))
}

/** localStorage wrapper that reports failures (quota, private mode) instead of throwing. */
let warnedAboutStorage = false
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      if (!warnedAboutStorage) {
        warnedAboutStorage = true
        toast('Changes could not be saved in this browser. Storage may be full or disabled.', 'error')
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}

export const STORAGE_KEY = 'campusflow:v1'

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...freshDemo(DEFAULT_PREFS),

      addCourse: (c) => {
        const course: Course = { ...c, id: c.id ?? newId('crs') }
        set((s) => ({ courses: [...s.courses, course] }))
        return course
      },
      updateCourse: (id, patch) => set((s) => ({ courses: patchById(s.courses, id, patch) })),
      deleteCourse: (id) =>
        set((s) => {
          const assignmentIds = new Set(s.assignments.filter((a) => a.courseId === id).map((a) => a.id))
          for (const r of s.resources) if (r.courseId === id && r.file) void deleteStoredFile(r.file.blobId)
          return {
            courses: s.courses.filter((c) => c.id !== id),
            assignments: s.assignments.filter((a) => a.courseId !== id),
            modules: s.modules.filter((m) => m.courseId !== id),
            announcements: s.announcements.filter((a) => a.courseId !== id),
            grades: s.grades.filter((g) => g.courseId !== id),
            events: s.events.filter((e) => e.courseId !== id),
            resources: s.resources.filter((r) => r.courseId !== id),
            tasks: s.tasks.filter((t) => t.courseId !== id && !(t.assignmentId && assignmentIds.has(t.assignmentId))),
            sessions: s.sessions.filter((x) => x.courseId !== id),
            reminders: s.reminders.filter((r) => r.courseId !== id),
            // Notes are the student's own writing: keep them, but detach from the course.
            notes: s.notes.map((n) => (n.courseId === id ? { ...n, courseId: null, moduleId: null, assignmentId: null } : n)),
          }
        }),

      addAssignment: (a) => {
        const assignment: Assignment = { ...a, id: a.id ?? newId('asg') }
        set((s) => ({ assignments: [...s.assignments, assignment] }))
        return assignment
      },
      updateAssignment: (id, patch) =>
        set((s) => ({ assignments: patchById(s.assignments, id, { ...patch, updatedAt: now() }) })),
      setAssignmentStatus: (id, status) => {
        const s = get()
        const a = s.assignments.find((x) => x.id === id)
        if (!a) return null
        const wasDone = isAssignmentDone(a)
        const next = { ...a, status }
        const nowDone = isAssignmentDone(next)
        let event: XpEvent | null = null
        let xpEvents = s.xpEvents
        if (!wasDone && nowDone) {
          event = assignmentEvent(a, s.tasks, new Date(), newId('xp'))
          xpEvents = [...xpEvents, event]
        } else if (wasDone && !nowDone) {
          xpEvents = xpEvents.filter((e) => !(e.kind === 'assignment' && e.refId === id))
        }
        set({
          xpEvents,
          assignments: patchById(s.assignments, id, {
            status,
            completedAt: status === 'completed' || status === 'submitted' ? (a.completedAt ?? now()) : null,
            updatedAt: now(),
          }),
        })
        return event
      },
      skipAssignment: (id) =>
        set((s) => {
          const a = s.assignments.find((x) => x.id === id)
          if (!a) return {}
          const entry = { id, title: a.title, courseId: a.courseId, skippedAt: now(), assignment: a, tasks: s.tasks.filter((t) => t.assignmentId === id) }
          return {
            assignments: s.assignments.filter((x) => x.id !== id),
            tasks: s.tasks.filter((t) => t.assignmentId !== id),
            prefs: { ...s.prefs, skipped: [entry, ...s.prefs.skipped.filter((x) => x.id !== id)].slice(0, 300) },
          }
        }),
      unskipAssignment: (id) =>
        set((s) => {
          const entry = s.prefs.skipped.find((x) => x.id === id)
          if (!entry) return {}
          return {
            assignments: s.assignments.some((x) => x.id === id) ? s.assignments : [...s.assignments, entry.assignment],
            tasks: [...s.tasks.filter((t) => t.assignmentId !== id), ...entry.tasks],
            prefs: { ...s.prefs, skipped: s.prefs.skipped.filter((x) => x.id !== id) },
          }
        }),
      deleteAssignment: (id) =>
        set((s) => ({
          assignments: s.assignments.filter((a) => a.id !== id),
          tasks: s.tasks.filter((t) => t.assignmentId !== id),
          sessions: s.sessions.map((x) => (x.assignmentId === id ? { ...x, assignmentId: null, taskId: null } : x)),
          reminders: s.reminders.map((r) => (r.assignmentId === id ? { ...r, assignmentId: null } : r)),
          events: s.events.map((e) => (e.linkedAssignmentId === id ? { ...e, linkedAssignmentId: null } : e)),
          grades: s.grades.map((g) => (g.assignmentId === id ? { ...g, assignmentId: null } : g)),
          notes: s.notes.map((n) => (n.assignmentId === id ? { ...n, assignmentId: null } : n)),
          resources: s.resources.map((r) => (r.assignmentId === id ? { ...r, assignmentId: null } : r)),
          modules: s.modules.map((m) => ({ ...m, items: m.items.map((i) => (i.assignmentId === id ? { ...i, assignmentId: null } : i)) })),
        })),

      addTask: (t) => {
        const task: StudyTask = { ...t, id: t.id ?? newId('tsk') }
        set((s) => ({ tasks: [...s.tasks, task] }))
        return task
      },
      addTasks: (ts) => set((s) => ({ tasks: [...s.tasks, ...ts.map((t) => ({ ...t, id: t.id ?? newId('tsk') }))] })),
      updateTask: (id, patch) => set((s) => ({ tasks: patchById(s.tasks, id, patch) })),
      toggleTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return null
        const done = !task.done
        const parent = task.assignmentId ? get().assignments.find((a) => a.id === task.assignmentId) : undefined
        const event = done ? taskEvent(task, parent, new Date(), newId('xp')) : null
        set((s) => ({ xpEvents: event ? [...s.xpEvents, event] : s.xpEvents.filter((e) => !(e.kind === 'task' && e.refId === id)) }))
        set((s) => {
          let assignments = s.assignments
          // Ticking the first step of an untouched assignment moves it to "In progress".
          if (done && task.assignmentId) {
            const a = s.assignments.find((x) => x.id === task.assignmentId)
            if (a && a.status === 'not_started') assignments = patchById(assignments, a.id, { status: 'in_progress', updatedAt: now() })
          }
          return { tasks: patchById(s.tasks, id, { done, completedAt: done ? now() : null }), assignments }
        })
        return event
      },
      deleteTask: (id) =>
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          sessions: s.sessions.map((x) => (x.taskId === id ? { ...x, taskId: null } : x)),
          notes: s.notes.map((n) => (n.taskId === id ? { ...n, taskId: null } : n)),
        })),

      addSession: (x) => {
        const session: StudySession = { ...x, id: x.id ?? newId('ses') }
        set((s) => ({ sessions: [...s.sessions, session] }))
        return session
      },
      updateSession: (id, patch) => set((s) => ({ sessions: patchById(s.sessions, id, patch) })),
      deleteSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),

      addEvent: (e) => {
        const event: CalendarEvent = { ...e, id: e.id ?? newId('evt') }
        set((s) => ({ events: [...s.events, event] }))
        return event
      },
      updateEvent: (id, patch) => set((s) => ({ events: patchById(s.events, id, patch) })),
      deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      addReminder: (r) => {
        const reminder: Reminder = { ...r, id: r.id ?? newId('rem') }
        set((s) => ({ reminders: [...s.reminders, reminder] }))
        return reminder
      },
      updateReminder: (id, patch) => set((s) => ({ reminders: patchById(s.reminders, id, patch) })),
      deleteReminder: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),

      addNote: (n) => {
        const note: Note = { ...n, id: n.id ?? newId('nte') }
        set((s) => ({ notes: [note, ...s.notes] }))
        return note
      },
      updateNote: (id, patch) => set((s) => ({ notes: patchById(s.notes, id, { ...patch, updatedAt: now() }) })),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      addResource: (r) => {
        const resource: Resource = { ...r, id: r.id ?? newId('res') }
        set((s) => ({ resources: [resource, ...s.resources] }))
        return resource
      },
      updateResource: (id, patch) => set((s) => ({ resources: patchById(s.resources, id, patch) })),
      deleteResource: (id) => {
        const r = get().resources.find((x) => x.id === id)
        if (r?.file) void deleteStoredFile(r.file.blobId)
        set((s) => ({ resources: s.resources.filter((x) => x.id !== id) }))
      },

      addGrade: (g) => {
        const grade: GradeRecord = { ...g, id: g.id ?? newId('grd') }
        set((s) => ({ grades: [...s.grades, grade] }))
        return grade
      },
      updateGrade: (id, patch) => set((s) => ({ grades: patchById(s.grades, id, patch) })),
      deleteGrade: (id) => set((s) => ({ grades: s.grades.filter((g) => g.id !== id) })),

      toggleModuleItem: (moduleId, itemId) =>
        set((s) => ({
          modules: s.modules.map((m) =>
            m.id === moduleId ? { ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i)) } : m,
          ),
        })),
      addModule: (courseId, title) => {
        const position = Math.max(-1, ...get().modules.filter((m) => m.courseId === courseId).map((m) => m.position)) + 1
        const module: CourseModule = { id: newId('mod'), courseId, title, position, items: [], source: 'manual', canvasId: null }
        set((s) => ({ modules: [...s.modules, module] }))
        return module
      },
      renameModule: (id, title) => set((s) => ({ modules: patchById(s.modules, id, { title }) })),
      deleteModule: (id) =>
        set((s) => ({
          modules: s.modules.filter((m) => m.id !== id),
          assignments: s.assignments.map((a) => (a.moduleId === id ? { ...a, moduleId: null } : a)),
          notes: s.notes.map((n) => (n.moduleId === id ? { ...n, moduleId: null } : n)),
          resources: s.resources.map((r) => (r.moduleId === id ? { ...r, moduleId: null } : r)),
        })),
      addModuleItem: (moduleId, item) =>
        set((s) => ({ modules: s.modules.map((m) => (m.id === moduleId ? { ...m, items: [...m.items, { ...item, id: newId('mi') }] } : m)) })),
      deleteModuleItem: (moduleId, itemId) =>
        set((s) => ({ modules: s.modules.map((m) => (m.id === moduleId ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m)) })),
      updateAnnouncement: (id, patch) => set((s) => ({ announcements: patchById(s.announcements, id, patch) })),
      dismissNotification: (id) => set((s) => ({ dismissedNotificationIds: [...new Set([...s.dismissedNotificationIds, id])] })),
      addXpEvent: (e) => set((s) => ({ xpEvents: [...s.xpEvents, e] })),
      removeXpEvent: (id) => set((s) => ({ xpEvents: s.xpEvents.filter((e) => e.id !== id) })),
      addBadge: (id) => set((s) => (s.badges.some((b) => b.id === id) ? s : { badges: [...s.badges, { id, at: now() }] })),

      startFocus: (f) =>
        set((s) => ({ focus: { ...f, durationMinutes: f.durationMinutes ?? s.prefs.focusMinutes, startedAt: now() } })),
      finishFocus: (logSession) => {
        const f = get().focus
        if (!f) return
        if (logSession) {
          const start = new Date(f.startedAt)
          const end = new Date(Math.min(Date.now(), start.getTime() + f.durationMinutes * 60000))
          if (end.getTime() - start.getTime() >= 60000) {
            const minutes = Math.round((end.getTime() - start.getTime()) / 60000)
            get().addXpEvent({ id: newId('xp'), at: end.toISOString(), amount: minutes, kind: 'focus', refId: f.taskId ?? f.assignmentId ?? 'focus' })
            get().addSession({
              title: `Focus: ${f.title}`,
              courseId: f.courseId,
              assignmentId: f.assignmentId,
              taskId: f.taskId,
              start: start.toISOString(),
              end: end.toISOString(),
              completed: true,
              logged: true,
            })
          }
        }
        set({ focus: null })
      },

      updatePrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
      resetDemoData: () => set((s) => freshDemo(s.prefs)),
      startEmpty: () => set((s) => ({ ...EMPTY_DATA, focus: null, prefs: { ...s.prefs, dataMode: 'manual', lastCanvasSyncAt: null, lastSeenLevel: 1, questCelebratedOn: null } })),
      applyCanvasSync: (mapped, account) => {
        const s = get()
        const nowIso = now()
        const connectedAt = s.prefs.dataMode === 'canvas' && s.prefs.canvasConnectedAt ? s.prefs.canvasConnectedAt : nowIso
        // Switching from demo to a real connection removes the sample records so they are never mixed.
        const base: AppData = s.prefs.dataMode === 'demo' ? removeDemoRecords(s) : s
        const wasDone = new Set(base.assignments.filter(isAssignmentDone).map((a) => a.id))
        // Skipped assignments stay out, however often Canvas sends them.
        const skippedIds = new Set(s.prefs.skipped.map((x) => x.id))
        const merged = mergeCanvasData(base, { ...mapped, assignments: mapped.assignments.filter((a) => !skippedIds.has(a.id)) })
        // Work you submitted on Canvas after connecting earns XP, as if you checked it off here.
        const rewarded = new Set(merged.xpEvents.filter((e) => e.kind === 'assignment').map((e) => e.refId))
        const events: XpEvent[] = []
        for (const a of merged.assignments) {
          const sub = a.canvasSubmission
          if (a.source !== 'canvas' || !sub?.submittedAt || wasDone.has(a.id) || rewarded.has(a.id) || !isAssignmentDone(a)) continue
          if (sub.submittedAt < connectedAt) continue
          events.push(assignmentEvent(a, merged.tasks, new Date(sub.submittedAt), newId('xp')))
        }
        const fresh = s.prefs.dataMode !== 'canvas'
        set({
          ...merged,
          xpEvents: [...merged.xpEvents, ...events],
          prefs: {
            ...s.prefs,
            dataMode: 'canvas',
            lastCanvasSyncAt: nowIso,
            canvasConnectedAt: connectedAt,
            canvasUser: account.userName,
            canvasHost: account.baseHost,
            // Greet the student by their real first name instead of the demo's.
            displayName: !s.prefs.displayName || s.prefs.displayName === DEFAULT_PREFS.displayName ? account.userName.split(' ')[0] : s.prefs.displayName,
            ...(fresh && s.prefs.dataMode === 'demo' ? { lastSeenLevel: 1, questCelebratedOn: null } : {}),
          },
        })
        return { events, courses: mapped.courses.length, assignments: mapped.assignments.length }
      },
      disconnectCanvas: (removeData) =>
        set((s) => {
          const prefs = { ...s.prefs, dataMode: 'manual' as const, lastCanvasSyncAt: null, canvasConnectedAt: null, canvasUser: null, canvasHost: null }
          if (!removeData) return { prefs }
          const canvasCourseIds = new Set(s.courses.filter((c) => c.source === 'canvas').map((c) => c.id))
          const keep = (courseId: string | null) => !courseId || !canvasCourseIds.has(courseId)
          return {
            prefs,
            courses: s.courses.filter((c) => c.source !== 'canvas'),
            assignments: s.assignments.filter((a) => a.source !== 'canvas' && keep(a.courseId)),
            modules: s.modules.filter((m) => m.source !== 'canvas'),
            announcements: s.announcements.filter((a) => a.source !== 'canvas'),
            events: s.events.filter((e) => e.source !== 'canvas'),
            grades: s.grades.filter((g) => g.source !== 'canvas'),
            tasks: s.tasks.filter((t) => keep(t.courseId)),
            sessions: s.sessions.filter((x) => keep(x.courseId)),
            reminders: s.reminders.filter((r) => keep(r.courseId)),
          }
        }),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      // v1 had no game data. Demo users get a fresh demo; everyone else starts the game at zero.
      migrate: (persisted, version) => {
        const p = persisted as Partial<AppState>
        if (version < 2) {
          const prefs = { ...DEFAULT_PREFS, ...(p.prefs ?? {}) }
          if (prefs.dataMode === 'demo') return freshDemo(prefs) as unknown as AppState
          return { ...p, prefs, xpEvents: [], badges: [] } as AppState
        }
        return p as AppState
      },
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => {
        // Persist data only; functions are recreated on load.
        const data: AppState = {
          courses: s.courses,
          announcements: s.announcements,
          modules: s.modules,
          assignments: s.assignments,
          tasks: s.tasks,
          sessions: s.sessions,
          events: s.events,
          reminders: s.reminders,
          notes: s.notes,
          resources: s.resources,
          grades: s.grades,
          dismissedNotificationIds: s.dismissedNotificationIds,
          xpEvents: s.xpEvents,
          badges: s.badges,
          prefs: s.prefs,
          focus: s.focus,
        }
        return data
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return { ...current, ...p, prefs: { ...current.prefs, ...(p.prefs ?? {}) } }
      },
    },
  ),
)

function removeDemoRecords(s: AppData): AppData {
  const demoCourseIds = new Set(s.courses.filter((c) => c.source === 'demo').map((c) => c.id))
  const keep = (courseId: string | null) => !courseId || !demoCourseIds.has(courseId)
  const demoAssignmentIds = new Set(s.assignments.filter((a) => a.source === 'demo').map((a) => a.id))
  return {
    ...s,
    courses: s.courses.filter((c) => c.source !== 'demo'),
    assignments: s.assignments.filter((a) => a.source !== 'demo' && keep(a.courseId)),
    modules: s.modules.filter((m) => m.source !== 'demo'),
    announcements: s.announcements.filter((a) => a.source !== 'demo'),
    events: s.events.filter((e) => e.source !== 'demo'),
    grades: s.grades.filter((g) => g.source !== 'demo'),
    tasks: s.tasks.filter((t) => keep(t.courseId) && !(t.assignmentId && demoAssignmentIds.has(t.assignmentId))),
    sessions: s.sessions.filter((x) => keep(x.courseId)),
    reminders: s.reminders.filter((r) => keep(r.courseId)),
    notes: s.notes.filter((n) => keep(n.courseId)),
    resources: s.resources.filter((r) => keep(r.courseId)),
    xpEvents: [],
    badges: [],
  }
}

/** Snapshot of the persisted data for pure domain functions. */
export function selectData(s: AppState): AppData {
  return {
    courses: s.courses,
    announcements: s.announcements,
    modules: s.modules,
    assignments: s.assignments,
    tasks: s.tasks,
    sessions: s.sessions,
    events: s.events,
    reminders: s.reminders,
    notes: s.notes,
    resources: s.resources,
    grades: s.grades,
    dismissedNotificationIds: s.dismissedNotificationIds,
    xpEvents: s.xpEvents,
    badges: s.badges,
  }
}
