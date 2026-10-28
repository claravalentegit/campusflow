import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Loader2, LogIn, Plug, RefreshCw, ServerOff, ShieldCheck } from 'lucide-react'
import { canvasApi, CanvasError, type AuthOptions } from '@/integrations/canvas/adapter'
import type { CanvasStatus } from '@/integrations/canvas/types'
import { syncCanvas, useCanvasSync, type SyncResult } from '@/integrations/canvas/sync'
import { useStore } from '@/store/appStore'
import { cannons, sfx } from '@/game/fx'
import { AnimatedNumber } from '@/components/game/GameUI'
import { Page, usePageTitle } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { confirm } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Field'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/components/ui/cn'
import { BrandMark } from '@/components/layout/Brand'

type Phase = { kind: 'loading' } | { kind: 'no-server'; message: string } | { kind: 'form' } | { kind: 'connected'; status: Extract<CanvasStatus, { state: 'connected' }> } | { kind: 'importing'; userName: string } | { kind: 'done'; result: SyncResult; userName: string }

const OAUTH_ERRORS: Record<string, string> = {
  denied: 'Canvas sign-in was cancelled. Try again whenever you’re ready.',
  state: 'That sign-in link expired or didn’t match. Start again.',
  token: 'Canvas didn’t finish the sign-in. Try again, or use an access token.',
}

