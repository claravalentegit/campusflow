import type {
  Announcement,
  AppData,
  Assignment,
  AssignmentType,
  CalendarEvent,
  Course,
  CourseModule,
  GradeRecord,
  ModuleItemType,
} from '@/domain/types'
import { COURSE_COLORS } from '@/domain/types'
import type { CanvasRawAssignment, CanvasRawModuleItem, CanvasRawSnapshot } from './types'

export type CanvasMapped = Pick<AppData, 'courses' | 'assignments' | 'modules' | 'announcements' | 'events' | 'grades'>

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

/** Convert Canvas HTML to readable plain text. Content is never injected as HTML. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const canvasIdFor = {
  course: (id: number) => `cv_crs_${id}`,
  assignment: (id: number) => `cv_asg_${id}`,
  module: (id: number) => `cv_mod_${id}`,
  announcement: (id: number) => `cv_ann_${id}`,
  event: (id: number | string) => `cv_evt_${id}`,
  grade: (assignmentId: number) => `cv_grd_${assignmentId}`,
  group: (id: number) => `cv_grp_${id}`,
}

function inferType(a: CanvasRawAssignment): AssignmentType {
  const name = a.name.toLowerCase()
  if (a.is_quiz_assignment || a.submission_types?.includes('online_quiz')) return /exam|midterm|final/.test(name) ? 'exam' : 'quiz'
  if (a.submission_types?.includes('discussion_topic')) return 'discussion'
  if (/exam|midterm|final/.test(name)) return 'exam'
  if (/lab/.test(name)) return 'lab'
  if (/essay|paper|draft|bibliograph/.test(name)) return 'essay'
  if (/problem set|homework|hw|ps\d/.test(name)) return 'problem_set'
  if (/project|mp\d/.test(name)) return 'project'
  if (/presentation/.test(name)) return 'presentation'
  if (/reading|read /.test(name)) return 'reading'
  return 'other'
}

const MODULE_ITEM_TYPE: Record<CanvasRawModuleItem['type'], ModuleItemType> = {
  File: 'file',
  Page: 'page',
  Discussion: 'discussion',
  Assignment: 'assignment',
  Quiz: 'quiz',
  SubHeader: 'page',
  ExternalUrl: 'link',
  ExternalTool: 'link',
}

/** Pure mapping from Canvas API shapes into CampusFlow records (`source: 'canvas'`). */
export function mapCanvasSnapshot(raw: CanvasRawSnapshot): CanvasMapped {
  const out: CanvasMapped = { courses: [], assignments: [], modules: [], announcements: [], events: [], grades: [] }
  const syncedAt = raw.fetchedAt
  const courseByCode = new Map<string, string>()

  raw.courses.forEach((bundle, index) => {
    const c = bundle.course
    const courseId = canvasIdFor.course(c.id)
    courseByCode.set(`course_${c.id}`, courseId)
    const totalWeight = bundle.assignmentGroups.reduce((s, g) => s + (g.group_weight ?? 0), 0)
    const course: Course = {
      id: courseId,
      name: c.name,
      code: c.course_code,
      instructor: c.teachers?.map((t) => t.display_name).join(', ') || null,
      description: htmlToText(c.public_description),
      term: c.term?.name ?? '',
      color: COURSE_COLORS[index % COURSE_COLORS.length],
      icon: 'book',
      status: c.workflow_state === 'completed' ? 'completed' : 'active',
      hidden: false,
      meetingInfo: null,
      gradeCategories:
        totalWeight > 0
          ? bundle.assignmentGroups.filter((g) => g.group_weight > 0).map((g) => ({ id: canvasIdFor.group(g.id), name: g.name, weight: g.group_weight }))
          : [],
      targetGrade: null,
      source: 'canvas',
      canvasId: String(c.id),
      createdAt: syncedAt,
    }
    out.courses.push(course)

    for (const a of bundle.assignments) {
      const sub = a.submission
      const assignment: Assignment = {
        id: canvasIdFor.assignment(a.id),
        courseId,
        title: a.name,
        description: htmlToText(a.description),
        dueAt: a.due_at,
        priority: 'medium',
        estimatedMinutes: null,
        status: 'not_started',
        type: inferType(a),
        submissionInstructions: a.submission_types?.length ? `Canvas submission type: ${a.submission_types.join(', ').replace(/_/g, ' ')}` : '',
        rubricNotes: '',
        links: [],
        personalNotes: '',
        pointsPossible: a.points_possible,
        gradeCategoryId: a.assignment_group_id && totalWeight > 0 ? canvasIdFor.group(a.assignment_group_id) : null,
        moduleId: null,
        canvasSubmission: sub
          ? { state: sub.missing && sub.workflow_state === 'unsubmitted' ? 'missing' : sub.workflow_state, submittedAt: sub.submitted_at, syncedAt, source: 'canvas' }
          : null,
        canvasSubmissionTypes: a.submission_types ?? null,
        source: 'canvas',
        canvasId: String(a.id),
        htmlUrl: a.html_url,
        unlockAt: a.unlock_at ?? null,
        lockAt: a.lock_at ?? null,
        lockedForUser: !!a.locked_for_user,
        lockExplanation: a.lock_explanation ? htmlToText(a.lock_explanation) : null,
        completedAt: null,
        createdAt: syncedAt,
        updatedAt: syncedAt,
      }
      out.assignments.push(assignment)
      if (sub && sub.workflow_state === 'graded' && sub.score != null && a.points_possible) {
        const grade: GradeRecord = {
          id: canvasIdFor.grade(a.id),
          courseId,
          assignmentId: assignment.id,
          title: a.name,
          categoryId: assignment.gradeCategoryId,
          score: sub.score,
          outOf: a.points_possible,
          source: 'canvas',
          gradedAt: sub.graded_at ?? syncedAt,
        }
        out.grades.push(grade)
      }
    }

    for (const m of bundle.modules) {
      const module: CourseModule = {
        id: canvasIdFor.module(m.id),
        courseId,
        title: m.name,
        position: m.position,
        source: 'canvas',
        canvasId: String(m.id),
        items: (m.items ?? []).map((it) => ({
          id: `cv_mi_${it.id}`,
          title: it.title,
          type: MODULE_ITEM_TYPE[it.type] ?? 'page',
          assignmentId: it.type === 'Assignment' && it.content_id ? canvasIdFor.assignment(it.content_id) : null,
          url: it.external_url ?? it.html_url ?? null,
          completed: it.completion_requirement?.completed ?? false,
        })),
      }
      out.modules.push(module)
      for (const it of m.items ?? []) {
        if (it.type !== 'Assignment' || !it.content_id) continue
        const a = out.assignments.find((x) => x.id === canvasIdFor.assignment(it.content_id as number))
        if (a) a.moduleId = module.id
      }
    }

    for (const an of bundle.announcements) {
      const announcement: Announcement = {
        id: canvasIdFor.announcement(an.id),
        courseId,
        title: an.title,
        body: htmlToText(an.message),
        postedAt: an.posted_at ?? syncedAt,
        important: false,
        read: an.read_state === 'read',
        source: 'canvas',
        canvasId: String(an.id),
      }
      out.announcements.push(announcement)
    }
  })

  for (const e of raw.events) {
    if (!e.start_at) continue
    const event: CalendarEvent = {
      id: canvasIdFor.event(e.id),
      title: e.title,
      courseId: e.context_code ? (courseByCode.get(e.context_code) ?? null) : null,
      kind: /exam|midterm|final/i.test(e.title) ? 'exam' : 'event',
      start: e.start_at,
      end: e.end_at,
      allDay: !!e.all_day,
      location: e.location_name ?? '',
      notes: htmlToText(e.description),
      source: 'canvas',
      canvasId: String(e.id),
      linkedAssignmentId: e.assignment ? canvasIdFor.assignment(e.assignment.id) : null,
    }
    out.events.push(event)
  }
  return out
}
