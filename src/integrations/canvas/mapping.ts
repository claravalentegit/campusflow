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
import type { CanvasRawAssignment, CanvasRawCourse, CanvasRawModuleItem, CanvasRawSnapshot, CanvasRawSubmission } from './types'

export type CanvasMapped = Pick<AppData, 'courses' | 'assignments' | 'modules' | 'announcements' | 'events' | 'grades'>

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

/** Convert Canvas HTML to readable plain text. Content is never injected as HTML. */
/** The student's grade as Canvas shows it: this grading period's when the school uses them, else the total. */
function canvasScoreOf(c: CanvasRawCourse): Course['canvasScore'] {
  const e = c.enrollments?.find((x) => !x.type || x.type === 'student' || x.type === 'StudentEnrollment')
  if (!e) return null
  const period = e.multiple_grading_periods_enabled && e.current_period_computed_current_score != null
  const percent = period ? e.current_period_computed_current_score! : (e.computed_current_score ?? null)
  if (percent == null) return null
  return { percent, letter: (period ? e.current_period_computed_current_grade : e.computed_current_grade) ?? null, period: period ? (e.current_grading_period_title ?? null) : null }
}

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
/**
 * Is it really turned in? Canvas says "graded" also when a teacher typed a 0 for work that was never
 * turned in, so a grade alone doesn't mean done. Done = turned in (has a turn-in time), excused, or
 * graded with points (work handed in on paper). A 0 with nothing turned in stays open, as missing.
 */
export function submissionState(sub: CanvasRawSubmission): NonNullable<Assignment['canvasSubmission']>['state'] {
  if (sub.excused) return 'graded'
  if (sub.submitted_at) return sub.workflow_state === 'unsubmitted' ? 'submitted' : sub.workflow_state
  if (sub.missing || sub.late_policy_status === 'missing') return 'missing'
  if (sub.workflow_state === 'graded' && (sub.score ?? 0) > 0) return 'graded'
  return 'unsubmitted'
}

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
      canvasScore: canvasScoreOf(c),
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
        canvasSubmission: sub ? { state: submissionState(sub), submittedAt: sub.submitted_at, syncedAt, source: 'canvas' } : null,
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

  // Canvas To Do items that aren't assignments: ungraded quizzes, surveys, discussions, pages with a
  // to-do date. Without these, work Canvas lists as open would be missing here.
  const have = new Set(out.assignments.map((a) => a.id))
  for (const p of raw.planner ?? []) {
    const courseId = p.course_id ? courseByCode.get(`course_${p.course_id}`) : undefined
    if (!courseId || !['quiz', 'discussion_topic', 'wiki_page', 'assignment'].includes(p.plannable_type)) continue
    const linked = p.plannable_type === 'assignment' ? p.plannable_id : p.plannable.assignment_id
    if (linked) {
      // Already imported as an assignment: the planner only adds "marked done" from Canvas's To Do.
      const a = out.assignments.find((x) => x.id === canvasIdFor.assignment(linked))
      if (a && p.planner_override?.marked_complete && a.canvasSubmission?.state !== 'missing') a.canvasSubmission = { state: 'submitted', submittedAt: a.canvasSubmission?.submittedAt ?? null, syncedAt, source: 'canvas' }
      if (a || have.has(canvasIdFor.assignment(linked))) continue
    }
    const id = `cv_todo_${p.plannable_type}_${p.plannable_id}`
    if (have.has(id)) continue
    have.add(id)
    const subs = p.submissions
    const tracked = !!subs
    const state: NonNullable<Assignment['canvasSubmission']>['state'] = subs && (subs.submitted || subs.excused) ? 'submitted' : subs && subs.missing ? 'missing' : p.planner_override?.marked_complete ? 'submitted' : 'unsubmitted'
    out.assignments.push({
      id,
      courseId,
      title: p.plannable.title,
      description: '',
      dueAt: p.plannable.due_at ?? p.plannable.todo_date ?? p.plannable_date ?? null,
      priority: 'medium',
      estimatedMinutes: null,
      status: 'not_started',
      type: p.plannable_type === 'quiz' ? 'quiz' : p.plannable_type === 'discussion_topic' ? 'discussion' : p.plannable_type === 'wiki_page' ? 'reading' : 'other',
      submissionInstructions: '',
      rubricNotes: '',
      links: [],
      personalNotes: '',
      pointsPossible: p.plannable.points_possible ?? null,
      gradeCategoryId: null,
      moduleId: null,
      canvasSubmission: { state, submittedAt: null, syncedAt, source: 'canvas' },
      // Pages and anything Canvas doesn't track can be checked off by hand.
      canvasSubmissionTypes: tracked ? [p.plannable_type === 'quiz' ? 'online_quiz' : p.plannable_type === 'discussion_topic' ? 'discussion_topic' : 'online_upload'] : ['none'],
      source: 'canvas',
      canvasId: null,
      htmlUrl: p.html_url && /^https:\/\//.test(p.html_url) ? p.html_url : null,
      completedAt: null,
      createdAt: syncedAt,
      updatedAt: syncedAt,
    })
  }

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
