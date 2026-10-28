/**
 * CampusFlow integration server.
 *
 *   node server/index.ts               API only (use with `npm run dev`, which proxies /api here)
 *   node server/index.ts --serve-dist  API + the built app from ./dist
 *
 * Students connect Canvas from the app ("Connect Canvas"), either by signing in with Canvas
 * (OAuth, needs a developer key) or with a personal access token. Tokens stay on this server.
 * See .env.example for configuration.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { CanvasHttpError, fetchSnapshot, getOne, readCanvasConfig, type CanvasConfig } from './canvas.ts'
import { finishOAuth, readOAuthConfig, refreshOAuth, revokeOAuth, startOAuth } from './oauth.ts'
import { assertCsrfSafe, assertSafeCanvasHost, clientIp, HttpError, normalizeCanvasUrl, rateLimit, readJsonBody } from './security.ts'
import { createSession, destroySession, getSession, initSessions, updateSession, type CanvasSession } from './session.ts'

const root = resolve(import.meta.dirname, '..')
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))

const PORT = Number(process.env.PORT ?? 8787)
const SERVE_DIST = process.argv.includes('--serve-dist')
const DIST = join(root, 'dist')
initSessions(resolve(root, process.env.DATA_DIR ?? '.data'))
const oauth = readOAuthConfig(process.env, PORT)

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

/** Run a Canvas call; if an OAuth token expired, refresh it once and retry. */
async function withCanvas<T>(req: IncomingMessage, fn: (c: CanvasConfig) => Promise<T>): Promise<T> {
  const creds = credentials(req)
  if (!creds) throw new HttpError(401, 'Not connected to Canvas.')
  const { session } = creds
  if (session?.kind === 'oauth' && oauth && session.expiresAt && session.expiresAt < Date.now() + 60_000) {
    const patch = await refreshOAuth(oauth, session)
    if (patch) updateSession(req, patch)
  }
  try {
    return await fn({ baseUrl: creds.config.baseUrl, token: session ? session.accessToken : creds.config.token })
  } catch (e) {
    if (e instanceof CanvasHttpError && e.status === 401 && session?.kind === 'oauth' && oauth) {
      const patch = await refreshOAuth(oauth, session)
      if (patch) {
        updateSession(req, patch)
        return fn({ baseUrl: session.baseUrl, token: patch.accessToken as string })
      }
    }
    throw e
  }
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
    return json(res, 200, { oauth: oauth ? { host: new URL(oauth.baseUrl).host } : null, token: true })
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
    createSession(req, res, { kind: 'token', baseUrl, accessToken: token, refreshToken: null, expiresAt: null, userName: self.name ?? 'Canvas user', userId: String(self.id ?? '') })
    return json(res, 200, { state: 'connected', userName: self.name ?? 'Canvas user', baseHost: new URL(baseUrl).host })
  }

  if (path === '/api/auth/oauth/start' && method === 'GET') {
    if (!oauth) throw new HttpError(404, 'Sign in with Canvas isn’t set up on this server.')
    return startOAuth(req, res, oauth)
  }
  if (path === '/api/auth/oauth/callback' && method === 'GET') {
    if (!oauth) throw new HttpError(404, 'Sign in with Canvas isn’t set up on this server.')
    return finishOAuth(req, res, oauth, url.searchParams)
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    assertCsrfSafe(req)
    const s = getSession(req)
    if (s?.kind === 'oauth') await revokeOAuth(s)
    destroySession(req, res)
    return json(res, 200, { ok: true })
  }

  if (path === '/api/canvas/status' && method === 'GET') {
    const creds = credentials(req)
    if (!creds) return json(res, 200, { state: 'signed_out', oauthHost: oauth ? new URL(oauth.baseUrl).host : null })
    try {
      const self = await withCanvas(req, (c) => getOne<{ name?: string }>(c, '/users/self'))
      return json(res, 200, { state: 'connected', userName: self.name ?? 'Canvas user', baseHost: new URL(creds.config.baseUrl).host, method: creds.session?.kind ?? 'server' })
    } catch (e) {
      if (e instanceof CanvasHttpError && e.status === 401) return json(res, 200, { state: 'unauthorized', message: 'Canvas sign-in expired or was revoked. Connect again.' })
      return json(res, 200, { state: 'error', message: e instanceof Error ? e.message : 'Couldn’t reach Canvas.' })
    }
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
    handleApi(req, res, url).catch((e) => (e instanceof HttpError ? json(res, e.status, { message: e.message }) : json(res, 500, { message: 'Internal error' })))
    return
  }
  if (SERVE_DIST) return serveStatic(res, path)
  json(res, 404, { message: 'Not found' })
}).listen(PORT, () => {
  console.log(`CampusFlow server on http://localhost:${PORT} — Canvas sign-in: access token${oauth ? ` + OAuth (${new URL(oauth.baseUrl).host})` : ''}`)
})
