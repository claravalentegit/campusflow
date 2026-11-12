/**
 * Your CampusFlow account: the same progress on every device.
 *
 * - The account is the student's Canvas account (a stable id per Canvas host + user), so there's no
 *   new password. Signing in with Canvas on another device finds the same account.
 * - The app's data (XP, pet, check-offs, settings…) is saved sealed, with a revision number so two
 *   devices can't silently overwrite each other: a save based on an old revision is refused with the
 *   newer copy, and the app merges.
 * - "Use on another device": a 6-digit code that works once, for 10 minutes. Entering it signs the
 *   new device in with the same Canvas connection (the token never leaves the server).
 */
import { createHash, randomInt } from 'node:crypto'
import type { Kv } from './kv.ts'

export const DEVICE_CODE_TTL_MS = 10 * 60_000
export const MAX_DATA_BYTES = 3 * 1024 * 1024

export interface SavedData {
  rev: number
  updatedAt: string
  data: unknown
}

export interface DeviceGrant {
  baseUrl: string
  accessToken: string
  userName: string
  userId: string
}

export class AccountError extends Error {
  status: number
  current: SavedData | null
  constructor(status: number, message: string, current: SavedData | null = null) {
    super(message)
    this.status = status
    this.current = current
  }
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

export function account(kv: Kv, now: () => number = Date.now) {
  return {
    async load(studentId: string): Promise<SavedData | null> {
      return kv.get<SavedData>('userdata', studentId)
    },

    /** Save the app's data. `baseRev` is the revision this device last saw; a stale one is refused. */
    async save(studentId: string, baseRev: unknown, data: unknown): Promise<{ rev: number; updatedAt: string }> {
      if (!data || typeof data !== 'object') throw new AccountError(400, 'Invalid request.')
      const cur = await kv.get<SavedData>('userdata', studentId)
      const base = typeof baseRev === 'number' && Number.isInteger(baseRev) ? baseRev : -1
      if ((cur?.rev ?? 0) !== base) throw new AccountError(409, 'Saved from another device first.', cur)
      const next: SavedData = { rev: base + 1, updatedAt: new Date(now()).toISOString(), data }
      await kv.set('userdata', studentId, next)
      return { rev: next.rev, updatedAt: next.updatedAt }
    },

    async createDeviceCode(grant: DeviceGrant): Promise<{ code: string; expiresAt: number }> {
      let code = ''
      for (let i = 0; i < 10; i++) {
        code = String(randomInt(0, 1_000_000)).padStart(6, '0')
        if (!(await kv.get('devcode', sha(code)))) break
      }
      const expiresAt = now() + DEVICE_CODE_TTL_MS
      await kv.set('devcode', sha(code), { ...grant, expiresAt })
      return { code, expiresAt }
    },

    /** One use: the code is deleted whether or not it was still valid. */
    async redeemDeviceCode(raw: unknown): Promise<DeviceGrant> {
      const code = typeof raw === 'string' ? raw.replace(/\D/g, '') : ''
      if (code.length !== 6) throw new AccountError(400, 'The code has 6 numbers.')
      const rec = await kv.get<DeviceGrant & { expiresAt: number }>('devcode', sha(code))
      if (rec) await kv.del('devcode', sha(code))
      if (!rec || rec.expiresAt < now()) throw new AccountError(404, 'That code didn’t work. Make a new one on your other device (codes last 10 minutes).')
      const { baseUrl, accessToken, userName, userId } = rec
      return { baseUrl, accessToken, userName, userId }
    },
  }
}
