import type { CanvasMapped } from './mapping'
import { mapCanvasSnapshot } from './mapping'
import type { CanvasRawSnapshot, CanvasStatus } from './types'

/**
 * The boundary between CampusFlow and Canvas. Everything goes through the CampusFlow server,
 * which holds the student's Canvas credentials; this page never sees a token after sign-in.
 */
export class CanvasError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const UNREACHABLE = 'Canvas sign-in needs the CampusFlow server, and it isn’t reachable from here.'

export async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json', 'X-CampusFlow': '1' } : {}), ...(init.headers ?? {}) },
    })
  } catch {
    throw new CanvasError(0, UNREACHABLE)
  }
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new CanvasError(res.status === 404 || res.status >= 500 ? 0 : res.status, UNREACHABLE)
  }
  if (!res.ok) throw new CanvasError(res.status, (body as { message?: string }).message ?? `Request failed (HTTP ${res.status}).`)
  return body as T
}

export interface AuthOptions {
  token: boolean
}

export const canvasApi = {
  /** What sign-in methods the server offers. Throws CanvasError(0) when there is no server. */
  options: () => call<AuthOptions>('/api/auth/options'),

  async status(): Promise<CanvasStatus> {
    try {
      return await call<CanvasStatus>('/api/canvas/status')
    } catch (e) {
      return { state: 'server_unreachable', message: (e as Error).message }
    }
  },

  /** Connect with a personal access token. The token is sent once, to our own server. */
  loginWithToken: (baseUrl: string, token: string) =>
    call<Extract<CanvasStatus, { state: 'connected' }>>('/api/auth/token', { method: 'POST', body: JSON.stringify({ baseUrl, token }) }),

  logout: () => call<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' }),

  async fetchData(): Promise<CanvasMapped> {
    return mapCanvasSnapshot(await call<CanvasRawSnapshot>('/api/canvas/snapshot'))
  },
}
