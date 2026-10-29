/**
 * CampusFlow integration server.
 *
 *   node server/index.ts               API only (use with `npm run dev`, which proxies /api here)
 *   node server/index.ts --serve-dist  API + the built app from ./dist
 *
 * Students connect Canvas from the app ("Connect Canvas") by pasting a personal access token.
 * Tokens stay on this server.
 * See .env.example for configuration.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { CanvasHttpError, fetchSnapshot, getOne, readCanvasConfig, type CanvasConfig } from './canvas.ts'
import { assertCsrfSafe, assertSafeCanvasHost, clientIp, HttpError, normalizeCanvasUrl, rateLimit, readJsonBody } from './security.ts'
import { createSession, destroySession, getSession, initSessions, parseCookies, setCookie, type CanvasSession } from './session.ts'
import { family, FamilyError, studentIdFor } from './family.ts'
import { openKv } from './kv.ts'

const root = resolve(import.meta.dirname, '..')
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))

const PORT = Number(process.env.PORT ?? 8787)
const SERVE_DIST = process.argv.includes('--serve-dist')
const DIST = join(root, 'dist')
const DATA_DIR = resolve(root, process.env.DATA_DIR ?? '.data')
initSessions(DATA_DIR)
const kv = await openKv(DATA_DIR)
const fam = family(kv)
const PARENT_COOKIE = 'cf_parent'
const PARENT_MAX_AGE_S = 400 * 24 * 3600

/** The signed-in student (family sharing needs a real Canvas sign-in, not the demo). */
function familyStudent(req: IncomingMessage): { id: string; name: string } {
  const s = getSession(req)
  if (!s || !s.userId) throw new HttpError(401, 'Connect Canvas to share with your family.')
  return { id: studentIdFor(s.baseUrl, s.userId), name: s.userName.split(' ')[0] || 'Student' }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Where Canvas credentials come from: the student's session, or a single-user .env token. */
function credentials(req: IncomingMessage): { config: CanvasConfig; session: CanvasSession | null } | null {
  const session = getSession(req)
  if (session) return { config: { baseUrl: session.baseUrl, token: session.accessToken }, session }
  const { config } = readCanvasConfig(process.env)
  return config ? { config, session: null } : null
}

/** Run a Canvas call with the browser's session token (or the single-user .env token). */
async function withCanvas<T>(req: IncomingMessage, fn: (c: CanvasConfig) => Promise<T>): Promise<T> {
  const creds = credentials(req)
  if (!creds) throw new HttpError(401, 'Not connected to Canvas.')
  return fn(creds.config)
}

function canvasError(res: ServerResponse, e: unknown) {
  if (e instanceof HttpError) return json(res, e.status, { message: e.message })
  if (e instanceof CanvasHttpError && e.status === 401) return json(res, 401, { message: 'Canvas sign-in expired or was revoked. Connect again.' })
  if (e instanceof CanvasHttpError) return json(res, 502, { message: e.message })
  return json(res, 502, { message: 'Couldn’t reach Canvas. Check your connection and try again.' })
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL) {
  const path = url.pathname
  const method = req.method ?? 'GET'

  if (path === '/api/health') return json(res, 200, { ok: true })

  if (path === '/api/auth/options' && method === 'GET') {
    return json(res, 200, { token: true })
  }

  if (path === '/api/auth/token' && method === 'POST') {
    assertCsrfSafe(req)
    rateLimit(`login:${clientIp(req)}`, 10, 60_000)
    const body = await readJsonBody<{ baseUrl?: string; token?: string }>(req)
    const baseUrl = normalizeCanvasUrl(body.baseUrl ?? '')
    const token = String(body.token ?? '').trim()
    if (token.length < 20 || /\s/.test(token)) throw new HttpError(400, 'That doesn’t look like a Canvas access token. Copy the whole token from Canvas.')
    await assertSafeCanvasHost(baseUrl)
    let self: { id?: number | string; name?: string }
    try {
      self = await getOne(config(baseUrl, token), '/users/self')
    } catch (e) {
      if (e instanceof CanvasHttpError && e.status === 401) throw new HttpError(401, 'Canvas didn’t accept that token. Make sure you copied all of it and that it hasn’t expired.')
      throw new HttpError(502, `Couldn’t reach Canvas at ${new URL(baseUrl).host}. Check the address.`)
    }
    createSession(req, res, { baseUrl, accessToken: token, userName: self.name ?? 'Canvas user', userId: String(self.id ?? '') })
    return json(res, 200, { state: 'connected', userName: self.name ?? 'Canvas user', baseHost: new URL(baseUrl).host })
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    assertCsrfSafe(req)
    destroySession(req, res)
    return json(res, 200, { ok: true })
  }

  if (path === '/api/canvas/status' && method === 'GET') {
    const creds = credentials(req)
    if (!creds) return json(res, 200, { state: 'signed_out' })
    try {
      const self = await withCanvas(req, (c) => getOne<{ name?: string }>(c, '/users/self'))
      return json(res, 200, { state: 'connected', userName: self.name ?? 'Canvas user', baseHost: new URL(creds.config.baseUrl).host, method: creds.session ? 'token' : 'server' })
    } catch (e) {
      if (e instanceof CanvasHttpError && e.status === 401) return json(res, 200, { state: 'unauthorized', message: 'Canvas sign-in expired or was revoked. Connect again.' })
      return json(res, 200, { state: 'error', message: e instanceof Error ? e.message : 'Couldn’t reach Canvas.' })
    }
  }

  // ——— Family sharing: the student's side ———
  if (path === '/api/family' && method === 'GET') {
    return json(res, 200, await fam.overview(familyStudent(req).id))
  }
  if (path === '/api/family/code' && method === 'POST') {
    assertCsrfSafe(req)
    const st = familyStudent(req)
    rateLimit(`family-code:${st.id}`, 12, 3600_000)
    return json(res, 200, await fam.createCode(st.id, st.name))
  }
  if (path === '/api/family/remove' && method === 'POST') {
    assertCsrfSafe(req)
    const body = await readJsonBody<{ parentId?: string }>(req)
    await fam.remove(familyStudent(req).id, String(body.parentId ?? ''))
    return json(res, 200, await fam.overview(familyStudent(req).id))
  }
  if (path === '/api/family/snapshot' && method === 'POST') {
    assertCsrfSafe(req)
    const st = familyStudent(req)
    rateLimit(`family-snap:${st.id}`, 30, 60_000)
    const body = await readJsonBody<{ data?: unknown }>(req, 2 * 1024 * 1024)
    if (!body.data || typeof body.data !== 'object') throw new HttpError(400, 'Invalid request.')
    return json(res, 200, await fam.saveSnapshot(st.id, body.data))
  }

  // ——— Family sharing: the parent's side ———
  if (path === '/api/parent/link' && method === 'POST') {
    assertCsrfSafe(req)
    rateLimit(`parent-link:${clientIp(req)}`, 10, 10 * 60_000)
    rateLimit('parent-link:all', 300, 10 * 60_000)
    const body = await readJsonBody<{ code?: string; name?: string }>(req)
    const { token, studentName } = await fam.link(body.code, body.name, parseCookies(req)[PARENT_COOKIE])
    setCookie(res, req, PARENT_COOKIE, token, PARENT_MAX_AGE_S)
    return json(res, 200, { studentName })
  }
  if (path === '/api/parent/me' && method === 'GET') {
    const me = await fam.parentMe(parseCookies(req)[PARENT_COOKIE])
    return me ? json(res, 200, me) : json(res, 401, { message: 'This device isn’t linked yet.' })
  }
  const view = /^\/api\/parent\/students\/([A-Za-z0-9]{24})$/.exec(path)
  if (view && method === 'GET') {
    rateLimit(`parent-view:${clientIp(req)}`, 120, 60_000)
    return json(res, 200, await fam.parentView(parseCookies(req)[PARENT_COOKIE], view[1]))
  }
  if (path === '/api/parent/unlink' && method === 'POST') {
    assertCsrfSafe(req)
    await fam.parentUnlink(parseCookies(req)[PARENT_COOKIE])
    setCookie(res, req, PARENT_COOKIE, '', 0)
    return json(res, 200, { ok: true })
  }

  if (path === '/api/canvas/snapshot' && method === 'GET') {
    try {
      return json(res, 200, await withCanvas(req, fetchSnapshot))
    } catch (e) {
      return canvasError(res, e)
    }
  }

  if (method !== 'GET' && method !== 'POST') return json(res, 405, { message: 'Method not allowed.' })
  return json(res, 404, { message: 'Not found' })
}

const config = (baseUrl: string, token: string): CanvasConfig => ({ baseUrl, token })

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

function serveStatic(res: ServerResponse, path: string) {
  const safe = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '')
  let file = join(DIST, safe)
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  if (!existsSync(file)) {
    res.writeHead(404).end('Build the app first: npm run build')
    return
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  if (path.startsWith('/api/')) {
    handleApi(req, res, url).catch((e) => {
      if (e instanceof HttpError || e instanceof FamilyError) return json(res, e.status, { message: e.message })
      console.error(e)
      json(res, 500, { message: 'Internal error' })
    })
    return
  }
  if (SERVE_DIST) return serveStatic(res, path)
  json(res, 404, { message: 'Not found' })
}).listen(PORT, () => {
  console.log(`CampusFlow server on http://localhost:${PORT}`)
})
