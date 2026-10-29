/**
 * CampusFlow domain model.
 *
 * Conventions
 * - Every record has a stable string `id`.
 * - Instants (a due time, a session start) are ISO 8601 strings in UTC, e.g. "2026-10-30T23:59:00.000Z".
 *   They are rendered in the browser's local time zone.
 * - Calendar days that have no time component (a planned day for a task) are "yyyy-MM-dd" strings
 *   interpreted in the user's local time zone. See `domain/dates.ts`.
 * - `source` records where a record came from so student-created data is never confused with
 *   data synced from Canvas (or with the bundled demo data).
 */

import type { EarnedBadge, XpEvent } from './game'

export type ID = string
export type ISODateTime = string
/** Local calendar day, "yyyy-MM-dd". */
export type LocalDay = string

export type RecordSource = 'canvas' | 'demo' | 'manual'

export const COURSE_COLORS = ['indigo', 'violet', 'sky', 'teal', 'emerald', 'amber', 'rose', 'slate'] as const
export type CourseColor = (typeof COURSE_COLORS)[number]

export const COURSE_ICONS = [
  'book',
  'flask',
  'calculator',
  'code',
  'globe',
  'palette',
  'music',
  'brain',
  'landmark',
  'microscope',
  'pen',
  'chart',
] as const
export type CourseIcon = (typeof COURSE_ICONS)[number]

export type CourseStatus = 'active' | 'completed' | 'archived'

export interface GradeCategory {
  id: ID
  name: string
  /** Percentage weight of the final grade, 0–100. */
  weight: number
}

export interface Course {
  id: ID
  name: string
  code: string
  instructor: string | null
  description: string
  term: string
  color: CourseColor
  icon: CourseIcon
  status: CourseStatus
  /** Hidden courses stay in the data but are left out of the dashboard and pickers. */
  hidden: boolean
  meetingInfo: string | null
  /** Optional grade weighting the student copied from the syllabus. */
  gradeCategories: GradeCategory[]
  targetGrade: number | null
  source: RecordSource
  canvasId: string | null
  createdAt: ISODateTime
}

export interface Announcement {
  id: ID
  courseId: ID
  title: string
  body: string
  postedAt: ISODateTime
  important: boolean
  read: boolean
  source: RecordSource
  canvasId: string | null
}

export type ModuleItemType = 'reading' | 'lecture' | 'quiz' | 'assignment' | 'page' | 'file' | 'discussion' | 'link'

export interface ModuleItem {
  id: ID
  title: string
  type: ModuleItemType
  assignmentId: ID | null
  url: string | null
  completed: boolean
}

export interface CourseModule {
  id: ID
  courseId: ID
  title: string
  position: number
  items: ModuleItem[]
  source: RecordSource
  canvasId: string | null
}

export type Priority = 'low' | 'medium' | 'high'
export const PRIORITIES: Priority[] = ['high', 'medium', 'low']

/**
 * The student's own progress. `submitted` means the student says they turned it in;
 * it is NOT a confirmation from Canvas. Official state lives in `canvasSubmission`.
 */
export type AssignmentStatus = 'not_started' | 'in_progress' | 'submitted' | 'completed'
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['not_started', 'in_progress', 'submitted', 'completed']

export type AssignmentType =
  | 'essay'
  | 'problem_set'
  | 'project'
  | 'quiz'
  | 'exam'
  | 'reading'
  | 'discussion'
  | 'lab'
  | 'presentation'
  | 'other'
export const ASSIGNMENT_TYPES: AssignmentType[] = [
  'essay',
  'problem_set',
  'project',
  'lab',
  'quiz',
  'exam',
  'reading',
  'discussion',
  'presentation',
  'other',
]

export interface ResourceLink {
  id: ID
  label: string
  url: string
}

/**
 * Submission state as reported by Canvas. Only populated from a real Canvas sync, or from demo data
 * (where `source` is 'demo' and the UI says so). `null` means "we do not know".
 */
export interface CanvasSubmission {
  state: 'unsubmitted' | 'submitted' | 'graded' | 'pending_review' | 'missing'
  submittedAt: ISODateTime | null
  syncedAt: ISODateTime
  source: 'canvas' | 'demo'
}

