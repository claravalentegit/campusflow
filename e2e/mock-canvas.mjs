/**
 * A tiny fake Canvas LMS for tests and local demos of the sign-in flow.
 *   node e2e/mock-canvas.mjs [port]
 * Accepts the access token "mock-canvas-token-0123456789".
 * Data follows the shapes of the real Canvas REST API.
 */
import { createServer } from 'node:http'

export const MOCK_TOKEN = 'mock-canvas-token-0123456789'

export function startMockCanvas(port = 8898) {
  const valid = new Set([MOCK_TOKEN])
  const day = (d, h = 23, m = 59) => {
    const t = new Date()
    t.setDate(t.getDate() + d)
    t.setHours(h, m, 0, 0)
    return t.toISOString()
  }
  const sub = (state, extra = {}) => ({ workflow_state: state, submitted_at: state === 'unsubmitted' ? null : day(-1, 12), missing: false, ...extra })
  const courses = [
    { id: 501, name: 'Linear Algebra', course_code: 'MATH 415', term: { name: 'Fall 2026' }, teachers: [{ display_name: 'Prof. Ana Ruiz' }], public_description: '<p>Matrices, vector spaces and eigenvalues.</p>' },
    { id: 502, name: 'Intro to Sociology', course_code: 'SOC 100', term: { name: 'Fall 2026' }, teachers: [{ display_name: 'Dr. Kim Osei' }] },
    { id: 503, name: 'Organic Chemistry', course_code: 'CHEM 232', term: { name: 'Fall 2026' }, teachers: [{ display_name: 'Dr. Lee Park' }] },
  ]
  const assignments = {
    501: [
      { id: 9001, name: 'Homework 6: Eigenvalues', description: '<p>Problems 1–12 from section 5.2.</p>', due_at: day(1, 17, 0), points_possible: 20, submission_types: ['online_upload'], assignment_group_id: 1, submission: sub('unsubmitted') },
      { id: 9002, name: 'Homework 5: Determinants', description: '<p>Section 3.1–3.3.</p>', due_at: day(-5, 17, 0), points_possible: 20, submission_types: ['online_upload'], assignment_group_id: 1, submission: sub('graded', { score: 18, graded_at: day(-2, 9) }) },
      { id: 9003, name: 'Midterm Exam', description: '<p>Chapters 1–5. Calculator allowed.</p>', due_at: day(9, 10, 0), unlock_at: day(9, 8, 0), locked_for_user: true, points_possible: 100, submission_types: ['on_paper'], assignment_group_id: 2, submission: sub('unsubmitted') },
    ],
    502: [
      { id: 9101, name: 'Reading Response: Durkheim', description: '<p>500 words on <em>Suicide</em>, chapter 2.</p>', due_at: day(0, 23, 59), points_possible: 10, submission_types: ['online_text_entry'], assignment_group_id: 3, submission: sub('unsubmitted') },
      { id: 9102, name: 'Discussion: Social Norms', description: null, due_at: day(-1, 23, 59), lock_at: day(0, 0, 0), locked_for_user: true, lock_explanation: 'This discussion was locked Midnight.', points_possible: 5, submission_types: ['discussion_topic'], assignment_group_id: 3, submission: { workflow_state: 'unsubmitted', submitted_at: null, missing: true } },
    ],
    503: [
      { id: 9201, name: 'Lab Report 3: Distillation', description: '<p>Full report with error analysis.</p>', due_at: day(4, 17, 0), points_possible: 40, submission_types: ['online_upload'], assignment_group_id: 4, submission: sub('unsubmitted') },
    ],
  }
  const groups = { 501: [{ id: 1, name: 'Homework', group_weight: 40 }, { id: 2, name: 'Exams', group_weight: 60 }], 502: [{ id: 3, name: 'Coursework', group_weight: 0 }], 503: [{ id: 4, name: 'Labs', group_weight: 0 }] }
  const modules = { 501: [{ id: 71, name: 'Week 6 · Eigenvalues', position: 1, items: [{ id: 711, title: 'Lecture notes 5.1', type: 'File', completion_requirement: { completed: true } }, { id: 712, title: 'Homework 6: Eigenvalues', type: 'Assignment', content_id: 9001 }] }], 502: [], 503: [] }
  const announcements = { 501: [{ id: 81, title: 'Midterm review session Thursday', message: '<p>Room 141, 6–8 PM.</p>', posted_at: day(-1, 10), read_state: 'unread' }], 502: [], 503: [] }

  const auth = (req) => valid.has(String(req.headers.authorization ?? '').replace(/^Bearer /, ''))
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
    res.end(JSON.stringify(body))
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    const p = url.pathname
    // Test hook: pretend the student just submitted an assignment on Canvas.
    if (p.startsWith('/__test/submit/') && req.method === 'POST') {
      const id = Number(p.split('/').pop())
      for (const list of Object.values(assignments)) for (const a of list) if (a.id === id) a.submission = { workflow_state: 'submitted', submitted_at: new Date().toISOString(), missing: false }
      return send(res, 200, { ok: true })
    }
    // REST API
    if (!p.startsWith('/api/v1/')) return send(res, 404, { errors: [{ message: 'not found' }] })
    if (!auth(req)) return send(res, 401, { errors: [{ message: 'Invalid access token.' }] })
    const parts = p.slice('/api/v1/'.length).split('/')
    if (p === '/api/v1/users/self') return send(res, 200, { id: 42, name: 'Jordan Rivera' })
    if (p === '/api/v1/courses') return send(res, 200, courses)
    if (parts[0] === 'courses' && parts[2] === 'assignments') return send(res, 200, (assignments[parts[1]] ?? []).map((a) => ({ ...a, course_id: Number(parts[1]), html_url: `http://localhost:${port}/courses/${parts[1]}/assignments/${a.id}` })))
    if (parts[0] === 'courses' && parts[2] === 'assignment_groups') return send(res, 200, groups[parts[1]] ?? [])
    if (parts[0] === 'courses' && parts[2] === 'modules') return send(res, 200, modules[parts[1]] ?? [])
    if (p === '/api/v1/announcements') {
      const id = /course_(\d+)/.exec(url.search)?.[1]
      return send(res, 200, announcements[id] ?? [])
    }
    if (p === '/api/v1/calendar_events') return send(res, 200, [{ id: 'assignment_9003', title: 'Midterm Exam', start_at: day(9, 10, 0), end_at: day(9, 11, 30), context_code: 'course_501', assignment: { id: 9003 } }])
    return send(res, 404, { errors: [{ message: 'not found' }] })
  })
  return new Promise((resolve) => server.listen(port, () => resolve(server)))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] ?? 8898)
  await startMockCanvas(port)
  console.log(`Mock Canvas on http://localhost:${port} — token: ${MOCK_TOKEN}`)
}
