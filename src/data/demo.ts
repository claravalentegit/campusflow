import { addDays, set, startOfDay } from 'date-fns'
import { toLocalDay } from '@/domain/dates'
import { qualifyingBadges, type XpEvent } from '@/domain/game'
import type {
  Announcement,
  AppData,
  Assignment,
  AssignmentStatus,
  AssignmentType,
  CalendarEvent,
  Course,
  CourseModule,
  GradeRecord,
  ModuleItemType,
  Note,
  Priority,
  Reminder,
  Resource,
  StudySession,
  StudyTask,
} from '@/domain/types'

/**
 * Demo dataset. Every record is marked `source: 'demo'` and the UI labels it as sample data.
 * Dates are generated relative to `now` so the demo always has overdue, due-today and upcoming work.
 */
export function buildDemoData(now: Date = new Date()): AppData {
  const today = startOfDay(now)
  const at = (dayOffset: number, time: string) => {
    const [h, m] = time.split(':').map(Number)
    return set(addDays(today, dayOffset), { hours: h, minutes: m, seconds: 0, milliseconds: 0 }).toISOString()
  }
  const day = (offset: number) => toLocalDay(addDays(today, offset))
  const created = at(-40, '09:00')

  const course = (c: Partial<Course> & Pick<Course, 'id' | 'name' | 'code' | 'color' | 'icon'>): Course => ({
    instructor: null,
    description: '',
    term: 'Fall 2026',
    status: 'active',
    hidden: false,
    meetingInfo: null,
    gradeCategories: [],
    targetGrade: null,
    source: 'demo',
    canvasId: null,
    createdAt: created,
    ...c,
  })

  const courses: Course[] = [
    course({
      id: 'crs_psyc210',
      name: 'Cognitive Psychology',
      code: 'PSYC 210',
      instructor: 'Dr. Maya Okafor',
      description:
        'How people perceive, remember, think, and decide. Weekly readings are posted under Modules; quizzes open Monday and close Thursday night.',
      color: 'violet',
      icon: 'brain',
      meetingInfo: 'Mon/Wed 10:00–11:15 · Hughes Hall 204',
      gradeCategories: [
        { id: 'gc_psyc_quiz', name: 'Weekly quizzes', weight: 20 },
        { id: 'gc_psyc_papers', name: 'Response papers', weight: 30 },
        { id: 'gc_psyc_exams', name: 'Exams', weight: 50 },
      ],
      targetGrade: 90,
    }),
    course({
      id: 'crs_math241',
      name: 'Calculus III',
      code: 'MATH 241',
      instructor: 'Prof. Daniel Reyes',
      description: 'Vectors, partial derivatives, multiple integrals, and vector calculus. Problem sets are due Fridays at 5 PM on Gradescope; the Canvas page links to it.',
      color: 'sky',
      icon: 'calculator',
      meetingInfo: 'Tue/Thu 13:00–14:15 · Altgeld 145',
      gradeCategories: [
        { id: 'gc_math_ps', name: 'Problem sets', weight: 30 },
        { id: 'gc_math_mid', name: 'Midterms', weight: 40 },
        { id: 'gc_math_final', name: 'Final exam', weight: 30 },
      ],
      targetGrade: 85,
    }),
    course({
      id: 'crs_cs225',
      name: 'Data Structures',
      code: 'CS 225',
      instructor: 'Prof. Priya Natarajan',
      description: 'Design and analysis of fundamental data structures in C++. MPs are released on the course site; lab attendance is recorded on Canvas.',
      color: 'indigo',
      icon: 'code',
      meetingInfo: 'Mon/Wed/Fri 14:00–14:50 · Siebel 1404',
      gradeCategories: [
        { id: 'gc_cs_mp', name: 'Machine problems', weight: 40 },
        { id: 'gc_cs_lab', name: 'Labs', weight: 10 },
        { id: 'gc_cs_exam', name: 'Exams', weight: 50 },
      ],
    }),
    course({
      id: 'crs_engl102',
      name: 'Writing & Rhetoric',
      code: 'ENGL 102',
      instructor: 'Dr. Hannah Lindqvist',
      description: 'Research-based argumentative writing. The semester builds toward a 10–12 page research paper. Instructions are split between Pages and Files — the syllabus PDF is the source of truth.',
      color: 'rose',
      icon: 'pen',
      meetingInfo: 'Tue/Thu 09:30–10:45 · English Building 108',
    }),
    course({
      id: 'crs_biol150',
      name: 'Introductory Biology',
      code: 'BIOL 150',
      instructor: 'Dr. Samuel Osei',
      description: 'Cells, genetics, evolution, and ecology, with a weekly wet lab. Lab reports are due one week after your lab section.',
      color: 'emerald',
      icon: 'microscope',
      meetingInfo: 'Lecture Mon/Wed 12:00 · Lab Thu 15:00',
      gradeCategories: [
        { id: 'gc_bio_lab', name: 'Lab reports', weight: 35 },
        { id: 'gc_bio_exam', name: 'Exams', weight: 50 },
        { id: 'gc_bio_part', name: 'Participation', weight: 15 },
      ],
    }),
    course({
      id: 'crs_hist101',
      name: 'World History to 1500',
      code: 'HIST 101',
      instructor: 'Dr. Lena Park',
      description: 'Completed last term.',
      color: 'amber',
      icon: 'landmark',
      term: 'Spring 2026',
      status: 'completed',
    }),
  ]

  const assignment = (
    a: Pick<Assignment, 'id' | 'courseId' | 'title' | 'dueAt'> & {
      type: AssignmentType
      status?: AssignmentStatus
      priority?: Priority
    } & Partial<Assignment>,
  ): Assignment => ({
    description: '',
    priority: 'medium',
    estimatedMinutes: null,
    status: 'not_started',
    submissionInstructions: '',
    rubricNotes: '',
    links: [],
    personalNotes: '',
    pointsPossible: null,
    gradeCategoryId: null,
    moduleId: null,
    canvasSubmission: null,
    source: 'demo',
    canvasId: null,
    htmlUrl: null,
    completedAt: null,
    createdAt: created,
    updatedAt: created,
    ...a,
  })
  const demoSubmitted = (offset: number, state: 'submitted' | 'graded' = 'graded') => ({
    state,
    submittedAt: at(offset, '20:14'),
    syncedAt: now.toISOString(),
    source: 'demo' as const,
  })

  const assignments: Assignment[] = [
    // ENGL 102 — the big research paper with a breakdown
    assignment({
      id: 'asg_engl_paper',
      courseId: 'crs_engl102',
      title: 'Research Paper: Final Draft',
      type: 'essay',
      dueAt: at(9, '23:59'),
      priority: 'high',
      status: 'in_progress',
      estimatedMinutes: 900,
      pointsPossible: 200,
      moduleId: 'mod_engl_3',
      description:
        'Write a 10–12 page argumentative research paper on a debatable question in your field of interest. Your argument must engage at least eight credible sources, at least five of them peer-reviewed.',
      submissionInstructions: 'Upload a single .docx or PDF to the Canvas assignment. Use MLA 9 formatting. Include an annotated bibliography as an appendix (not counted toward page length).',
      rubricNotes: 'Thesis & argument 30% · Use of evidence 30% · Organization 20% · Style & mechanics 10% · Citations 10%. Dr. Lindqvist mentioned in class that counter-arguments weigh heavily under "argument".',
      personalNotes: 'Topic: whether four-day school weeks improve student outcomes. Office hours Thursday to check thesis.',
      links: [
        { id: 'lnk_1', label: 'Purdue OWL — MLA 9 guide', url: 'https://owl.purdue.edu/owl/research_and_citation/mla_style/mla_formatting_and_style_guide/mla_general_format.html' },
        { id: 'lnk_2', label: 'Library databases', url: 'https://www.jstor.org/' },
      ],
    }),
    assignment({
      id: 'asg_engl_annot',
      courseId: 'crs_engl102',
      title: 'Annotated Bibliography',
      type: 'essay',
      dueAt: at(-6, '23:59'),
      status: 'submitted',
      estimatedMinutes: 240,
      pointsPossible: 50,
      moduleId: 'mod_engl_2',
      completedAt: at(-6, '21:40'),
      canvasSubmission: demoSubmitted(-6),
      description: 'Eight sources, each with a 150-word annotation summarizing and evaluating the source.',
    }),
    assignment({
      id: 'asg_engl_peer',
      courseId: 'crs_engl102',
      title: 'Peer Review: Draft Exchange',
      type: 'discussion',
      dueAt: at(2, '17:00'),
      priority: 'medium',
      estimatedMinutes: 60,
      pointsPossible: 20,
      moduleId: 'mod_engl_3',
      description: 'Read your partner’s draft and leave comments using the peer-review worksheet in Files > Week 9.',
      submissionInstructions: 'Post your completed worksheet as a reply in the Week 9 discussion thread.',
    }),
    // PSYC 210
    assignment({
      id: 'asg_psyc_quiz7',
      courseId: 'crs_psyc210',
      title: 'Quiz 7: Working Memory',
      type: 'quiz',
      dueAt: at(0, '23:59'),
      priority: 'high',
      estimatedMinutes: 30,
      pointsPossible: 10,
      gradeCategoryId: 'gc_psyc_quiz',
      moduleId: 'mod_psyc_3',
      description: 'Ten multiple-choice questions on chapters 6–7. Untimed, one attempt.',
      submissionInstructions: 'Take on Canvas. Closes at 11:59 PM — no late submissions.',
    }),
    assignment({
      id: 'asg_psyc_resp3',
      courseId: 'crs_psyc210',
      title: 'Response Paper 3: False Memories',
      type: 'essay',
      dueAt: at(4, '10:00'),
      priority: 'medium',
      estimatedMinutes: 180,
      pointsPossible: 100,
      gradeCategoryId: 'gc_psyc_papers',
      moduleId: 'mod_psyc_3',
      description: '2–3 pages responding to Loftus & Palmer (1974) and the assigned podcast. Connect at least one finding to an experience of your own.',
      submissionInstructions: 'Submit as PDF on Canvas before class.',
      rubricNotes: 'Summary 30 · Analysis 50 · Writing 20',
    }),
    assignment({
      id: 'asg_psyc_quiz6',
      courseId: 'crs_psyc210',
      title: 'Quiz 6: Attention',
      type: 'quiz',
      dueAt: at(-7, '23:59'),
      status: 'completed',
      pointsPossible: 10,
      gradeCategoryId: 'gc_psyc_quiz',
      moduleId: 'mod_psyc_2',
      completedAt: at(-8, '19:00'),
      canvasSubmission: demoSubmitted(-8),
    }),
    assignment({
      id: 'asg_psyc_resp2',
      courseId: 'crs_psyc210',
      title: 'Response Paper 2: Perception',
      type: 'essay',
      dueAt: at(-14, '10:00'),
      status: 'completed',
      pointsPossible: 100,
      gradeCategoryId: 'gc_psyc_papers',
      moduleId: 'mod_psyc_2',
      completedAt: at(-15, '22:00'),
      canvasSubmission: demoSubmitted(-15),
    }),
    assignment({
      id: 'asg_psyc_mid',
      courseId: 'crs_psyc210',
      title: 'Midterm Exam 2',
      type: 'exam',
      dueAt: at(13, '10:00'),
      priority: 'high',
      estimatedMinutes: 360,
      pointsPossible: 100,
      gradeCategoryId: 'gc_psyc_exams',
      description: 'Covers chapters 5–9. In person, 75 minutes. Bring a No. 2 pencil.',
    }),
    // MATH 241
    assignment({
      id: 'asg_math_ps8',
      courseId: 'crs_math241',
      title: 'Problem Set 8: Double Integrals',
      type: 'problem_set',
      dueAt: at(2, '17:00'),
      priority: 'high',
      status: 'in_progress',
      estimatedMinutes: 240,
      pointsPossible: 50,
      gradeCategoryId: 'gc_math_ps',
      moduleId: 'mod_math_3',
      description: 'Section 15.2–15.4: problems 6, 12, 18, 24, 31, 40, 44. Show all work.',
      submissionInstructions: 'Upload to Gradescope (linked from Canvas) and tag pages for each problem.',
    }),
    assignment({
      id: 'asg_math_ps7',
      courseId: 'crs_math241',
      title: 'Problem Set 7: Lagrange Multipliers',
      type: 'problem_set',
      dueAt: at(-1, '17:00'),
      priority: 'high',
      estimatedMinutes: 120,
      pointsPossible: 50,
      gradeCategoryId: 'gc_math_ps',
      moduleId: 'mod_math_2',
      description: 'Section 14.8: problems 3, 9, 15, 22, 27. Late work accepted for 48 hours at 20% off.',
      personalNotes: 'Still have #22 and #27 left. Late window closes tomorrow 5 PM.',
      status: 'in_progress',
    }),
    assignment({
      id: 'asg_biol_reading11',
      courseId: 'crs_biol150',
      title: 'Reading Check: Chapter 11',
      type: 'quiz',
      dueAt: at(-2, '23:59'),
      priority: 'medium',
      estimatedMinutes: 20,
      pointsPossible: 10,
      description: '10-question check on chapter 11 (gene expression). Open until Friday for late credit.',
    }),
    assignment({
      id: 'asg_math_ps6',
      courseId: 'crs_math241',
      title: 'Problem Set 6: Chain Rule',
      type: 'problem_set',
      dueAt: at(-8, '17:00'),
      status: 'completed',
      pointsPossible: 50,
      gradeCategoryId: 'gc_math_ps',
      completedAt: at(-8, '14:00'),
      canvasSubmission: demoSubmitted(-8),
    }),
    assignment({
      id: 'asg_math_mid2',
      courseId: 'crs_math241',
      title: 'Midterm 2',
      type: 'exam',
      dueAt: at(8, '19:00'),
      priority: 'high',
      estimatedMinutes: 480,
      pointsPossible: 100,
      gradeCategoryId: 'gc_math_mid',
      description: 'Chapters 14–15. Evening exam, room assignments posted the week before. One handwritten 3×5 note card allowed.',
    }),
    // CS 225
    assignment({
      id: 'asg_cs_mp4',
      courseId: 'crs_cs225',
      title: 'MP4: Flood Fill',
      type: 'project',
      dueAt: at(5, '23:59'),
      priority: 'high',
      status: 'in_progress',
      estimatedMinutes: 600,
      pointsPossible: 100,
      gradeCategoryId: 'gc_cs_mp',
      moduleId: 'mod_cs_3',
      description: 'Implement BFS and DFS traversals over a PNG image and use them to animate flood fills. Part 1 (traversals) autograder runs nightly.',
      submissionInstructions: 'Commit and push to your course GitHub repo. The latest commit before the deadline is graded.',
      rubricNotes: 'Autograder 90% · Code style 10%. Memory leaks lose points.',
    }),
    assignment({
      id: 'asg_cs_lab9',
      courseId: 'crs_cs225',
      title: 'Lab 9: Heaps',
      type: 'lab',
      dueAt: at(1, '23:59'),
      priority: 'medium',
      estimatedMinutes: 90,
      pointsPossible: 10,
      gradeCategoryId: 'gc_cs_lab',
      moduleId: 'mod_cs_3',
      description: 'Finish heapifyDown and the heap constructor started in lab.',
    }),
    assignment({
      id: 'asg_cs_lab8',
      courseId: 'crs_cs225',
      title: 'Lab 8: Hash Tables',
      type: 'lab',
      dueAt: at(-6, '23:59'),
      status: 'completed',
      pointsPossible: 10,
      gradeCategoryId: 'gc_cs_lab',
      completedAt: at(-6, '18:00'),
      canvasSubmission: demoSubmitted(-6),
    }),
    assignment({
      id: 'asg_cs_mp3',
      courseId: 'crs_cs225',
      title: 'MP3: Linked Lists',
      type: 'project',
      dueAt: at(-12, '23:59'),
      status: 'completed',
      pointsPossible: 100,
      gradeCategoryId: 'gc_cs_mp',
      completedAt: at(-12, '22:30'),
      canvasSubmission: demoSubmitted(-12),
    }),
    // BIOL 150
    assignment({
      id: 'asg_bio_lab6',
      courseId: 'crs_biol150',
      title: 'Lab Report 6: Enzyme Kinetics',
      type: 'lab',
      dueAt: at(0, '17:00'),
      priority: 'high',
      status: 'in_progress',
      estimatedMinutes: 150,
      pointsPossible: 40,
      gradeCategoryId: 'gc_bio_lab',
      moduleId: 'mod_bio_3',
      description: 'Report on the catalase experiment: introduction, methods, results with a Michaelis–Menten plot, and discussion.',
      submissionInstructions: 'Submit to Canvas as PDF. Your TA grades within a week.',
    }),
    assignment({
      id: 'asg_bio_reading',
      courseId: 'crs_biol150',
      title: 'Read Chapter 12: Meiosis',
      type: 'reading',
      dueAt: at(3, '12:00'),
      priority: 'low',
      estimatedMinutes: 60,
      moduleId: 'mod_bio_3',
    }),
    assignment({
      id: 'asg_bio_lab5',
      courseId: 'crs_biol150',
      title: 'Lab Report 5: Osmosis',
      type: 'lab',
      dueAt: at(-7, '17:00'),
      status: 'submitted',
      pointsPossible: 40,
      gradeCategoryId: 'gc_bio_lab',
      completedAt: at(-7, '15:10'),
      // No Canvas state: the student self-reported it, so the app does not know the official status.
    }),
    assignment({
      id: 'asg_bio_disc',
      courseId: 'crs_biol150',
      title: 'Discussion: CRISPR Ethics',
      type: 'discussion',
      dueAt: at(11, '23:59'),
      priority: 'low',
      estimatedMinutes: 45,
      pointsPossible: 10,
      gradeCategoryId: 'gc_bio_part',
    }),
    assignment({
      id: 'asg_bio_exam2',
      courseId: 'crs_biol150',
      title: 'Exam 2',
      type: 'exam',
      dueAt: at(16, '12:00'),
      priority: 'medium',
      estimatedMinutes: 300,
      pointsPossible: 100,
      gradeCategoryId: 'gc_bio_exam',
    }),
    // HIST 101 (completed course)
    assignment({
      id: 'asg_hist_final',
      courseId: 'crs_hist101',
      title: 'Final Essay',
      type: 'essay',
      dueAt: at(-160, '23:59'),
      status: 'completed',
      pointsPossible: 100,
      completedAt: at(-161, '20:00'),
    }),
  ]

  let pos = 0
  const task = (t: Pick<StudyTask, 'id' | 'title'> & Partial<StudyTask>): StudyTask => ({
    courseId: null,
    assignmentId: null,
    plannedFor: null,
    dueAt: null,
    estimatedMinutes: null,
    priority: 'medium',
    done: false,
    position: pos++,
    createdAt: created,
    completedAt: null,
    ...t,
  })
  const paperStep = (id: string, title: string, minutes: number, plannedOffset: number, done = false) =>
    task({ id, title, courseId: 'crs_engl102', assignmentId: 'asg_engl_paper', estimatedMinutes: minutes, plannedFor: day(plannedOffset), done, completedAt: done ? at(plannedOffset, '18:00') : null, priority: 'high' })
  const tasks: StudyTask[] = [
    paperStep('tsk_p1', 'Review the assignment instructions and rubric', 30, -5, true),
    paperStep('tsk_p2', 'Find and evaluate sources', 180, -3, true),
    paperStep('tsk_p3', 'Create an outline and thesis', 90, 0),
    paperStep('tsk_p4', 'Draft the introduction and main sections', 300, 3),
    paperStep('tsk_p5', 'Revise and verify citations', 180, 6),
    paperStep('tsk_p6', 'Proofread and prepare the final submission', 60, 8),
    task({ id: 'tsk_cs1', title: 'Implement BFS traversal iterator', courseId: 'crs_cs225', assignmentId: 'asg_cs_mp4', estimatedMinutes: 180, plannedFor: day(-1), done: true, completedAt: at(-1, '21:00') }),
    task({ id: 'tsk_cs2', title: 'Implement DFS traversal iterator', courseId: 'crs_cs225', assignmentId: 'asg_cs_mp4', estimatedMinutes: 120, plannedFor: day(1) }),
    task({ id: 'tsk_cs3', title: 'Write FloodFilledImage animation', courseId: 'crs_cs225', assignmentId: 'asg_cs_mp4', estimatedMinutes: 180, plannedFor: day(3) }),
    task({ id: 'tsk_cs4', title: 'Run valgrind and clean up style', courseId: 'crs_cs225', assignmentId: 'asg_cs_mp4', estimatedMinutes: 60, plannedFor: day(4) }),
    task({ id: 'tsk_s1', title: 'Email Prof. Reyes about midterm room conflict', courseId: 'crs_math241', estimatedMinutes: 10, plannedFor: day(0), priority: 'high' }),
    task({ id: 'tsk_s2', title: 'Make flashcards for chapters 6–7', courseId: 'crs_psyc210', estimatedMinutes: 45, plannedFor: day(0) }),
    task({ id: 'tsk_s3', title: 'Return library books', estimatedMinutes: 15, plannedFor: day(1), priority: 'low' }),
    task({ id: 'tsk_s4', title: 'Rework Lagrange practice problems', courseId: 'crs_math241', estimatedMinutes: 60, plannedFor: day(5) }),
  ]

  const session = (s: Pick<StudySession, 'id' | 'title' | 'start' | 'end'> & Partial<StudySession>): StudySession => ({
    courseId: null,
    assignmentId: null,
    taskId: null,
    completed: false,
    logged: false,
    ...s,
  })
  const sessions: StudySession[] = [
    session({ id: 'ses_1', title: 'Math study group', courseId: 'crs_math241', assignmentId: 'asg_math_ps8', start: at(1, '18:00'), end: at(1, '20:00') }),
    session({ id: 'ses_2', title: 'Midterm 2 review: chapter 14', courseId: 'crs_math241', assignmentId: 'asg_math_mid2', start: at(5, '15:00'), end: at(5, '17:00') }),
    session({ id: 'ses_3', title: 'Midterm 2 practice exam', courseId: 'crs_math241', assignmentId: 'asg_math_mid2', start: at(7, '14:00'), end: at(7, '17:00') }),
    session({ id: 'ses_4', title: 'Focus: Find and evaluate sources', courseId: 'crs_engl102', assignmentId: 'asg_engl_paper', start: at(-3, '14:00'), end: at(-3, '15:30'), completed: true, logged: true }),
  ]

  const event = (e: Pick<CalendarEvent, 'id' | 'title' | 'start' | 'kind'> & Partial<CalendarEvent>): CalendarEvent => ({
    courseId: null,
    end: null,
    allDay: false,
    location: '',
    notes: '',
    source: 'demo',
    canvasId: null,
    linkedAssignmentId: null,
    ...e,
  })
  const events: CalendarEvent[] = [
    event({ id: 'evt_1', title: 'Writing Center appointment', kind: 'event', courseId: 'crs_engl102', start: at(2, '11:00'), end: at(2, '11:45'), location: 'Undergrad Library, Room 251' }),
    event({ id: 'evt_2', title: 'Dr. Lindqvist office hours', kind: 'event', courseId: 'crs_engl102', start: at(3, '13:00'), end: at(3, '14:00'), location: 'English Building 312' }),
    event({ id: 'evt_3', title: 'CS 225 exam review session', kind: 'event', courseId: 'crs_cs225', start: at(6, '19:00'), end: at(6, '21:00'), location: 'Siebel 1404' }),
    event({ id: 'evt_4', title: 'Thanksgiving break — no classes', kind: 'event', start: at(27, '00:00'), allDay: true }),
    // A Canvas-style calendar entry for the same exam as an assignment. Deduplicated in the calendar.
    event({ id: 'evt_5', title: 'Midterm 2', kind: 'exam', courseId: 'crs_math241', start: at(8, '19:00'), end: at(8, '20:30'), linkedAssignmentId: 'asg_math_mid2' }),
  ]

  const reminders: Reminder[] = [
    { id: 'rem_1', title: 'Register for spring classes — window opens', remindAt: at(6, '08:00'), courseId: null, assignmentId: null, done: false, createdAt: created },
    { id: 'rem_2', title: 'Submit PS7 before the late window closes', remindAt: at(0, '09:00'), courseId: 'crs_math241', assignmentId: 'asg_math_ps7', done: false, createdAt: created },
  ]

  const announcement = (a: Pick<Announcement, 'id' | 'courseId' | 'title' | 'body' | 'postedAt'> & Partial<Announcement>): Announcement => ({
    important: false,
    read: false,
    source: 'demo',
    canvasId: null,
    ...a,
  })
  const announcements: Announcement[] = [
    announcement({ id: 'ann_1', courseId: 'crs_math241', title: 'Midterm 2 room assignments', body: 'Last names A–L: Foellinger Auditorium. M–Z: Lincoln Hall Theater. Bring your student ID.', postedAt: at(-1, '16:20'), important: true }),
    announcement({ id: 'ann_2', courseId: 'crs_engl102', title: 'Research paper due date moved', body: 'Per student requests the final draft is now due a week later than the syllabus says. The Canvas due date has been updated; the syllabus PDF has not.', postedAt: at(-3, '10:05'), important: true }),
    announcement({ id: 'ann_3', courseId: 'crs_psyc210', title: 'Quiz 7 is open', body: 'Quiz 7 covers chapters 6–7 and closes tonight at 11:59 PM.', postedAt: at(-2, '08:00') }),
    announcement({ id: 'ann_4', courseId: 'crs_cs225', title: 'MP4 autograder is live', body: 'Nightly autograder runs at 2 AM. Check your repo for feedback files.', postedAt: at(-4, '12:00'), read: true }),
    announcement({ id: 'ann_5', courseId: 'crs_biol150', title: 'Lab section swap', body: 'Thursday sections meet in Burrill 124 this week due to maintenance.', postedAt: at(-2, '17:45') }),
  ]

  const mod = (
    id: string,
    courseId: string,
    title: string,
    position: number,
    items: Array<[string, ModuleItemType, boolean, string?]>,
  ): CourseModule => ({
    id,
    courseId,
    title,
    position,
    source: 'demo',
    canvasId: null,
    items: items.map(([t, type, completed, assignmentId], i) => ({ id: `${id}_i${i}`, title: t, type, completed, assignmentId: assignmentId ?? null, url: null })),
  })
  const modules: CourseModule[] = [
    mod('mod_psyc_1', 'crs_psyc210', 'Week 1–3 · Foundations', 0, [['Syllabus & course policies', 'page', true], ['Ch. 1–2 reading', 'reading', true], ['Lecture: History of cognitive psychology', 'lecture', true], ['Quiz 1–3', 'quiz', true]]),
    mod('mod_psyc_2', 'crs_psyc210', 'Week 4–6 · Perception & Attention', 1, [['Ch. 3–4 reading', 'reading', true], ['Lecture: Selective attention', 'lecture', true], ['Quiz 6: Attention', 'quiz', true, 'asg_psyc_quiz6'], ['Response Paper 2', 'assignment', true, 'asg_psyc_resp2']]),
    mod('mod_psyc_3', 'crs_psyc210', 'Week 7–9 · Memory', 2, [['Ch. 6–7 reading', 'reading', true], ['Lecture: Working memory models', 'lecture', false], ['Loftus & Palmer (1974) PDF', 'file', false], ['Quiz 7: Working Memory', 'quiz', false, 'asg_psyc_quiz7'], ['Response Paper 3', 'assignment', false, 'asg_psyc_resp3']]),
    mod('mod_math_1', 'crs_math241', 'Chapter 13 · Vector Functions', 0, [['Lecture notes 13.1–13.4', 'file', true], ['Problem Sets 1–3', 'assignment', true]]),
    mod('mod_math_2', 'crs_math241', 'Chapter 14 · Partial Derivatives', 1, [['Lecture notes 14.1–14.8', 'file', true], ['Video: Lagrange multipliers', 'lecture', true], ['Problem Set 7', 'assignment', false, 'asg_math_ps7']]),
    mod('mod_math_3', 'crs_math241', 'Chapter 15 · Multiple Integrals', 2, [['Lecture notes 15.1–15.4', 'file', false], ['Gradescope link', 'link', false], ['Problem Set 8', 'assignment', false, 'asg_math_ps8'], ['Practice midterm', 'file', false]]),
    mod('mod_cs_1', 'crs_cs225', 'Unit 1 · C++ & Memory', 0, [['Lecture slides: pointers & references', 'file', true], ['MP1–MP2', 'assignment', true]]),
    mod('mod_cs_2', 'crs_cs225', 'Unit 2 · Lists, Trees & Hashing', 1, [['Lecture: AVL trees', 'lecture', true], ['MP3: Linked Lists', 'assignment', true, 'asg_cs_mp3'], ['Lab 8: Hash Tables', 'assignment', true, 'asg_cs_lab8']]),
    mod('mod_cs_3', 'crs_cs225', 'Unit 3 · Heaps & Graphs', 2, [['Lecture: Heaps', 'lecture', true], ['Lecture: Graph traversal', 'lecture', false], ['Lab 9: Heaps', 'assignment', false, 'asg_cs_lab9'], ['MP4: Flood Fill', 'assignment', false, 'asg_cs_mp4'], ['Exam 2 topic list', 'page', false]]),
    mod('mod_engl_1', 'crs_engl102', 'Unit 1 · Rhetorical Analysis', 0, [['Syllabus (PDF)', 'file', true], ['They Say / I Say ch. 1–3', 'reading', true], ['Discussion: Analyzing an op-ed', 'discussion', true]]),
    mod('mod_engl_2', 'crs_engl102', 'Unit 2 · Finding Sources', 1, [['Library research workshop', 'lecture', true], ['Annotated Bibliography', 'assignment', true, 'asg_engl_annot']]),
    mod('mod_engl_3', 'crs_engl102', 'Unit 3 · The Research Paper', 2, [['Research paper instructions (Page)', 'page', true], ['Peer-review worksheet (File)', 'file', false], ['Peer Review: Draft Exchange', 'discussion', false, 'asg_engl_peer'], ['Research Paper: Final Draft', 'assignment', false, 'asg_engl_paper']]),
    mod('mod_bio_1', 'crs_biol150', 'Unit 1 · Cells', 0, [['Ch. 4–6 reading', 'reading', true], ['Lab safety quiz', 'quiz', true]]),
    mod('mod_bio_2', 'crs_biol150', 'Unit 2 · Energy & Enzymes', 1, [['Ch. 8–9 reading', 'reading', true], ['Lab Report 5: Osmosis', 'assignment', true, 'asg_bio_lab5']]),
    mod('mod_bio_3', 'crs_biol150', 'Unit 3 · Genetics', 2, [['Lab Report 6: Enzyme Kinetics', 'assignment', false, 'asg_bio_lab6'], ['Read Chapter 12: Meiosis', 'reading', false, 'asg_bio_reading'], ['Lecture: Mendelian inheritance', 'lecture', false]]),
  ]

  const grade = (id: string, courseId: string, assignmentId: string | null, title: string, categoryId: string | null, score: number, outOf: number, offset: number): GradeRecord => ({
    id,
    courseId,
    assignmentId,
    title,
    categoryId,
    score,
    outOf,
    source: 'demo',
    gradedAt: at(offset, '12:00'),
  })
  const grades: GradeRecord[] = [
    grade('grd_1', 'crs_psyc210', null, 'Quiz 1', 'gc_psyc_quiz', 9, 10, -50),
    grade('grd_2', 'crs_psyc210', null, 'Quiz 2', 'gc_psyc_quiz', 8, 10, -43),
    grade('grd_3', 'crs_psyc210', null, 'Quiz 3', 'gc_psyc_quiz', 10, 10, -36),
    grade('grd_4', 'crs_psyc210', null, 'Response Paper 1', 'gc_psyc_papers', 86, 100, -30),
    grade('grd_5', 'crs_psyc210', null, 'Midterm Exam 1', 'gc_psyc_exams', 84, 100, -24),
    grade('grd_6', 'crs_psyc210', 'asg_psyc_resp2', 'Response Paper 2', 'gc_psyc_papers', 91, 100, -10),
    grade('grd_7', 'crs_psyc210', 'asg_psyc_quiz6', 'Quiz 6: Attention', 'gc_psyc_quiz', 7, 10, -6),
    grade('grd_8', 'crs_math241', null, 'Problem Sets 1–5 (total)', 'gc_math_ps', 221, 250, -15),
    grade('grd_9', 'crs_math241', null, 'Midterm 1', 'gc_math_mid', 76, 100, -28),
    grade('grd_10', 'crs_math241', 'asg_math_ps6', 'Problem Set 6: Chain Rule', 'gc_math_ps', 46, 50, -5),
    grade('grd_11', 'crs_cs225', 'asg_cs_mp3', 'MP3: Linked Lists', 'gc_cs_mp', 94, 100, -9),
    grade('grd_12', 'crs_cs225', 'asg_cs_lab8', 'Lab 8: Hash Tables', 'gc_cs_lab', 10, 10, -4),
    grade('grd_13', 'crs_cs225', null, 'Exam 1', 'gc_cs_exam', 81, 100, -21),
    grade('grd_14', 'crs_engl102', 'asg_engl_annot', 'Annotated Bibliography', null, 45, 50, -2),
    grade('grd_15', 'crs_engl102', null, 'Rhetorical Analysis Essay', null, 88, 100, -25),
    grade('grd_16', 'crs_biol150', null, 'Lab Reports 1–4 (total)', 'gc_bio_lab', 142, 160, -12),
    grade('grd_17', 'crs_biol150', null, 'Exam 1', 'gc_bio_exam', 79, 100, -26),
  ]

  const note = (n: Pick<Note, 'id' | 'title' | 'body'> & Partial<Note>): Note => ({
    courseId: null,
    moduleId: null,
    assignmentId: null,
    taskId: null,
    tags: [],
    favorite: false,
    createdAt: created,
    updatedAt: at(-2, '20:00'),
    ...n,
  })
  const notes: Note[] = [
    note({
      id: 'nte_1',
      title: 'Research paper — working thesis',
      courseId: 'crs_engl102',
      assignmentId: 'asg_engl_paper',
      moduleId: 'mod_engl_3',
      tags: ['thesis', 'paper'],
      favorite: true,
      body: 'Working thesis: Four-day school weeks save districts money but, without added instructional time, they widen achievement gaps for younger students.\n\nCounter-argument to address:\n- Teacher retention gains (Thompson 2021)\n- Attendance improvements in rural districts\n\nAsk at office hours: is a policy brief an acceptable source?',
    }),
    note({
      id: 'nte_2',
      title: 'Working memory — Baddeley model',
      courseId: 'crs_psyc210',
      moduleId: 'mod_psyc_3',
      tags: ['exam2', 'memory'],
      body: 'Components:\n- Phonological loop (inner voice, ~2 s of speech)\n- Visuospatial sketchpad\n- Central executive (attention control)\n- Episodic buffer (added 2000)\n\nKey evidence: word-length effect, articulatory suppression.',
    }),
    note({
      id: 'nte_3',
      title: 'Double integrals — when to switch to polar',
      courseId: 'crs_math241',
      tags: ['midterm2'],
      body: 'Switch to polar when the region is a disk/annulus/sector or the integrand has x² + y².\nRemember the extra r: dA = r dr dθ.',
    }),
  ]

  const resource = (r: Pick<Resource, 'id' | 'title' | 'kind'> & Partial<Resource>): Resource => ({
    url: null,
    description: '',
    courseId: null,
    moduleId: null,
    assignmentId: null,
    tags: [],
    favorite: false,
    file: null,
    createdAt: created,
    ...r,
  })
  const resources: Resource[] = [
    resource({ id: 'res_1', title: 'Paul’s Online Math Notes — Double Integrals', kind: 'link', url: 'https://tutorial.math.lamar.edu/Classes/CalcIII/DoubleIntegrals.aspx', courseId: 'crs_math241', moduleId: 'mod_math_3', tags: ['midterm2'], favorite: true, description: 'Clear worked examples for 15.1–15.4.' }),
    resource({ id: 'res_2', title: 'Purdue OWL — MLA Formatting', kind: 'link', url: 'https://owl.purdue.edu/owl/research_and_citation/mla_style/mla_formatting_and_style_guide/mla_general_format.html', courseId: 'crs_engl102', assignmentId: 'asg_engl_paper', tags: ['citations'] }),
    resource({ id: 'res_3', title: 'VisuAlgo — Graph traversal', kind: 'link', url: 'https://visualgo.net/en/dfsbfs', courseId: 'crs_cs225', moduleId: 'mod_cs_3', tags: ['mp4'], description: 'Step-through animations of BFS and DFS.' }),
    resource({ id: 'res_4', title: 'Textbook: Goldstein, Cognitive Psychology 5e', kind: 'reference', courseId: 'crs_psyc210', tags: ['textbook'], description: 'Library reserve, call number BF201 .G65 2018.' }),
    resource({ id: 'res_5', title: 'Khan Academy — Enzyme kinetics', kind: 'link', url: 'https://www.khanacademy.org/science/biology/energy-and-enzymes', courseId: 'crs_biol150', moduleId: 'mod_bio_3', tags: ['lab6'] }),
  ]

  // Game history: XP for the demo's completed work, plus earlier sample days so the demo starts
  // mid-semester with a 5-day streak. Today starts at 0 so you can play today's quest.
  const xpEvents: XpEvent[] = []
  let n = 0
  for (const a of assignments) {
    if (!a.completedAt) continue
    xpEvents.push({ id: `xp_demo_${n++}`, at: a.completedAt, amount: 40, kind: 'assignment', refId: a.id })
  }
  for (const t of tasks) {
    if (!t.done || !t.completedAt) continue
    xpEvents.push({ id: `xp_demo_${n++}`, at: t.completedAt, amount: 20, kind: 'task', refId: t.id })
  }
  for (let d = 1; d <= 16; d++) {
    if (d === 6) continue // a missed day, so the streak is 5
    const have = xpEvents.filter((e) => toLocalDay(new Date(e.at)) === day(-d)).length
    for (let i = have; i < 3; i++) xpEvents.push({ id: `xp_demo_${n++}`, at: at(-d, `${14 + i * 2}:15`), amount: 25 + ((d * 7 + i * 11) % 30), kind: 'task', refId: `demo-history-${d}-${i}` })
  }
  const badges = [...qualifyingBadges(xpEvents, now, 3)].map((id) => ({ id, at: at(-2, '18:00') }))

  return {
    xpEvents,
    badges,
    courses,
    announcements,
    modules,
    assignments,
    tasks,
    sessions,
    events,
    reminders,
    notes,
    resources,
    grades,
    dismissedNotificationIds: [],
  }
}
