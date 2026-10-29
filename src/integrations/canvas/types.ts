/**
 * Subset of the Canvas LMS REST API (https://canvas.instructure.com/doc/api/) that CampusFlow reads.
 * The integration is read-only: nothing here submits work, changes grades, or sends messages.
 */
export interface CanvasRawCourse {
  id: number
  name: string
  course_code: string
  workflow_state?: string
  public_description?: string | null
  term?: { name?: string } | null
  teachers?: Array<{ display_name: string }>
}

export interface CanvasRawSubmission {
  workflow_state: 'unsubmitted' | 'submitted' | 'graded' | 'pending_review'
  submitted_at: string | null
  graded_at?: string | null
  score?: number | null
  missing?: boolean
}

export interface CanvasRawAssignment {
  id: number
  course_id: number
  name: string
  description: string | null
  due_at: string | null
  points_possible: number | null
  html_url: string
  submission_types?: string[]
  assignment_group_id?: number | null
  is_quiz_assignment?: boolean
  submission?: CanvasRawSubmission | null
  /** When it opens for students (null = already open). */
  unlock_at?: string | null
  /** When it closes; after this nothing can be turned in (null = never). */
  lock_at?: string | null
  locked_for_user?: boolean
  lock_explanation?: string | null
}

export interface CanvasRawAssignmentGroup {
  id: number
  name: string
  group_weight: number
}

export interface CanvasRawModuleItem {
  id: number
  title: string
  type: 'File' | 'Page' | 'Discussion' | 'Assignment' | 'Quiz' | 'SubHeader' | 'ExternalUrl' | 'ExternalTool'
  content_id?: number
  html_url?: string
  external_url?: string
  completion_requirement?: { completed?: boolean } | null
}

export interface CanvasRawModule {
  id: number
  name: string
  position: number
  items?: CanvasRawModuleItem[]
}

export interface CanvasRawAnnouncement {
  id: number
  title: string
  message: string | null
  posted_at: string | null
  read_state?: 'read' | 'unread'
}

export interface CanvasRawCalendarEvent {
  id: number | string
  title: string
  start_at: string | null
  end_at: string | null
  all_day?: boolean
  location_name?: string | null
  description?: string | null
  context_code?: string
  assignment?: { id: number } | null
}

export interface CanvasRawCourseBundle {
  course: CanvasRawCourse
  assignments: CanvasRawAssignment[]
  assignmentGroups: CanvasRawAssignmentGroup[]
  modules: CanvasRawModule[]
  announcements: CanvasRawAnnouncement[]
}

/** Shape returned by the CampusFlow server at GET /api/canvas/snapshot. */
export interface CanvasRawSnapshot {
  fetchedAt: string
  courses: CanvasRawCourseBundle[]
  events: CanvasRawCalendarEvent[]
}

export type CanvasStatus =
  | { state: 'demo' }
  | { state: 'signed_out' }
  | { state: 'server_unreachable'; message: string }
  | { state: 'not_configured'; missing: string[] }
  | { state: 'unauthorized'; message: string }
  | { state: 'error'; message: string }
  | { state: 'connected'; userName: string; baseHost: string; method?: 'token' | 'server' }
