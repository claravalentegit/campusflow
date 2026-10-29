/**
 * Live study rooms, kept in memory. Rooms are small, temporary and anonymous: a room code,
 * first names and a character. Nothing is written to disk.
 *
 * Each browser has a secret key; only its sha256 is kept, and a short public id derived from it
 * is what other people see. Updates must come with the key, so nobody can move someone else.
 */
import { createHash } from 'node:crypto'
import { advance, type Cheer, type Emoji, IDLE, type Look, MAX_MEMBERS, makeRoomCode, type PublicMember, ROOM_GOAL_SECONDS, type RoomState, type Timer } from '../shared/model.ts'

interface Member {
  id: string
  keyHash: string
  name: string
  look: Look
  timer: Timer
  studied: number
  /** When we last added study time (ms). */
  countedAt: number
  lastSeen: number
  lastCheer: number
}

interface Room {
  code: string
  createdAt: number
  lastActive: number
  members: Map<string, Member>
  cheers: Cheer[]
  /** Study seconds from people who have left. */
  pastStudied: number
  listeners: Set<(state: RoomState) => void>
}

export const MEMBER_TIMEOUT_MS = 75_000
const EMPTY_ROOM_TTL_MS = 30 * 60_000
const ROOM_MAX_AGE_MS = 24 * 3600_000
const MAX_ROOMS = 500
const REST_FOR_SERVER = 5

const rooms = new Map<string, Room>()
let cheerSeq = 1

export class RoomError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex')

export function createRoom(now = Date.now()): string {
  if (rooms.size >= MAX_ROOMS) throw new RoomError(503, 'Too many rooms right now. Try again later.')
  let code = makeRoomCode()
  for (let i = 0; rooms.has(code) && i < 50; i++) code = makeRoomCode()
  if (rooms.has(code)) throw new RoomError(503, 'Couldn’t make a room code. Try again.')
  rooms.set(code, { code, createdAt: now, lastActive: now, members: new Map(), cheers: [], pastStudied: 0, listeners: new Set() })
  return code
}

export function roomExists(code: string): boolean {
  return rooms.has(code)
}

function room(code: string): Room {
  const r = rooms.get(code)
  if (!r) throw new RoomError(404, 'That room doesn’t exist (rooms close when everyone leaves).')
  return r
}

function member(r: Room, key: string): Member {
  const m = r.members.get(hash(key))
  if (!m) throw new RoomError(403, 'You’re not in this room. Join it again.')
  return m
}

/** Add study time up to now (or until the study phase ended), then roll finished phases forward. */
function count(m: Member, now: number) {
  const t = m.timer
  if (t.status === 'study' && t.endsAt != null) {
    const until = Math.min(now, t.endsAt)
    if (until > m.countedAt) m.studied += (until - m.countedAt) / 1000
  }
  m.countedAt = now
  const next = advance(m.timer, now, REST_FOR_SERVER)
  // The browser sends its real rest length when it rolls over; this keeps an idle tab's friend view sensible.
  if (next) m.timer = next
}

export function join(code: string, key: string, name: string, look: Look, timer: Timer, now = Date.now()): string {
  const r = room(code)
  const kh = hash(key)
  const existing = r.members.get(kh)
  if (!existing && r.members.size >= MAX_MEMBERS) throw new RoomError(409, `This room is full (${MAX_MEMBERS} people).`)
  const id = kh.slice(0, 12)
  r.members.set(kh, existing ? { ...existing, name, look, lastSeen: now } : { id, keyHash: kh, name, look, timer, studied: 0, countedAt: now, lastSeen: now, lastCheer: 0 })
  touch(r, now)
  return id
}

export function update(code: string, key: string, patch: { timer?: Timer; name?: string; look?: Look }, now = Date.now()) {
  const r = room(code)
  const m = member(r, key)
  count(m, now)
  if (patch.timer) m.timer = patch.timer
  if (patch.name) m.name = patch.name
  if (patch.look) m.look = patch.look
  m.lastSeen = now
  touch(r, now)
}

export function leave(code: string, key: string, now = Date.now()) {
  const r = rooms.get(code)
  if (!r) return
  const kh = hash(key)
  const m = r.members.get(kh)
  if (!m) return
  count(m, now)
  r.pastStudied += m.studied
  r.members.delete(kh)
  touch(r, now)
}

export function cheer(code: string, key: string, to: string, emoji: Emoji, now = Date.now()) {
  const r = room(code)
  const m = member(r, key)
  if (now - m.lastCheer < 1500) throw new RoomError(429, 'Slow down a little!')
  if (![...r.members.values()].some((x) => x.id === to)) throw new RoomError(404, 'They left the room.')
  m.lastCheer = now
  m.lastSeen = now
  r.cheers = [...r.cheers.filter((c) => now - c.at < 10_000), { id: cheerSeq++, from: m.id, to, emoji, at: now }].slice(-20)
  touch(r, now)
}

export function state(code: string, now = Date.now()): RoomState {
  const r = room(code)
  const members: PublicMember[] = [...r.members.values()]
    .map((m) => {
      count(m, now)
      return { id: m.id, name: m.name, look: m.look, timer: m.timer, studied: Math.round(m.studied) }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
  return {
    code: r.code,
    goal: ROOM_GOAL_SECONDS,
    studied: Math.round(r.pastStudied + members.reduce((s, m) => s + m.studied, 0)),
    members,
    cheers: r.cheers.filter((c) => now - c.at < 10_000),
    serverNow: now,
  }
}

export function subscribe(code: string, fn: (s: RoomState) => void): () => void {
  const r = room(code)
  r.listeners.add(fn)
  fn(state(code))
  return () => r.listeners.delete(fn)
}

function touch(r: Room, now: number) {
  r.lastActive = now
  const s = state(r.code, now)
  for (const fn of r.listeners) fn(s)
}

/** Drop people who closed the tab, and rooms nobody uses. Run every few seconds. */
export function sweep(now = Date.now()) {
  for (const r of rooms.values()) {
    let changed = false
    for (const [kh, m] of r.members) {
      if (now - m.lastSeen > MEMBER_TIMEOUT_MS) {
        count(m, now)
        r.pastStudied += m.studied
        r.members.delete(kh)
        changed = true
      }
    }
    if (changed) touch(r, now)
    const empty = r.members.size === 0 && now - r.lastActive > EMPTY_ROOM_TTL_MS
    if (empty || now - r.createdAt > ROOM_MAX_AGE_MS) {
      for (const fn of r.listeners) fn({ ...state(r.code, now), members: [] })
      rooms.delete(r.code)
    }
  }
}

export function _reset() {
  rooms.clear()
}

export { IDLE }