/** "https://canvas.school.edu/courses" → "canvas.school.edu" (display and link only; the server validates). */
export function hostFrom(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`)
    return u.hostname.includes('.') || u.hostname === 'localhost' ? u.host : null
  } catch {
    return null
  }
}

export function Connect() {
  usePageTitle('Connect Canvas')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const mode = useStore((s) => s.prefs.dataMode)
  const welcome = !useStore((s) => s.prefs.onboarded)
  const updatePrefs = useStore((s) => s.updatePrefs)
  const skip = () => {
    updatePrefs({ onboarded: true })
    navigate('/')
  }
  const skipLabel = mode === 'demo' ? 'Try the demo instead' : 'Continue without Canvas'
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [options, setOptions] = useState<AuthOptions | null>(null)
  const [address, setAddress] = useState(() => useStore.getState().prefs.canvasHost ?? '')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState<string | null>(OAUTH_ERRORS[params.get('error') ?? ''] ?? null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const host = useMemo(() => hostFrom(address), [address])

  const runImport = async (account: { userName: string; baseHost: string }) => {
    setPhase({ kind: 'importing', userName: account.userName })
    const started = Date.now()
    const result = await syncCanvas({ silent: true, account })
    await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (Date.now() - started)))) // let the import animation play
    if (!result) {
      setError(useCanvasSync.getState().error ?? 'Import failed.')
      setPhase({ kind: 'form' })
      return
    }
    useStore.getState().updatePrefs({ onboarded: true })
    setPhase({ kind: 'done', result, userName: account.userName })
    sfx.quest()
    setTimeout(cannons, 200)
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const opts = await canvasApi.options()
        if (cancelled) return
        setOptions(opts)
        const status = await canvasApi.status()
        if (cancelled) return
        if (status.state === 'connected') {
          if (params.get('connected') === '1') {
            setParams({}, { replace: true })
            await runImport({ userName: status.userName, baseHost: status.baseHost })
          } else {
            useStore.getState().updatePrefs({ onboarded: true })
            setPhase({ kind: 'connected', status })
          }
        } else setPhase({ kind: 'form' })
      } catch (e) {
        if (!cancelled) setPhase(e instanceof CanvasError && e.status !== 0 ? { kind: 'form' } : { kind: 'no-server', message: (e as Error).message })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fail = (message: string) => {
    setError(message)
    setShake((n) => n + 1)
    sfx.undo()
  }

  const confirmReplaceDemo = async () =>
    mode !== 'demo' ||
    welcome || (await confirm({ title: 'Replace the demo with your real classes?', message: 'The sample classes and anything you did with them will be removed. Your real Canvas classes will be imported.', confirmLabel: 'Continue', tone: 'primary' }))

  const connectWithToken = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!host) return fail('Enter your school’s Canvas address, like canvas.yourschool.edu.')
    if (token.trim().length < 20) return fail('Paste the whole access token from Canvas.')
    if (!(await confirmReplaceDemo())) return
    setBusy(true)
    try {
      const status = await canvasApi.loginWithToken(address, token)
      setToken('')
      await runImport({ userName: status.userName, baseHost: status.baseHost })
    } catch (err) {
      fail((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const signInWithCanvas = async () => {
    if (!(await confirmReplaceDemo())) return
    canvasApi.startOAuth()
  }

  return (
    <Page className="max-w-2xl">
      {welcome && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col items-center gap-3 pt-6 text-center sm:pt-10">
          <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 12 }}>
            <BrandMark className="size-20" />
          </motion.span>
          <h1 className="text-4xl font-black tracking-tight">Welcome to CampusFlow</h1>
          <p className="max-w-md text-lg font-bold text-fg-2">Sign in with your Canvas account to load your classes and start earning XP.</p>
        </motion.div>
      )}
      <div className={cn('mb-6 flex items-center gap-4', welcome && 'hidden')}>
        <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 13 }} className="btn-3d grid size-16 shrink-0 place-items-center rounded-[20px] bg-accent text-white [--press:var(--accent-press)]">
          <Plug className="size-8" strokeWidth={2.5} aria-hidden />
        </motion.span>
        <div>
          <h1 className="text-3xl font-black tracking-tight">Connect Canvas</h1>
          <p className="font-bold text-fg-2">Bring in all your classes and assignments automatically.</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase.kind === 'loading' && (
          <motion.div key="loading" exit={{ opacity: 0 }} className="card-3d flex flex-col gap-3 p-6" aria-label="Checking connection">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </motion.div>
        )}

        {phase.kind === 'no-server' && (
          <motion.section key="no-server" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-3d p-6" data-testid="connect-no-server">
            <p className="flex items-center gap-2 text-lg font-black">
              <ServerOff className="size-5 text-fg-3" aria-hidden /> Canvas sign-in isn’t available in this preview
            </p>
            <p className="mt-2 font-semibold text-fg-2">This is a preview version. Signing in to Canvas works once CampusFlow is installed on your computer or on a website.</p>
            <p className="mt-3 font-semibold text-fg-2">You can still try everything with sample classes.</p>
            {welcome ? (
              <Button variant="primary" size="lg" className="mt-4" onClick={skip}>
                {skipLabel}
              </Button>
            ) : (
              <Button variant="secondary" className="mt-4" onClick={() => navigate('/')}>
                Back to Today
              </Button>
            )}
          </motion.section>
        )}

        {phase.kind === 'connected' && <Connected key="connected" status={phase.status} onImported={(r) => setPhase({ kind: 'done', result: r, userName: phase.status.userName })} />}

        {phase.kind === 'importing' && (
          <motion.section key="importing" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="card-3d flex flex-col items-center gap-4 p-8 text-center" aria-live="polite">
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
              <RefreshCw className="size-10 text-accent" aria-hidden />
            </motion.span>
            <p className="text-xl font-black">Importing your classes…</p>
            <p className="font-semibold text-fg-2">Signed in as {phase.userName}</p>
            <div className="w-full max-w-sm">
              <div className="h-3 overflow-hidden rounded-full bg-accent-soft">
                <motion.div className="bar-stripes h-full rounded-full bg-accent" initial={{ width: '5%' }} animate={{ width: '92%' }} transition={{ duration: 2.5, ease: 'easeOut' }} />
              </div>
            </div>
          </motion.section>
        )}

        {phase.kind === 'done' && (
          <motion.section key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="card-3d flex flex-col items-center gap-4 p-8 text-center" data-testid="connect-done">
            <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.15, stiffness: 300, damping: 10 }}>
              <CheckCircle2 className="size-16 fill-success-soft text-success-bright" aria-hidden />
            </motion.span>
            <h2 className="text-2xl font-black">You’re connected, {phase.userName.split(' ')[0]}!</h2>
            <div className="grid w-full max-w-sm grid-cols-2 gap-3">
              <div className="card-3d p-3">
                <p className="tabular text-3xl font-black text-accent-text">
                  <AnimatedNumber value={phase.result.courses} />
                </p>
                <p className="text-xs font-extrabold text-fg-3">classes</p>
              </div>
              <div className="card-3d p-3">
                <p className="tabular text-3xl font-black text-gold-text">
                  <AnimatedNumber value={phase.result.assignments} />
                </p>
                <p className="text-xs font-extrabold text-fg-3">assignments</p>
              </div>
            </div>
            <p className="max-w-sm text-sm font-semibold text-fg-2">From now on CampusFlow syncs by itself. Anything you submit on Canvas earns XP here too.</p>
            <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={() => navigate('/')}>
              Let’s go
            </Button>
          </motion.section>
        )}

        {phase.kind === 'form' && (
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-5">
            <section className="card-3d p-5 sm:p-6">
              <Field label="Your school’s Canvas address" hint="Copy it from your browser when you’re on Canvas, like canvas.yourschool.edu or yourschool.instructure.com.">
                {(p) => <Input {...p} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="canvas.yourschool.edu" autoComplete="url" inputMode="url" spellCheck={false} className="h-12 rounded-xl border-2 text-base font-bold" />}
              </Field>
            </section>

            {options?.oauth && (
              <section className="card-3d p-5 sm:p-6">
                <h2 className="text-lg font-black">Sign in with Canvas</h2>
                <p className="mt-1 text-sm font-semibold text-fg-2">You’ll go to {options.oauth.host}, sign in there, and come right back. CampusFlow never sees your password.</p>
                <Button variant="primary" size="lg" icon={LogIn} className="mt-4 w-full" onClick={() => void signInWithCanvas()}>
                  Sign in with Canvas
                </Button>
              </section>
            )}

            <motion.form key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} onSubmit={(e) => void connectWithToken(e)} noValidate className="card-3d p-5 sm:p-6" aria-labelledby="token-title">
              <h2 id="token-title" className="flex items-center gap-2 text-lg font-black">
                <KeyRound className="size-5 text-gold" aria-hidden /> {options?.oauth ? 'Or connect with an access token' : 'Connect with an access token'}
              </h2>
              <p className="mt-1 text-sm font-semibold text-fg-2">Takes about 30 seconds. Most schools allow it.</p>
              <ol className="mt-4 flex flex-col gap-3">
                {[
                  <>
                    Open your Canvas settings{' '}
                    {host ? (
                      <a href={`https://${host}/profile/settings`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-black text-accent-text hover:underline">
                        {host}/profile/settings <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-fg-3">(enter your address above for a direct link)</span>
                    )}
                  </>,
                  <>
                    Scroll to <b className="font-black">Approved Integrations</b> and click <b className="font-black">+ New Access Token</b>.
                  </>,
                  <>
                    Type <b className="font-black">CampusFlow</b> as the purpose, pick an expiry date if you like, and click <b className="font-black">Generate Token</b>.
                  </>,
                  <>Copy the token and paste it below.</>,
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm font-semibold text-fg-2">
                    <span className="tabular grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-xs font-black text-accent-text">{i + 1}</span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
              <Field label="Access token" className="mt-5">
                {(p) => (
                  <div className="relative">
                    <Input {...p} type={showToken ? 'text' : 'password'} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Paste your token" className="h-12 rounded-xl border-2 pr-12 font-mono text-sm" />
                    <button type="button" onClick={() => setShowToken((s) => !s)} aria-label={showToken ? 'Hide token' : 'Show token'} className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-fg-3 hover:text-fg">
                      {showToken ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
                    </button>
                  </div>
                )}
              </Field>
              <AnimatePresence>
                {error && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <Button type="submit" variant="primary" size="lg" className={cn('mt-4 w-full', busy && '[&_svg]:animate-spin')} icon={busy ? Loader2 : Plug} disabled={busy}>
                {busy ? 'Connecting…' : 'Connect'}
              </Button>
              {mode === 'demo' && !welcome && <p className="mt-2 text-center text-xs font-bold text-fg-3">Your demo data will be replaced with your real classes.</p>}
            </motion.form>

            {welcome && (
              <button type="button" onClick={skip} className="self-center rounded-xl px-4 py-2 text-sm font-black text-accent-text hover:bg-accent-soft">
                Just looking? {skipLabel} →
              </button>
            )}
            <p className="flex items-start gap-2 px-1 text-xs font-semibold text-fg-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Read-only: CampusFlow never submits work, changes grades or messages anyone. Your token goes once to the CampusFlow server, which stores it encrypted; this page never keeps it. You can revoke it any time in Canvas settings. Never type your Canvas password into anything except Canvas itself.
              </span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}

function Connected({ status, onImported }: { status: Extract<CanvasStatus, { state: 'connected' }>; onImported: (r: SyncResult) => void }) {
  const navigate = useNavigate()
  const syncing = useCanvasSync((s) => s.syncing)
  const disconnect = useDisconnect()
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card-3d p-6" data-testid="connect-connected">
      <p className="flex items-center gap-2 text-lg font-black">
        <CheckCircle2 className="size-6 text-success-bright" aria-hidden /> Connected as {status.userName}
      </p>
      <p className="mt-1 font-semibold text-fg-2">{status.baseHost} · syncs automatically while CampusFlow is open</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon={RefreshCw}
          disabled={syncing}
          className={syncing ? '[&_svg]:animate-spin' : ''}
          onClick={async () => {
            const r = await syncCanvas({ account: { userName: status.userName, baseHost: status.baseHost } })
            if (r) onImported(r)
          }}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Go to Today
        </Button>
        <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => void disconnect().then((ok) => ok && navigate('/'))}>
          Disconnect
        </Button>
      </div>
    </motion.section>
  )
}

/** Sign out of Canvas on the server, optionally removing the imported records. */
export function useDisconnect() {
  const disconnectCanvas = useStore((s) => s.disconnectCanvas)
  return async () => {
    const ok = await confirm({ title: 'Disconnect Canvas?', message: 'CampusFlow will sign out of Canvas and stop syncing. Your classes, assignments and XP stay here unless you delete them in Settings. If you used an access token, you can also delete it in Canvas settings.', confirmLabel: 'Disconnect' })
    if (!ok) return false
    try {
      await canvasApi.logout()
    } catch {
      /* the server may be gone; still disconnect locally */
    }
    disconnectCanvas(false)
    return true
  }
}
