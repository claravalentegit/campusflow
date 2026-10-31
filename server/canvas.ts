/**
 * Read-only Canvas API client. Runs on the server only; the access token never reaches the browser.
 * Uses only GET endpoints from the official Canvas REST API.
 */

export interface CanvasConfig {
  baseUrl: string
  token: string
}

export class CanvasHttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function readCanvasConfig(env: NodeJS.ProcessEnv): { config: CanvasConfig | null; missing: string[] } {
  const baseUrl = (env.CANVAS_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const token = (env.CANVAS_ACCESS_TOKEN ?? '').trim()
  const missing = [!baseUrl && 'CANVAS_BASE_URL', !token && 'CANVAS_ACCESS_TOKEN'].filter(Boolean) as string[]
  if (missing.length) return { config: null, missing }
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return { config: null, missing: ['CANVAS_BASE_URL (must use https)'] }
  } catch {
    return { config: null, missing: ['CANVAS_BASE_URL (not a valid URL)'] }
  }
  return { config: { baseUrl, token }, missing: [] }
}

function nextLink(header: string | null): string | null {
  if (!header) return null
  for (const part of header.split(',')) {
    const m = part.match(/<([^>]+)>;\s*rel="next"/)
    if (m) return m[1]
  }
  return null
}

async function request(config: CanvasConfig, url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 401) throw new CanvasHttpError(401, 'Canvas rejected the access token. It may have expired or been revoked.')
  if (res.status === 403) throw new CanvasHttpError(403, 'Canvas denied access to this resource.')
  if (!res.ok) throw new CanvasHttpError(res.status, `Canvas responded with HTTP ${res.status}.`)
  return res
}

/** GET a list endpoint, following Canvas pagination (Link headers), capped at `maxPages`. */
export async function getAll<T>(config: CanvasConfig, path: string, maxPages = 10): Promise<T[]> {
  let url: string | null = `${config.baseUrl}/api/v1${path}${path.includes('?') ? '&' : '?'}per_page=100`
  const out: T[] = []
  for (let page = 0; url && page < maxPages; page++) {
    // Only follow pagination links on the configured Canvas host.
    if (new URL(url).origin !== new URL(config.baseUrl).origin) break
    const res = await request(config, url)
    out.push(...((await res.json()) as T[]))
    url = nextLink(res.headers.get('link'))
  }
  return out
}

export async function getOne<T>(config: CanvasConfig, path: string): Promise<T> {
  const res = await request(config, `${config.baseUrl}/api/v1${path}`)
  return (await res.json()) as T
}

interface RawCourse {
  id: number
  [key: string]: unknown
}

async function optional<T>(p: Promise<T[]>): Promise<T[]> {
  try {
    return await p
  } catch (e) {
    // Some courses disable Modules or Announcements for students; treat 403/404 as "none".
    if (e instanceof CanvasHttpError && (e.status === 403 || e.status === 404)) return []
    throw e
  }
}

export async function fetchSnapshot(config: CanvasConfig) {
  const courses = await getAll<RawCourse>(
    config,
    // total_scores and current_grading_period_scores: the grade exactly as Canvas shows it to the student.
    '/courses?enrollment_state=active&include[]=term&include[]=teachers&include[]=public_description&include[]=total_scores&include[]=current_grading_period_scores',
  )
  const now = new Date()
  const start = new Date(now.getTime() - 30 * 86400000).toISOString()
  const end = new Date(now.getTime() + 120 * 86400000).toISOString()
  const bundles = await Promise.all(
    courses.map(async (course) => {
      const [assignments, assignmentGroups, modules, announcements] = await Promise.all([
        optional(getAll(config, `/courses/${course.id}/assignments?include[]=submission&order_by=due_at`)),
        optional(getAll(config, `/courses/${course.id}/assignment_groups`)),
        optional(getAll(config, `/courses/${course.id}/modules?include[]=items`)),
        optional(getAll(config, `/announcements?context_codes[]=course_${course.id}&start_date=${start}`, 2)),
      ])
      return { course, assignments, assignmentGroups, modules, announcements }
    }),
  )
  const contextCodes = courses.map((c) => `context_codes[]=course_${c.id}`).join('&')
  const events = courses.length
    ? await optional(getAll(config, `/calendar_events?type=event&${contextCodes}&start_date=${start}&end_date=${end}`, 3))
    : []
  return { fetchedAt: now.toISOString(), courses: bundles, events }
}
