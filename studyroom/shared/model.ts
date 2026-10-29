/**
 * Study Room rules shared by the browser and the server. Pure functions only.
 *
 * - A person is Studying, Resting, on a Break, or Ready (idle).
 * - Study ends into Rest automatically; Rest and Break end into Ready.
 * - No chat: friends can only send one of a few emoji cheers.
 */

export type Status = 'idle' | 'study' | 'rest' | 'break'

export interface Preset {
  id: string
  label: string
  study: number
  rest: number
}

export const PRESETS: Preset[] = [
  { id: '25-5', label: '🍅 25 / 5', study: 25, rest: 5 },
  { id: '50-10', label: '🔥 50 / 10', study: 50, rest: 10 },
  { id: '15-3', label: '⚡ 15 / 3', study: 15, rest: 3 },
]
export const BREAK_MINUTES = 5
export const MAX_MINUTES = 180

export interface Look {
  skin: number
  hair: number
  hairColor: number
  shirt: number
  pants: number
  hat: number
}

export const LOOK_SIZES: Record<keyof Look, number> = { skin: 5, hair: 4, hairColor: 6, shirt: 7, pants: 4, hat: 5 }

/** Hats unlock with total study time on this device: none, beanie, cap, flower crown, gold crown. */
export const HAT_UNLOCK_MINUTES = [0, 30, 120, 300, 600]
export const HAT_NAMES = ['No hat', 'Beanie', 'Cap', 'Flower crown', 'Gold crown']

export const EMOJIS = ['👏', '🔥', '💪', '⭐'] as const
export type Emoji = (typeof EMOJIS)[number]

export interface Timer {
  status: Status
  /** When the current phase ends (ms since epoch). null while idle or paused. */
  endsAt: number | null
  /** Seconds left while paused. */
  pausedLeft: number | null
}

export const IDLE: Timer = { status: 'idle', endsAt: null, pausedLeft: null }

export function secondsLeft(t: Timer, now: number): number {
  if (t.pausedLeft != null) return t.pausedLeft
  if (t.endsAt == null) return 0
  return Math.max(0, Math.ceil((t.endsAt - now) / 1000))
}

export function start(status: Exclude<Status, 'idle'>, minutes: number, now: number): Timer {
  return { status, endsAt: now + clampMinutes(minutes) * 60_000, pausedLeft: null }
}

export function pause(t: Timer, now: number): Timer {
  if (t.status === 'idle' || t.pausedLeft != null) return t
  return { ...t, endsAt: null, pausedLeft: secondsLeft(t, now) }
}

export function resume(t: Timer, now: number): Timer {
  if (t.pausedLeft == null) return t
  return { ...t, endsAt: now + t.pausedLeft * 1000, pausedLeft: null }
}

/** What happens when the clock runs out: Study rolls into Rest, everything else into Ready. */
export function advance(t: Timer, now: number, restMinutes: number): Timer | null {
  if (t.status === 'idle' || t.pausedLeft != null || t.endsAt == null || now < t.endsAt) return null
  if (t.status === 'study') return start('rest', restMinutes, t.endsAt)
  return IDLE
}

export function clampMinutes(m: number): number {
  if (!Number.isFinite(m)) return 25
  return Math.max(1, Math.min(MAX_MINUTES, Math.round(m)))
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  return h ? (m % 60 ? `${h}h ${m % 60}m` : `${h}h`) : `${m}m`
}

// ——— Validation (the server never trusts the browser) ———

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  // Letters, numbers, spaces and a few friendly symbols; no control characters or markup.
  const name = raw.normalize('NFC').replace(/[^\p{L}\p{N} .'_-]/gu, '').replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= 16 ? name : null
}

export function cleanLook(raw: unknown): Look | null {
  if (!raw || typeof raw !== 'object') return null
  const out = {} as Look
  for (const key of Object.keys(LOOK_SIZES) as Array<keyof Look>) {
    const v = (raw as Record<string, unknown>)[key]
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) >= LOOK_SIZES[key]) return null
    out[key] = v as number
  }
  return out
}

export function cleanTimer(raw: unknown, now: number): Timer | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const status = r.status
  if (status !== 'idle' && status !== 'study' && status !== 'rest' && status !== 'break') return null
  if (status === 'idle') return IDLE
  const max = MAX_MINUTES * 60
  if (r.pausedLeft != null) {
    if (typeof r.pausedLeft !== 'number' || r.pausedLeft < 0 || r.pausedLeft > max) return null
    return { status, endsAt: null, pausedLeft: Math.round(r.pausedLeft) }
  }
  if (typeof r.endsAt !== 'number' || r.endsAt < now - 60_000 || r.endsAt > now + max * 1000) return null
  return { status, endsAt: r.endsAt, pausedLeft: null }
}

// ——— Room codes: easy to say out loud, like MAPLE-42 ———

const WORDS = ['MAPLE', 'COCOA', 'PANDA', 'LEMON', 'COMET', 'OTTER', 'MANGO', 'CLOUD', 'PIXEL', 'BERRY', 'TULIP', 'RIVER', 'SUNNY', 'MAGIC', 'PEACH', 'SPARK', 'OLIVE', 'TIGER', 'CEDAR', 'MINTY']

export function makeRoomCode(random: () => number = Math.random): string {
  return `${WORDS[Math.floor(random() * WORDS.length)]}-${String(Math.floor(random() * 90) + 10)}`
}

export function cleanRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase().replace(/\s+/g, '-')
  return /^[A-Z]{3,8}-\d{2}$/.test(code) ? code : null
}

// ——— What everyone in a room sees ———

export interface PublicMember {
  id: string
  name: string
  look: Look
  timer: Timer
  /** Seconds studied in this room so far. */
  studied: number
}

export interface Cheer {
  id: number
  from: string
  to: string
  emoji: Emoji
  at: number
}

export interface RoomState {
  code: string
  goal: number
  studied: number
  members: PublicMember[]
  cheers: Cheer[]
  serverNow: number
}

export const ROOM_GOAL_SECONDS = 5 * 3600
export const MAX_MEMBERS = 12
