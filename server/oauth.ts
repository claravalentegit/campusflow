/**
 * "Sign in with Canvas" using Canvas's OAuth2 flow (needs a developer key from the school's
 * Canvas admin). https://canvas.instructure.com/doc/api/file.oauth.html
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createSession, parseCookies, setCookie, type CanvasSession } from './session.ts'

export interface OAuthConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

export function readOAuthConfig(env: NodeJS.ProcessEnv, port: number): OAuthConfig | null {
  const baseUrl = (env.CANVAS_OAUTH_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const clientId = (env.CANVAS_CLIENT_ID ?? '').trim()
  const clientSecret = (env.CANVAS_CLIENT_SECRET ?? '').trim()
  if (!baseUrl || !clientId || !clientSecret) return null
  const publicUrl = (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, '')
  return { baseUrl, clientId, clientSecret, redirectUri: `${publicUrl}/api/auth/oauth/callback` }
}

const STATE_COOKIE = 'cf_oauth_state'

function redirect(res: ServerResponse, location: string) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' })
  res.end()
}

export function startOAuth(req: IncomingMessage, res: ServerResponse, cfg: OAuthConfig) {
  const state = randomBytes(24).toString('base64url')
  setCookie(res, req, STATE_COOKIE, state, 600)
  const url = new URL(`${cfg.baseUrl}/login/oauth2/auth`)
  url.searchParams.set('client_id', cfg.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', cfg.redirectUri)
  url.searchParams.set('state', state)
  redirect(res, url.toString())
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  user?: { id: number | string; name?: string }
}

async function tokenRequest(cfg: OAuthConfig, params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${cfg.baseUrl}/login/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Canvas sign-in failed (HTTP ${res.status}).`)
  return (await res.json()) as TokenResponse
}

export async function finishOAuth(req: IncomingMessage, res: ServerResponse, cfg: OAuthConfig, query: URLSearchParams) {
  const expected = parseCookies(req)[STATE_COOKIE]
  setCookie(res, req, STATE_COOKIE, '', 0)
  if (query.get('error')) return redirect(res, '/connect?error=denied')
  const code = query.get('code')
  if (!code || !expected || query.get('state') !== expected) return redirect(res, '/connect?error=state')
  try {
    const t = await tokenRequest(cfg, { grant_type: 'authorization_code', redirect_uri: cfg.redirectUri, code })
    createSession(req, res, {
      kind: 'oauth',
      baseUrl: cfg.baseUrl,
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? null,
      expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : null,
      userName: t.user?.name ?? 'Canvas user',
      userId: String(t.user?.id ?? ''),
    })
    redirect(res, '/connect?connected=1')
  } catch {
    redirect(res, '/connect?error=token')
  }
}

export async function refreshOAuth(cfg: OAuthConfig, s: CanvasSession): Promise<Partial<CanvasSession> | null> {
  if (!s.refreshToken) return null
  try {
    const t = await tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: s.refreshToken })
    return { accessToken: t.access_token, expiresAt: t.expires_in ? Date.now() + t.expires_in * 1000 : null }
  } catch {
    return null
  }
}

/** Best effort: tell Canvas to revoke the OAuth token on sign-out. */
export async function revokeOAuth(s: CanvasSession) {
  try {
    await fetch(`${s.baseUrl}/login/oauth2/token`, { method: 'DELETE', headers: { Authorization: `Bearer ${s.accessToken}` }, signal: AbortSignal.timeout(8000) })
  } catch {
    /* ignore */
  }
}
