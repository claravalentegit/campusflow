import type {
  AssignmentStatus,
  AssignmentType,
  CalendarEventKind,
  CanvasSubmission,
  ModuleItemType,
  Priority,
  RecordSource,
  GradeSource,
} from './types'

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted (self-reported)',
  completed: 'Completed',
}

export const STATUS_SHORT: Record<AssignmentStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  completed: 'Completed',
}

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

export const TYPE_LABEL: Record<AssignmentType, string> = {
  essay: 'Essay / paper',
  problem_set: 'Problem set',
  project: 'Project',
  quiz: 'Quiz',
  exam: 'Exam',
  reading: 'Reading',
  discussion: 'Discussion',
  lab: 'Lab',
  presentation: 'Presentation',
  other: 'Other',
}

export const MODULE_ITEM_LABEL: Record<ModuleItemType, string> = {
  reading: 'Reading',
  lecture: 'Lecture',
  quiz: 'Quiz',
  assignment: 'Assignment',
  page: 'Page',
  file: 'File',
  discussion: 'Discussion',
  link: 'Link',
}

export const EVENT_KIND_LABEL: Record<CalendarEventKind, string> = {
  exam: 'Exam',
  class: 'Class',
  event: 'Event',
  deadline: 'Deadline',
}

export const SOURCE_LABEL: Record<RecordSource, string> = {
  canvas: 'From Canvas',
  demo: 'Demo data',
  manual: 'Added by you',
}

export const GRADE_SOURCE_LABEL: Record<GradeSource, string> = {
  canvas: 'Canvas',
  manual: 'Entered by you',
  demo: 'Demo',
}

export function canvasSubmissionLabel(s: CanvasSubmission | null): string {
  if (!s) return 'Unknown — not synced with Canvas'
  const prefix = s.source === 'demo' ? 'Demo: ' : ''
  switch (s.state) {
    case 'submitted':
      return `${prefix}Submitted on Canvas`
    case 'graded':
      return `${prefix}Graded on Canvas`
    case 'pending_review':
      return `${prefix}Pending review on Canvas`
    case 'missing':
      return `${prefix}Marked missing on Canvas`
    default:
      return `${prefix}Not submitted on Canvas`
  }
}
