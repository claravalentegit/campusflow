/**
 * Request-level protections for the integration server.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { IncomingMessage } from 'node:http'

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const insecureAllowed = () => process.env.CANVAS_ALLOW_INSECURE === '1'

/**
 * Turn what a student types ("canvas.myschool.edu", "https://myschool.instructure.com/courses")
 * into a Canvas origin. Only https is accepted (plain http only in local testing).
 */
export function normalizeCanvasUrl(input: string): string {
  let raw = String(input ?? '').trim()
  if (!raw) throw new HttpError(400, 'Enter your school’s Canvas address.')
  if (!/^[a-z]+:\/\//i.test(raw)) raw = `https://${raw}`
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new HttpError(400, 'That doesn’t look like a web address. Try something like canvas.yourschool.edu.')
  }
  if (url.username || url.password) throw new HttpError(400, 'Remove the username or password from the address.')
  if (url.protocol !== 'https:' && !(insecureAllowed() && url.protocol === 'http:')) throw new HttpError(400, 'The Canvas address must start with https://')
  if (!url.hostname.includes('.') && !insecureAllowed()) throw new HttpError(400, 'Enter the full Canvas address, like canvas.yourschool.edu.')
  return url.origin
}

/** Optional allowlist, e.g. CANVAS_ALLOWED_HOSTS="*.instructure.com,canvas.myschool.edu". */
function hostAllowed(host: string): boolean {
  const list = (process.env.CANVAS_ALLOWED_HOSTS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  if (!list.length) return true
  return list.some((p) => (p.startsWith('*.') ? host.endsWith(p.slice(1)) : host === p))
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v6 = ip.toLowerCase()
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')
}

/**
 * The server fetches whatever Canvas address a student enters, so block addresses that point
 * at private networks (server-side request forgery).
 */
export async function assertSafeCanvasHost(origin: string): Promise<void> {
  const { hostname } = new URL(origin)
  if (!hostAllowed(hostname.toLowerCase())) throw new HttpError(400, 'This CampusFlow server isn’t set up for that Canvas address.')
  if (insecureAllowed()) return
  let addresses: Array<{ address: string }>
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new HttpError(400, `Couldn’t find ${hostname}. Check the spelling of your school’s Canvas address.`)
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new HttpError(400, 'That address isn’t a public Canvas site.')
}

/** Simple fixed-window rate limit, per key. */
const hits = new Map<string, { count: number; reset: number }>()
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs })
    return
  }
  h.count++
  if (h.count > max) throw new HttpError(429, 'Too many attempts. Wait a minute and try again.')
}

/**
 * The visitor's address, for rate limiting. Behind a hosting proxy every request comes from the
 * proxy, so with TRUST_PROXY=1 the address the proxy appended (the last X-Forwarded-For entry) is
 * used. The earlier entries are whatever the client sent, so they're ignored.
 */
export function clientIp(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY === '1') {
    const last = String(req.headers['x-forwarded-for'] ?? '').split(',').pop()?.trim()
    if (last) return last
  }
  return req.socket.remoteAddress ?? 'unknown'
}

/**
 * State-changing requests must be JSON with a custom header. Browsers can't send either from a
 * cross-site form, and the session cookie is SameSite=Lax, which together blocks CSRF.
 */
export function assertCsrfSafe(req: IncomingMessage) {
  if (req.headers['x-campusflow'] !== '1' || !String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    throw new HttpError(403, 'Request blocked.')
  }
}

export async function readJsonBody<T>(req: IncomingMessage, limit = 16 * 1024): Promise<T> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new HttpError(413, 'Request too large.')
    chunks.push(chunk as Buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T
  } catch {
    throw new HttpError(400, 'Invalid request.')
  }
}