export interface Assignment {
  id: ID
  courseId: ID
  title: string
  description: string
  dueAt: ISODateTime | null
  priority: Priority
  estimatedMinutes: number | null
  status: AssignmentStatus
  type: AssignmentType
  submissionInstructions: string
  rubricNotes: string
  links: ResourceLink[]
  personalNotes: string
  pointsPossible: number | null
  gradeCategoryId: ID | null
  moduleId: ID | null
  canvasSubmission: CanvasSubmission | null
  source: RecordSource
  canvasId: string | null
  /** Canvas URL of the assignment, when synced. */
  htmlUrl: string | null
  completedAt: ISODateTime | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/** A study task: a standalone to-do, or a checklist step of an assignment (when assignmentId is set). */
export interface StudyTask {
  id: ID
  title: string
  courseId: ID | null
  assignmentId: ID | null
  /** Day the student plans to do this. */
  plannedFor: LocalDay | null
  /** Optional hard deadline for standalone tasks. */
  dueAt: ISODateTime | null
  estimatedMinutes: number | null
  priority: Priority
  done: boolean
  position: number
  createdAt: ISODateTime
  completedAt: ISODateTime | null
}

export interface StudySession {
  id: ID
  title: string
  courseId: ID | null
  assignmentId: ID | null
  taskId: ID | null
  start: ISODateTime
  end: ISODateTime
  completed: boolean
  /** Sessions logged by the focus timer, as opposed to planned ahead. */
  logged: boolean
}

export type CalendarEventKind = 'exam' | 'class' | 'event' | 'deadline'

export interface CalendarEvent {
  id: ID
  title: string
  courseId: ID | null
  kind: CalendarEventKind
  start: ISODateTime
  end: ISODateTime | null
  allDay: boolean
  location: string
  notes: string
  source: RecordSource
  canvasId: string | null
  /** Canvas calendars include assignment deadlines as events; we link them so they are not shown twice. */
  linkedAssignmentId: ID | null
}

export interface Reminder {
  id: ID
  title: string
  remindAt: ISODateTime
  courseId: ID | null
  assignmentId: ID | null
  done: boolean
  createdAt: ISODateTime
}

export interface Note {
  id: ID
  title: string
  body: string
  courseId: ID | null
  moduleId: ID | null
  assignmentId: ID | null
  taskId: ID | null
  tags: string[]
  favorite: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export type ResourceKind = 'link' | 'file' | 'reference'

export interface StoredFileRef {
  /** Key in the IndexedDB file store. */
  blobId: ID
  name: string
  size: number
  mimeType: string
}

export interface Resource {
  id: ID
  title: string
  kind: ResourceKind
  url: string | null
  description: string
  courseId: ID | null
  moduleId: ID | null
  assignmentId: ID | null
  tags: string[]
  favorite: boolean
  file: StoredFileRef | null
  createdAt: ISODateTime
}

export type GradeSource = 'canvas' | 'manual' | 'demo'

export interface GradeRecord {
  id: ID
  courseId: ID
  assignmentId: ID | null
  title: string
  categoryId: ID | null
  score: number
  outOf: number
  source: GradeSource
  gradedAt: ISODateTime
}

export type ThemePreference = 'system' | 'light' | 'dark'
export type DataMode = 'demo' | 'manual' | 'canvas'
export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export interface Preferences {
  displayName: string
  theme: ThemePreference
  sidebarCompact: boolean
  weekStartsOn: 0 | 1
  /** Minutes the student says they can study on each weekday. null = not provided. */
  availability: Record<Weekday, number> | null
  /** Planned minutes above which a day is flagged as overloaded. */
  overloadThresholdMinutes: number
  focusMinutes: number
  dataMode: DataMode
  /** The student must opt in before any assignment text is sent to an AI service. */
  aiConsent: boolean
  lastCanvasSyncAt: ISODateTime | null
  onboarded: boolean
  /** Things to finish per day to make it a gold day (daily quest). */
  dailyGoal: number
  /** Game sound effects. */
  sound: boolean
  /** Highest level already celebrated, so level-ups are celebrated once. */
  lastSeenLevel: number
  /** Day the daily quest celebration last played. */
  questCelebratedOn: LocalDay | null
  /** When Canvas was first connected. Canvas submissions after this earn XP. */
  canvasConnectedAt: ISODateTime | null
  canvasUser: string | null
  canvasHost: string | null
  /** The study pet the student picked. null until they pick one. */
  pet: { species: 'cat' | 'dragon' | 'bunny' | 'fox' | 'axolotl'; name: string } | null
  /** Family sharing is on: linked parents get an up-to-date copy. */
  familySharing: boolean
  /** Assignments the student skipped: hidden everywhere in CampusFlow and ignored by future syncs. */
  skipped: SkippedAssignment[]
  /** The active Rescue plan: late assignments in their fixed order. */
  rescue: { ids: ID[]; startedAt: ISODateTime } | null
}

/** A skipped assignment, kept so it can be restored. Skipping never changes anything on Canvas. */
export interface SkippedAssignment {
  id: ID
  title: string
  courseId: ID
  skippedAt: ISODateTime
  assignment: Assignment
  tasks: StudyTask[]
}

export interface AppData {
  courses: Course[]
  announcements: Announcement[]
  modules: CourseModule[]
  assignments: Assignment[]
  tasks: StudyTask[]
  sessions: StudySession[]
  events: CalendarEvent[]
  reminders: Reminder[]
  notes: Note[]
  resources: Resource[]
  grades: GradeRecord[]
  /** IDs of derived notifications the student dismissed. */
  dismissedNotificationIds: string[]
  xpEvents: XpEvent[]
  badges: EarnedBadge[]
}

export const EMPTY_DATA: AppData = {
  courses: [],
  announcements: [],
  modules: [],
  assignments: [],
  tasks: [],
  sessions: [],
  events: [],
  reminders: [],
  notes: [],
  resources: [],
  grades: [],
  dismissedNotificationIds: [],
  xpEvents: [],
  badges: [],
}
