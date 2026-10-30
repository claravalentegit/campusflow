/**
 * Family sharing: a student links parent devices to their CampusFlow account.
 *
 * - The student (signed in with Canvas) creates a 6-digit code. It works once, for 15 minutes.
 * - A parent enters it and gets their own device token (kept in an HttpOnly cookie; only its hash
 *   is stored). No Canvas account, no password.
 * - The student's app uploads a snapshot of their CampusFlow data; linked parents can read it.
 *   Snapshots are only kept while at least one parent is linked.
 * - The student always sees who is linked and can remove anyone; the parent is then told sharing
 *   stopped. A parent can unlink their own device too.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto'
import type { Kv } from './kv.ts'

export const CODE_TTL_MS = 15 * 60_000

export interface ParentLink {
  id: string
  name: string
  linkedAt: string
  lastSeenAt: string | null
  removedAt: string | null
  /** When this parent last finished the weekly guide (shown to the student). */
  guideDoneAt?: string | null
}

interface StudentRec {
  name: string
  parents: ParentLink[]
  codeHash: string | null
}

interface ParentRec {
  name: string
  students: string[]
  createdAt: string
}

interface CodeRec {
  studentId: string
  expiresAt: number
}

export interface Snapshot {
  updatedAt: string
  data: unknown
}

/** A reward goal a parent set (same shape as src/domain/goals.ts). */
export interface GoalRec {
  id: string
  parentId: string
  parentName: string
  createdAt: string
  startDay: string
  rule: { kind: 'streak'; perDay: number; days: number; weekdaysOnly: boolean } | { kind: 'total'; count: number; by: string } | { kind: 'grade'; courseId: string; courseName: string; percent: number; by: string | null }
  reward: string
  emoji: string
  status: 'active' | 'given' | 'cancelled'
  givenAt: string | null
}

export const MAX_ACTIVE_GOALS = 8
const EMOJIS = ['💵', '🎮', '🍕', '🎬', '🛍️', '📱', '🎁', '⭐']
const DAY = /^\d{4}-\d{2}-\d{2}$/
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)
const CONTROL = /[\u0000-\u001f<>]/g // eslint-disable-line no-control-regex -- strip control characters and tags from parent input
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.normalize('NFC').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** Checks a goal sent by a parent's browser. Returns a clean copy or throws. */
export function cleanGoal(raw: unknown, today: string): Pick<GoalRec, 'startDay' | 'rule' | 'reward' | 'emoji'> {
  const g = (raw ?? {}) as Record<string, unknown>
  const r = (g.rule ?? {}) as Record<string, unknown>
  const reward = text(g.reward, 60)
  if (!reward) throw new FamilyError(400, 'Write the reward, like “$20” or “Movie night”.')
  const emoji = EMOJIS.includes(String(g.emoji)) ? String(g.emoji) : '🎁'
  const startDay = typeof g.startDay === 'string' && DAY.test(g.startDay) ? g.startDay : today
  const future = (v: unknown) => (typeof v === 'string' && DAY.test(v) && v >= startDay ? v : null)
  let rule: GoalRec['rule']
  if (r.kind === 'streak') {
    const perDay = int(r.perDay, 1, 10)
    const days = int(r.days, 2, 120)
    if (!perDay || !days) throw new FamilyError(400, 'Choose how many things a day, and for how many days.')
    rule = { kind: 'streak', perDay, days, weekdaysOnly: r.weekdaysOnly !== false }
  } else if (r.kind === 'total') {
    const count = int(r.count, 1, 500)
    const by = future(r.by)
    if (!count || !by) throw new FamilyError(400, 'Choose how many things, and by when.')
    rule = { kind: 'total', count, by }
  } else if (r.kind === 'grade') {
    const percent = int(r.percent, 50, 100)
    const courseId = text(r.courseId, 80)
    if (!percent || !courseId) throw new FamilyError(400, 'Choose a class and a grade.')
    rule = { kind: 'grade', courseId, courseName: text(r.courseName, 80) || 'Class', percent, by: future(r.by) }
  } else throw new FamilyError(400, 'Choose a kind of goal.')
  return { startDay, rule, reward, emoji }
}

export class FamilyError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

/** A stable, non-reversible id for a Canvas user on a Canvas host. */
export function studentIdFor(baseUrl: string, userId: string): string {
  return sha(`${new URL(baseUrl).host}|${userId}`).slice(0, 24)
}

export function cleanParentName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.normalize('NFC').replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= 24 ? name : null
}

