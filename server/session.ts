/**
 * Sessions, in one of two modes:
 *
 * - "file" (default, for running on your own computer): the browser holds only a random session id
 *   in an HttpOnly cookie; Canvas tokens live on the server, encrypted at rest with AES-256-GCM.
 * - "cookie" (SESSION_STORE=cookie, for hosting where the disk is wiped on restart): the session
 *   itself is sealed with AES-256-GCM under SESSION_SECRET and kept in the HttpOnly cookie. Page
 *   scripts can't read it, and without the server's secret it can't be read or changed.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

export interface CanvasSession {
  baseUrl: string
  accessToken: string
  userName: string
  userId: string
  createdAt: number
  lastUsedAt: number
}

const COOKIE = 'cf_session'
const MAX_AGE_S = 30 * 24 * 3600
const IDLE_MS = MAX_AGE_S * 1000

const cookieMode = () => process.env.SESSION_STORE === 'cookie'

let dataDir = ''
let key: Buffer = randomBytes(32)
// Keyed by sha256(session id), so the stored file never contains usable session ids.
const sessions = new Map<string, CanvasSession>()

export function initSessions(dir: string) {
  if (cookieMode()) {
    if (!process.env.SESSION_SECRET) throw new Error('SESSION_STORE=cookie needs SESSION_SECRET (a long random string).')
    key = createHash('sha256').update(process.env.SESSION_SECRET).digest()
    return
  }
  dataDir = dir
  mkdirSync(dir, { recursive: true })
  if (process.env.SESSION_SECRET) {
    key = createHash('sha256').update(process.env.SESSION_SECRET).digest()
  } else {
    const keyFile = join(dir, 'session.key')
    if (!existsSync(keyFile)) {
      writeFileSync(keyFile, randomBytes(32).toString('hex'), { mode: 0o600 })
    }
    key = Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'hex')
  }
  const file = join(dir, 'sessions.enc')
  if (!existsSync(file)) return
  try {
    const parsed = JSON.parse(decrypt(readFileSync(file, 'utf8'))) as Record<string, CanvasSession>
    const now = Date.now()
    for (const [id, s] of Object.entries(parsed)) if (now - s.lastUsedAt < IDLE_MS) sessions.set(id, s)
  } catch {
    // Wrong key or corrupt file: start fresh rather than fail.
  }
}

/** Seal any text with the server key (AES-256-GCM). Used for sessions and family data. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.')
}

export function decrypt(text: string): string {
  const [iv, tag, data] = text.split('.').map((s) => Buffer.from(s, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

function persist() {
  if (!dataDir) return
  const file = join(dataDir, 'sessions.enc')
  writeFileSync(file, encrypt(JSON.stringify(Object.fromEntries(sessions))), { mode: 0o600 })
  try {
    chmodSync(file, 0o600)
  } catch {
    /* best effort */
  }
}

const hashId = (id: string) => createHash('sha256').update(id).digest('hex')

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function isSecureRequest(req: IncomingMessage): boolean {
  return process.env.COOKIE_SECURE === '1' || req.headers['x-forwarded-proto'] === 'https' || 'encrypted' in req.socket
}

export function setCookie(res: ServerResponse, req: IncomingMessage, name: string, value: string, maxAgeS: number) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeS}`]
  if (isSecureRequest(req)) parts.push('Secure')
  const prev = res.getHeader('Set-Cookie')
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [String(prev)] : []), parts.join('; ')])
}

export function getSession(req: IncomingMessage): CanvasSession | null {
  const id = parseCookies(req)[COOKIE]
  if (!id) return null
  if (cookieMode()) {
    try {
      const s = JSON.parse(decrypt(id)) as CanvasSession
      return Date.now() - s.createdAt > IDLE_MS ? null : { ...s, lastUsedAt: Date.now() }
    } catch {
      return null // tampered, or sealed with an old secret
    }
  }
  const s = sessions.get(hashId(id))
  if (!s) return null
  if (Date.now() - s.lastUsedAt > IDLE_MS) {
    sessions.delete(hashId(id))
    persist()
    return null
  }
  s.lastUsedAt = Date.now()
  return s
}

export function createSession(req: IncomingMessage, res: ServerResponse, data: Omit<CanvasSession, 'createdAt' | 'lastUsedAt'>) {
  if (cookieMode()) {
    setCookie(res, req, COOKIE, encrypt(JSON.stringify({ ...data, createdAt: Date.now(), lastUsedAt: Date.now() })), MAX_AGE_S)
    return
  }
  // Replace any existing session for this browser.
  const old = parseCookies(req)[COOKIE]
  if (old) sessions.delete(hashId(old))
  const id = randomBytes(32).toString('base64url')
  sessions.set(hashId(id), { ...data, createdAt: Date.now(), lastUsedAt: Date.now() })
  persist()
  setCookie(res, req, COOKIE, id, MAX_AGE_S)
}

export function destroySession(req: IncomingMessage, res: ServerResponse) {
  if (cookieMode()) return setCookie(res, req, COOKIE, '', 0)
  const id = parseCookies(req)[COOKIE]
  if (id) sessions.delete(hashId(id))
  persist()
  setCookie(res, req, COOKIE, '', 0)
}
