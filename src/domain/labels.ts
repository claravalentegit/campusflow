import { tr } from '@/i18n/core'
import { msg } from '@/i18n/langs'
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
  not_started: msg('Not started'),
  in_progress: msg('In progress'),
  submitted: msg('Submitted (self-reported)'),
  completed: msg('Completed'),
}

export const STATUS_SHORT: Record<AssignmentStatus, string> = {
  not_started: msg('Not started'),
  in_progress: msg('In progress'),
  submitted: msg('Submitted'),
  completed: msg('Completed'),
}

export const PRIORITY_LABEL: Record<Priority, string> = { high: msg('High'), medium: msg('Medium'), low: msg('Low') }

export const TYPE_LABEL: Record<AssignmentType, string> = {
  essay: msg('Essay / paper'),
  problem_set: msg('Problem set'),
  project: msg('Project'),
  quiz: msg('Quiz'),
  exam: msg('Exam'),
  reading: msg('Reading'),
  discussion: msg('Discussion'),
  lab: msg('Lab'),
  presentation: msg('Presentation'),
  other: msg('Other'),
}

export const MODULE_ITEM_LABEL: Record<ModuleItemType, string> = {
  reading: msg('Reading'),
  lecture: msg('Lecture'),
  quiz: msg('Quiz'),
  assignment: msg('Assignment'),
  page: msg('Page'),
  file: msg('File'),
  discussion: msg('Discussion'),
  link: msg('Link'),
}

export const EVENT_KIND_LABEL: Record<CalendarEventKind, string> = {
  exam: msg('Exam'),
  class: msg('Class'),
  event: msg('Event'),
  deadline: msg('Deadline'),
}

export const SOURCE_LABEL: Record<RecordSource, string> = {
  canvas: msg('From Canvas'),
  demo: msg('Demo data'),
  manual: msg('Added by you'),
}

export const GRADE_SOURCE_LABEL: Record<GradeSource, string> = {
  canvas: msg('Canvas'),
  manual: msg('Entered by you'),
  demo: msg('Demo'),
}

export function canvasSubmissionLabel(s: CanvasSubmission | null): string {
  if (!s) return tr('Unknown — not synced with Canvas')
  const prefix = s.source === 'demo' ? `${tr('Demo')}: ` : ''
  switch (s.state) {
    case 'submitted':
      return `${prefix}${tr('Submitted on Canvas')}`
    case 'graded':
      return `${prefix}${tr('Graded on Canvas')}`
    case 'pending_review':
      return `${prefix}${tr('Pending review on Canvas')}`
    case 'missing':
      return `${prefix}${tr('Marked missing on Canvas')}`
    default:
      return `${prefix}${tr('Not submitted on Canvas')}`
  }
}