export function family(kv: Kv, now: () => number = Date.now) {
  const iso = () => new Date(now()).toISOString()
  const student = async (id: string): Promise<StudentRec | null> => kv.get<StudentRec>('student', id)

  async function parentFromToken(token: string | undefined): Promise<{ id: string; rec: ParentRec } | null> {
    if (!token || token.length < 32) return null
    const hit = await kv.get<{ parentId: string }>('ptoken', sha(token))
    if (!hit) return null
    const rec = await kv.get<ParentRec>('parent', hit.parentId)
    return rec ? { id: hit.parentId, rec } : null
  }

  /** Goals from parents who are still linked; finished ones are kept for two weeks. */
  async function goalsOf(studentId: string, s: StudentRec | null): Promise<GoalRec[]> {
    const linked = new Set((s?.parents ?? []).filter((p) => !p.removedAt).map((p) => p.id))
    const all = (await kv.get<GoalRec[]>('goals', studentId)) ?? []
    return all.filter((g) => linked.has(g.parentId) && (g.status === 'active' || now() - new Date(g.givenAt ?? g.createdAt).getTime() < 14 * 86_400_000))
  }

  async function linkedParent(token: string | undefined, studentId: string) {
    const p = await parentFromToken(token)
    if (!p || !p.rec.students.includes(studentId)) throw new FamilyError(404, 'Not found.')
    const s = await student(studentId)
    const link = s?.parents.find((x) => x.id === p.id)
    if (!s || !link || link.removedAt) throw new FamilyError(410, 'Sharing stopped.')
    return { p, s, link }
  }

  return {
    /** What the student sees in Me → Family (and the reward goals on Today). */
    async overview(studentId: string) {
      const s = await student(studentId)
      const snap = await kv.get<Snapshot>('snap', studentId)
      const parents = (s?.parents ?? []).filter((p) => !p.removedAt)
      return { parents, snapshotAt: snap?.updatedAt ?? null, goals: await goalsOf(studentId, s) }
    },

    /** A parent sets a reward goal. */
    async addGoal(token: string | undefined, studentId: string, raw: unknown, today: string) {
      const { p, s, link } = await linkedParent(token, studentId)
      const goals = await goalsOf(studentId, s)
      if (goals.filter((g) => g.status === 'active').length >= MAX_ACTIVE_GOALS) throw new FamilyError(400, `You can have up to ${MAX_ACTIVE_GOALS} goals at a time.`)
      const goal: GoalRec = { id: randomBytes(9).toString('base64url'), parentId: p.id, parentName: link.name, createdAt: iso(), ...cleanGoal(raw, today), status: 'active', givenAt: null }
      await kv.set('goals', studentId, [...goals, goal])
      return goals.concat(goal)
    },

    /** The parent who set a goal marks the reward as given, or cancels the goal. */
    async updateGoal(token: string | undefined, studentId: string, goalId: string, action: unknown) {
      const { p, s } = await linkedParent(token, studentId)
      const goals = await goalsOf(studentId, s)
      const g = goals.find((x) => x.id === goalId)
      if (!g || g.parentId !== p.id || g.status !== 'active') throw new FamilyError(404, 'Not found.')
      if (action === 'given') Object.assign(g, { status: 'given', givenAt: iso() })
      else if (action === 'cancel') Object.assign(g, { status: 'cancelled', givenAt: iso() })
      else throw new FamilyError(400, 'Invalid request.')
      const kept = goals.filter((x) => x.status !== 'cancelled')
      await kv.set('goals', studentId, kept)
      return kept
    },

    async createCode(studentId: string, studentName: string) {
      const s = (await student(studentId)) ?? { name: studentName, parents: [], codeHash: null }
      if (s.codeHash) await kv.del('code', s.codeHash)
      let code = ''
      for (let i = 0; i < 10; i++) {
        code = String(randomInt(0, 1_000_000)).padStart(6, '0')
        if (!(await kv.get('code', sha(code)))) break
      }
      const expiresAt = now() + CODE_TTL_MS
      await kv.set('code', sha(code), { studentId, expiresAt } satisfies CodeRec)
      await kv.set('student', studentId, { ...s, name: studentName, codeHash: sha(code) })
      return { code, expiresAt }
    },

    /** A parent device enters a code. Returns the device token to keep (new or existing). */
    async link(rawCode: unknown, rawName: unknown, existingToken: string | undefined) {
      const code = typeof rawCode === 'string' ? rawCode.replace(/\D/g, '') : ''
      const name = cleanParentName(rawName)
      if (!name) throw new FamilyError(400, 'Type your name, like Mom, Dad or Abuela.')
      if (code.length !== 6) throw new FamilyError(400, 'The code has 6 numbers.')
      const rec = await kv.get<CodeRec>('code', sha(code))
      if (!rec || rec.expiresAt < now()) throw new FamilyError(404, 'That code didn’t work. Ask your student for a new one (codes last 15 minutes).')
      await kv.del('code', sha(code))
      const s = await student(rec.studentId)
      if (!s) throw new FamilyError(404, 'That code didn’t work. Ask your student for a new one.')

      let parent = await parentFromToken(existingToken)
      let token = existingToken
      if (!parent) {
        token = randomBytes(32).toString('base64url')
        const id = randomBytes(9).toString('base64url')
        parent = { id, rec: { name, students: [], createdAt: iso() } }
        await kv.set('ptoken', sha(token), { parentId: id })
      }
      parent.rec = { ...parent.rec, name, students: [...new Set([...parent.rec.students, rec.studentId])] }
      await kv.set('parent', parent.id, parent.rec)
      const others = s.parents.filter((p) => p.id !== parent!.id)
      await kv.set('student', rec.studentId, { ...s, codeHash: null, parents: [...others, { id: parent.id, name, linkedAt: iso(), lastSeenAt: null, removedAt: null }] })
      return { token: token!, studentName: s.name }
    },

    /** The student removes a parent. */
    async remove(studentId: string, parentId: string) {
      const s = await student(studentId)
      if (!s) return
      const parents = s.parents.map((p) => (p.id === parentId && !p.removedAt ? { ...p, removedAt: iso() } : p))
      await kv.set('student', studentId, { ...s, parents })
      if (!parents.some((p) => !p.removedAt)) await kv.del('snap', studentId)
    },

    /** The student's app uploads its data. Kept only while someone is linked. */
    async saveSnapshot(studentId: string, data: unknown) {
      const s = await student(studentId)
      const active = (s?.parents ?? []).filter((p) => !p.removedAt).length
      if (!active) {
        await kv.del('snap', studentId)
        return { stored: false, parents: 0 }
      }
      await kv.set('snap', studentId, { updatedAt: iso(), data } satisfies Snapshot)
      return { stored: true, parents: active }
    },

    async parentMe(token: string | undefined) {
      const p = await parentFromToken(token)
      if (!p) return null
      const students = await Promise.all(
        p.rec.students.map(async (id) => {
          const s = await student(id)
          const link = s?.parents.find((x) => x.id === p.id)
          const snap = link && !link.removedAt ? await kv.get<Snapshot>('snap', id) : null
          return { id, name: s?.name ?? 'Student', active: !!link && !link.removedAt, removedAt: link?.removedAt ?? null, updatedAt: snap?.updatedAt ?? null }
        }),
      )
      return { name: p.rec.name, students }
    },

    async parentView(token: string | undefined, studentId: string) {
      const p = await parentFromToken(token)
      if (!p) throw new FamilyError(401, 'This device isn’t linked yet.')
      if (!p.rec.students.includes(studentId)) throw new FamilyError(404, 'Not found.')
      const s = await student(studentId)
      const link = s?.parents.find((x) => x.id === p.id)
      if (!s || !link) throw new FamilyError(404, 'Not found.')
      if (link.removedAt) throw new FamilyError(410, `${s.name} stopped sharing.`)
      // Let the student see when a parent last looked (at most once every 5 minutes).
      if (!link.lastSeenAt || now() - new Date(link.lastSeenAt).getTime() > 5 * 60_000) {
        await kv.set('student', studentId, { ...s, parents: s.parents.map((x) => (x.id === p.id ? { ...x, lastSeenAt: iso() } : x)) })
      }
      const snap = await kv.get<Snapshot>('snap', studentId)
      return { studentName: s.name, updatedAt: snap?.updatedAt ?? null, data: snap?.data ?? null, goals: await goalsOf(studentId, s), parentId: p.id }
    },

    /** The parent finished the weekly guide: the student sees a small note. */
    async guideDone(token: string | undefined, studentId: string) {
      const p = await parentFromToken(token)
      if (!p || !p.rec.students.includes(studentId)) throw new FamilyError(404, 'Not found.')
      const s = await student(studentId)
      const link = s?.parents.find((x) => x.id === p.id)
      if (!s || !link || link.removedAt) throw new FamilyError(410, 'Sharing stopped.')
      await kv.set('student', studentId, { ...s, parents: s.parents.map((x) => (x.id === p.id ? { ...x, guideDoneAt: iso() } : x)) })
    },

    /** "Unlink this phone": the parent leaves every student; students see them as removed. */
    async parentUnlink(token: string | undefined) {
      const p = await parentFromToken(token)
      if (!p) return
      for (const id of p.rec.students) {
        const s = await student(id)
        if (!s) continue
        const parents = s.parents.map((x) => (x.id === p.id && !x.removedAt ? { ...x, removedAt: iso() } : x))
        await kv.set('student', id, { ...s, parents })
        if (!parents.some((x) => !x.removedAt)) await kv.del('snap', id)
      }
      await kv.del('parent', p.id)
      await kv.del('ptoken', sha(token!))
    },
  }
}

export type Family = ReturnType<typeof family>
