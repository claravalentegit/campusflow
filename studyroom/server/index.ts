/**
 * Study Room server: serves the app and runs live rooms. Node built-ins only.
 *
 *   POST /api/rooms                      make a room → { code }
 *   GET  /api/rooms/:code                does it exist?
 *   GET  /api/rooms/:code/events         live room updates (Server-Sent Events)
 *   POST /api/rooms/:code/join           { key, name, look, timer } → { id }
 *   POST /api/rooms/:code/update         { key, timer?, name?, look? }  (also the heartbeat)
 *   POST /api/rooms/:code/cheer          { key, to, emoji }
 *   POST /api/rooms/:code/leave          { key }
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join as joinPath, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanLook, cleanName, cleanRoomCode, cleanTimer, EMOJIS, type Emoji, IDLE } from '../shared/model.ts'
import { cheer, createRoom, join, leave, roomExists, RoomError, state, subscribe, sweep, update } from './rooms.ts'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const DIST = joinPath(root, 'dist')
const PORT = Number(process.env.PORT ?? 8788)
const SERVE_DIST = process.argv.includes('--serve-dist')

// ——— Small helpers ———

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

function clientIp(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY === '1') {
    const last = String(req.headers['x-forwarded-for'] ?? '').split(',').pop()?.trim()
    if (last) return last
  }
  return req.socket.remoteAddress ?? 'unknown'
}

const hits = new Map<string, { count: number; reset: number }>()
function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.reset < now) return void hits.set(key, { count: 1, reset: now + windowMs })
  if (++h.count > max) throw new RoomError(429, 'Too many tries. Wait a minute.')
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  // JSON plus a custom header: a page on another site can't send this (CSRF protection).
  if (req.headers['x-study-room'] !== '1' || !String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new RoomError(403, 'Request blocked.')
  let size = 0
  const chunks: Buffer[] = []
  for await (const c of req) {
    size += (c as Buffer).length
    if (size > 4096) throw new RoomError(413, 'Too much data.')
    chunks.push(c as Buffer)
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error()
    return v
  } catch {
    throw new RoomError(400, 'Bad request.')
  }
}

/** Timers arrive in the sender's clock; move them onto the server's clock so everyone agrees. */
function timerFrom(body: Record<string, unknown>, now: number) {
  const t = body.timer as Record<string, unknown> | undefined
  if (!t || typeof t !== 'object') return null
  const clientNow = typeof body.clientNow === 'number' ? body.clientNow : now
  const shift = Math.abs(now - clientNow) < 86_400_000 ? now - clientNow : 0
  return cleanTimer(typeof t.endsAt === 'number' ? { ...t, endsAt: t.endsAt + shift } : t, now)
}

function keyOf(body: Record<string, unknown>): string {
  const k = body.key
  if (typeof k !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(k)) throw new RoomError(400, 'Bad key.')
  return k
}

// ——— Static files ———

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x')
  let file = normalize(joinPath(DIST, decodeURIComponent(url.pathname)))
  if (!file.startsWith(DIST)) return send(res, 400, { message: 'Bad path' })
  if (!existsSync(file) || statSync(file).isDirectory()) file = joinPath(DIST, 'index.html')
  const immutable = file.includes(`${joinPath(DIST, 'assets')}`)
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' })
  createReadStream(file).pipe(res)
}

// ——— Server ———

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'")
  const url = new URL(req.url ?? '/', 'http://x')
  const parts = url.pathname.split('/').filter(Boolean) // ['api','rooms',code,action]
  try {
    if (url.pathname === '/api/health') return send(res, 200, { ok: true })
    if (parts[0] !== 'api') return SERVE_DIST ? serveStatic(req, res) : send(res, 404, { message: 'Not found' })
    if (parts[1] !== 'rooms') return send(res, 404, { message: 'Not found' })

    if (parts.length === 2 && req.method === 'POST') {
      await readJson(req)
      rateLimit(`create:${clientIp(req)}`, 10, 3600_000)
      return send(res, 200, { code: createRoom() })
    }

    const code = cleanRoomCode(parts[2])
    if (!code) throw new RoomError(400, 'That doesn’t look like a room code (like MAPLE-42).')
    const action = parts[3]

    if (!action && req.method === 'GET') {
      rateLimit(`peek:${clientIp(req)}`, 60, 60_000)
      return send(res, roomExists(code) ? 200 : 404, { exists: roomExists(code) })
    }

    if (action === 'events' && req.method === 'GET') {
      if (!roomExists(code)) throw new RoomError(404, 'That room doesn’t exist.')
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      const off = subscribe(code, (s) => res.write(`data: ${JSON.stringify(s)}\n\n`))
      const ping = setInterval(() => res.write(': ping\n\n'), 20_000)
      req.on('close', () => {
        clearInterval(ping)
        off()
      })
      return
    }

    if (req.method !== 'POST') return send(res, 405, { message: 'Method not allowed' })
    const body = await readJson(req)
    const key = keyOf(body)
    rateLimit(`room:${key}`, 120, 60_000)
    const now = Date.now()

    if (action === 'join') {
      rateLimit(`join:${clientIp(req)}`, 30, 60_000)
      const name = cleanName(body.name)
      const look = cleanLook(body.look)
      if (!name) throw new RoomError(400, 'Pick a name (1–16 letters).')
      if (!look) throw new RoomError(400, 'Bad character.')
      const id = join(code, key, name, look, timerFrom(body, now) ?? IDLE, now)
      return send(res, 200, { id, state: state(code, now) })
    }
    if (action === 'update') {
      const patch: Parameters<typeof update>[2] = {}
      if (body.timer !== undefined) patch.timer = timerFrom(body, now) ?? undefined
      if (body.name !== undefined) patch.name = cleanName(body.name) ?? undefined
      if (body.look !== undefined) patch.look = cleanLook(body.look) ?? undefined
      update(code, key, patch, now)
      return send(res, 200, { ok: true })
    }
    if (action === 'cheer') {
      const emoji = body.emoji as Emoji
      if (!EMOJIS.includes(emoji) || typeof body.to !== 'string') throw new RoomError(400, 'Bad cheer.')
      cheer(code, key, body.to, emoji, now)
      return send(res, 200, { ok: true })
    }
    if (action === 'leave') {
      leave(code, key, now)
      return send(res, 200, { ok: true })
    }
    return send(res, 404, { message: 'Not found' })
  } catch (e) {
    if (e instanceof RoomError) return send(res, e.status, { message: e.message })
    console.error(e)
    return send(res, 500, { message: 'Something went wrong.' })
  }
})

setInterval(() => {
  sweep()
  const now = Date.now()
  for (const [k, h] of hits) if (h.reset < now) hits.delete(k)
}, 5000).unref()

server.listen(PORT, () => console.log(`Study Room on http://localhost:${PORT}`))
