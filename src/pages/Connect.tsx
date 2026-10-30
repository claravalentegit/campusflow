import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardPaste, ExternalLink, Eye, EyeOff, Globe, KeyRound, Laptop, Loader2, Plug, RefreshCw, Settings2, ShieldCheck } from 'lucide-react'
import { canvasApi, CanvasError } from '@/integrations/canvas/adapter'
import type { CanvasStatus } from '@/integrations/canvas/types'
import { syncCanvas, useCanvasSync, type SyncResult } from '@/integrations/canvas/sync'
import { useStore } from '@/store/appStore'
import { cannons, sfx } from '@/game/fx'
import { AnimatedNumber } from '@/components/game/GameUI'
import { BrandMark } from '@/components/layout/Brand'
import { Page, usePageTitle } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { confirm } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { cn } from '@/components/ui/cn'
import { tr, useT } from '@/i18n'
import { LANGS } from '@/i18n/langs'

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

/** The steps of the sign-in deck, in order. */
const STEPS = ['welcome', 'address', 'settings', 'token', 'paste'] as const
type Step = (typeof STEPS)[number]
type Card = Step | 'importing' | 'done' | 'connected' | 'checking' | 'preview'

export function Connect() {
  const t = useT()
  usePageTitle(t('Connect Canvas'))
  const navigate = useNavigate()
  const mode = useStore((s) => s.prefs.dataMode)
  const welcome = !useStore((s) => s.prefs.onboarded)
  const updatePrefs = useStore((s) => s.updatePrefs)
  const [card, setCard] = useState<Card>('checking')
  const [dir, setDir] = useState<1 | -1>(1)
  const [serverOk, setServerOk] = useState<boolean | null>(null)
  const [status, setStatus] = useState<Extract<CanvasStatus, { state: 'connected' }> | null>(null)
  const [address, setAddress] = useState(() => useStore.getState().prefs.canvasHost ?? '')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ result: SyncResult; userName: string } | null>(null)
  const host = useMemo(() => hostFrom(address), [address])
  const skipLabel = mode === 'demo' ? t('Try the demo instead') : t('Continue without Canvas')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await canvasApi.options()
        if (cancelled) return
        setServerOk(true)
        const s = await canvasApi.status()
        if (cancelled) return
        if (s.state === 'connected') {
          useStore.getState().updatePrefs({ onboarded: true })
          setStatus(s)
          setCard('connected')
        } else setCard('welcome')
      } catch (e) {
        if (cancelled) return
        setServerOk(e instanceof CanvasError && e.status !== 0)
        setCard('welcome')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const go = (next: Card, d: 1 | -1 = 1) => {
    setError(null)
    setDir(d)
    setCard(next)
  }
  const index = STEPS.indexOf(card as Step)
  const back = () => index > 0 && go(STEPS[index - 1], -1)
  const fail = (message: string) => {
    setError(message)
    setShake((n) => n + 1)
    sfx.undo()
  }
  const skip = () => {
    updatePrefs({ onboarded: true })
    navigate('/')
  }

  const connect = async () => {
    if (token.trim().length < 20) return fail(t('That’s too short. Paste the whole token from Canvas.'))
    if (mode === 'demo' && !welcome) {
      const ok = await confirm({ title: t('Replace the demo with your real classes?'), message: t('The sample classes and anything you did with them will be removed.'), confirmLabel: t('Continue'), tone: 'primary' })
      if (!ok) return
    }
    setBusy(true)
    setError(null)
    try {
      const s = await canvasApi.loginWithToken(address, token)
      setToken('')
      go('importing')
      const started = Date.now()
      const r = await syncCanvas({ silent: true, account: { userName: s.userName, baseHost: s.baseHost } })
      await new Promise((res) => setTimeout(res, Math.max(0, 1400 - (Date.now() - started))))
      if (!r) {
        go('paste', -1)
        fail(useCanvasSync.getState().error ?? t('Import failed. Try again.'))
        return
      }
      updatePrefs({ onboarded: true })
      setResult({ result: r, userName: s.userName })
      go('done')
      sfx.quest()
      setTimeout(cannons, 250)
    } catch (e) {
      const err = e as CanvasError
      if (err.status === 0) {
        // No CampusFlow server here (the chat preview): explain instead of showing an error.
        setToken('')
        go('preview')
      } else fail(err.message)
    } finally {
      setBusy(false)
    }
  }

  const stepNumber = index >= 1 ? index : null

  return (
    <Page className="flex max-w-lg flex-col items-center">
      <div className="mb-5 flex w-full items-center justify-between gap-3 pt-2 sm:pt-6">
        <span className="flex items-center gap-2 text-lg font-black text-accent-text">
          <BrandMark className="size-8" /> CampusFlow
        </span>
        {serverOk === false && <span className="rounded-full bg-warn-soft px-3 py-1 text-xs font-black text-warn">{t('Preview: practice run, can’t connect')}</span>}
        <LangSwitch />
      </div>

      {/* Progress dots */}
      <div className="mb-5 flex h-2.5 items-center gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <motion.span
            key={s}
            className={cn('h-2.5 rounded-full', i <= index || ['importing', 'done', 'connected', 'preview'].includes(card) ? 'bg-accent' : 'bg-surface-3')}
            animate={{ width: s === card ? 28 : 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          />
        ))}
      </div>

      <div className="relative w-full">
        {/* The deck behind the current card */}
        {index >= 0 && index < STEPS.length - 1 && (
          <>
            <span aria-hidden className="absolute inset-x-6 top-5 bottom-[-18px] rotate-[2.5deg] rounded-[28px] border-2 border-line bg-surface opacity-60" />
            <span aria-hidden className="absolute inset-x-3 top-2.5 bottom-[-9px] rotate-[-1.5deg] rounded-[28px] border-2 border-line bg-surface opacity-90" />
          </>
        )}
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <FlashCard key={card} dir={dir} shake={card === 'paste' || card === 'address' ? shake : 0}>
            {card === 'checking' && (
              <div className="flex flex-1 items-center justify-center" aria-label={t('Loading')}>
                <Loader2 className="size-8 animate-spin text-fg-3" aria-hidden />
              </div>
            )}

            {card === 'welcome' && (
              <CardBody
                icon={<Plug className="size-9" strokeWidth={2.4} aria-hidden />}
                tone="accent"
                title={welcome ? t('Connect your Canvas') : t('Connect Canvas')}
                text={t('Bring in all your classes and assignments. It takes about a minute: you’ll make a key in Canvas and paste it here.')}
                action={
                  <Button variant="primary" size="lg" className="w-full" iconRight={ArrowRight} onClick={() => go('address')} data-autofocus>
                    {t('Let’s start')}
                  </Button>
                }
                footer={
                  welcome ? (
                    <span className="flex flex-col items-center gap-2">
                      <button type="button" onClick={skip} className="text-sm font-black text-accent-text hover:underline">
                        {t('Just looking?')} {skipLabel} →
                      </button>
                      <button type="button" onClick={() => navigate('/parent')} className="text-sm font-black text-[#0b8584] hover:underline">
                        {t('I’m a parent')} →
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => navigate(-1)} className="text-sm font-black text-fg-3 hover:text-fg">
                      {t('Not now')}
                    </button>
                  )
                }
              />
            )}

            {card === 'address' && (
              <CardForm
                onSubmit={() => (host ? go('settings') : fail(t('Type your school’s Canvas address, like canvas.yourschool.edu.')))}
                step={stepNumber}
                icon={<Globe className="size-9" strokeWidth={2.4} aria-hidden />}
                tone="blue"
                title={t('What’s your school’s Canvas address?')}
                text={t('Look at the address bar when you’re on Canvas.')}
                error={error}
                onBack={back}
                submitLabel={t('Next')}
              >
                <Input aria-label={t('Your school’s Canvas address')} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="canvas.yourschool.edu" autoComplete="url" inputMode="url" spellCheck={false} autoFocus className="h-14 rounded-2xl border-2 text-center text-lg font-extrabold" />
                <p className="text-center text-xs font-bold text-fg-3">{t('Often yourschool.instructure.com')}</p>
              </CardForm>
            )}

            {card === 'settings' && (
              <CardForm
                onSubmit={() => go('token')}
                step={stepNumber}
                icon={<Settings2 className="size-9" strokeWidth={2.4} aria-hidden />}
                tone="gold"
                title={t('Open your Canvas settings')}
                text={t('This opens in a new tab. Sign in there if Canvas asks, then come back here.')}
                onBack={back}
                submitLabel={t('I’m there')}
              >
                <a
                  href={`https://${host}/profile/settings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-3d flex items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-base font-black text-accent-text [--press:var(--line)]"
                >
                  {t('Open Canvas settings')} <ExternalLink className="size-4" aria-hidden />
                </a>
                <p className="truncate text-center text-xs font-bold text-fg-3">{host}/profile/settings</p>
              </CardForm>
            )}

            {card === 'token' && (
              <CardForm onSubmit={() => go('paste')} step={stepNumber} icon={<KeyRound className="size-9" strokeWidth={2.4} aria-hidden />} tone="fire" title={t('Make a new access token')} onBack={back} submitLabel={t('I copied it')}>
                <ol className="flex flex-col gap-2.5">
                  {[
                    <>
                      {t('Scroll to')} <b className="font-black text-fg">Approved Integrations</b>
                    </>,
                    <>
                      {t('Click')} <b className="font-black text-fg">+ New Access Token</b>
                    </>,
                    <>
                      {t('Purpose:')} <b className="font-black text-fg">CampusFlow</b>, {t('then')} <b className="font-black text-fg">Generate Token</b>
                    </>,
                    <>
                      <b className="font-black text-fg">Copy</b> {t('the long code it shows you')}
                    </>,
                  ].map((line, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-2 text-sm font-bold text-fg-2">
                      <span className="tabular grid size-7 shrink-0 place-items-center rounded-lg bg-surface text-xs font-black text-fire shadow-sm">{i + 1}</span>
                      <span>{line}</span>
                    </motion.li>
                  ))}
                </ol>
                <p className="text-center text-xs font-bold text-fg-3">{t('Canvas only shows the token once, so copy it before closing.')}</p>
              </CardForm>
            )}

            {card === 'paste' && (
              <CardForm onSubmit={() => void connect()} step={stepNumber} icon={<ClipboardPaste className="size-9" strokeWidth={2.4} aria-hidden />} tone="green" title={t('Paste your token')} error={error} onBack={back} submitLabel={busy ? t('Connecting…') : t('Connect')} submitIcon={busy ? Loader2 : Plug} busy={busy}>
                <TokenInput value={token} onChange={setToken} />
                <p className="flex items-start gap-1.5 text-xs font-semibold text-fg-3">
                  <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
                  {t('Sent once to the CampusFlow server and stored encrypted. CampusFlow only reads from Canvas and never asks for your password.')}
                </p>
                {error && serverOk === false && welcome && (
                  <Button variant="secondary" className="w-full" onClick={skip}>
                    {skipLabel}
                  </Button>
                )}
              </CardForm>
            )}

            {card === 'importing' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" aria-live="polite">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
                  <RefreshCw className="size-12 text-accent" aria-hidden />
                </motion.span>
                <p className="text-2xl font-black">{t('Importing your classes…')}</p>
                <div className="h-3 w-full max-w-xs overflow-hidden rounded-full bg-accent-soft">
                  <motion.div className="bar-stripes h-full rounded-full bg-accent" initial={{ width: '5%' }} animate={{ width: '92%' }} transition={{ duration: 2.5, ease: 'easeOut' }} />
                </div>
              </div>
            )}

            {card === 'done' && result && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" data-testid="connect-done">
                <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.1, stiffness: 300, damping: 10 }}>
                  <CheckCircle2 className="size-16 fill-success-soft text-success-bright" aria-hidden />
                </motion.span>
                <h1 className="text-2xl font-black">{t('You’re connected, {name}!', { name: result.userName.split(' ')[0] })}</h1>
                <div className="grid w-full max-w-xs grid-cols-2 gap-3">
                  <div className="card-3d p-3">
                    <p className="tabular text-3xl font-black text-accent-text">
                      <AnimatedNumber value={result.result.courses} />
                    </p>
                    <p className="text-xs font-extrabold text-fg-3">{t('classes')}</p>
                  </div>
                  <div className="card-3d p-3">
                    <p className="tabular text-3xl font-black text-gold-text">
                      <AnimatedNumber value={result.result.assignments} />
                    </p>
                    <p className="text-xs font-extrabold text-fg-3">{t('assignments')}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-fg-2">{t('CampusFlow keeps them up to date by itself. Work you submit on Canvas earns XP here too.')}</p>
                <Button variant="primary" size="lg" className="w-full" iconRight={ArrowRight} onClick={() => navigate('/')} autoFocus>
                  {t('Let’s go')}
                </Button>
              </div>
            )}

            {card === 'preview' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" data-testid="connect-preview">
                <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }} className="grid size-20 place-items-center rounded-3xl border-b-[5px] border-gold-press bg-gold text-white">
                  <Laptop className="size-10" aria-hidden />
                </motion.span>
                <h1 className="text-2xl font-black">{t('You did everything right!')}</h1>
                <p className="text-base font-semibold text-fg-2">{t('This is just a preview, and a preview page isn’t allowed to talk to Canvas. Canvas blocks that so no random website can read your stuff.')}</p>
                <div className="card-3d w-full p-4 text-left">
                  <p className="text-sm font-black">{t('To really connect')}</p>
                  <p className="mt-1 text-sm font-semibold text-fg-2">{t('CampusFlow needs to run on your own computer. Then these same cards will import your real classes. Your token wasn’t saved here, so you’ll paste it again there.')}</p>
                </div>
                <Button variant="primary" size="lg" className="w-full" onClick={skip} autoFocus>
                  {skipLabel}
                </Button>
                <Button variant="ghost" icon={ArrowLeft} onClick={() => go('paste', -1)}>
                  {t('Back')}
                </Button>
              </div>
            )}

            {card === 'connected' && status && <ConnectedCard status={status} />}
          </FlashCard>
        </AnimatePresence>
      </div>
    </Page>
  )
}

/** One card in the deck: flies away when you move on, the next rises from the stack. */
function FlashCard({ children, dir, shake }: { children: ReactNode; dir: 1 | -1; shake: number }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (shake && ref.current && !reduce) ref.current.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-12px)' }, { transform: 'translateX(12px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }], { duration: 380 })
  }, [shake, reduce])
  const variants = {
    enter: (d: 1 | -1) => (reduce ? { opacity: 0 } : d === 1 ? { opacity: 0, scale: 0.92, y: 22, rotate: 0 } : { opacity: 0, x: -320, rotate: -14 }),
    center: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 },
    exit: (d: 1 | -1) => (reduce ? { opacity: 0 } : d === 1 ? { opacity: 0, x: -360, rotate: -14, transition: { duration: 0.35 } } : { opacity: 0, scale: 0.92, y: 22, transition: { duration: 0.25 } }),
  }
  return (
    <motion.div
      custom={dir}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="relative w-full"
    >
      <div ref={ref} className="card-3d flex min-h-[440px] flex-col rounded-[28px] p-6 shadow-md sm:p-7">
        {children}
      </div>
    </motion.div>
  )
}

const TONES = {
  accent: 'bg-accent [--press:var(--accent-press)]',
  blue: 'bg-[#0ea5e9] [--press:#0369a1]',
  gold: 'bg-gold [--press:var(--gold-press)]',
  fire: 'bg-fire [--press:#d9480f]',
  green: 'bg-success-bright [--press:var(--success-press)]',
}

function CardIcon({ icon, tone }: { icon: ReactNode; tone: keyof typeof TONES }) {
  return (
    <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 12, delay: 0.08 }} className={cn('btn-3d grid size-18 place-items-center self-center rounded-[22px] text-white', TONES[tone])}>
      {icon}
    </motion.span>
  )
}

function CardBody({ icon, tone, title, text, action, footer }: { icon: ReactNode; tone: keyof typeof TONES; title: string; text: string; action: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-4 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <CardIcon icon={icon} tone={tone} />
        <h1 className="text-[26px] leading-tight font-black">{title}</h1>
        <p className="font-semibold text-fg-2">{text}</p>
      </div>
      {action}
      {footer}
    </div>
  )
}

function CardForm({ onSubmit, step, icon, tone, title, text, error, onBack, submitLabel, submitIcon, busy, children }: { onSubmit: () => void; step: number | null; icon: ReactNode; tone: keyof typeof TONES; title: string; text?: string; error?: string | null; onBack: () => void; submitLabel: string; submitIcon?: typeof Plug; busy?: boolean; children: ReactNode }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy) onSubmit()
      }}
      noValidate
      className="flex flex-1 flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-black text-fg-3 hover:text-fg" aria-label={tr('Previous card')}>
          <ArrowLeft className="size-4" aria-hidden /> {tr('Back')}
        </button>
        {step && <span className="tabular text-xs font-black tracking-wider text-fg-3 uppercase">{tr('Step {n} of {total}', { n: step, total: 4 })}</span>}
      </div>
      <CardIcon icon={icon} tone={tone} />
      <div className="text-center">
        <h1 className="text-2xl leading-tight font-black">{title}</h1>
        {text && <p className="mt-1.5 text-sm font-semibold text-fg-2">{text}</p>}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-bold text-danger">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" variant="primary" size="lg" className={cn('mt-auto w-full', busy && '[&_svg]:animate-spin')} iconRight={busy ? undefined : ArrowRight} icon={busy ? submitIcon : undefined} disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  )
}

function TokenInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} aria-label={tr('Access token')} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} autoFocus placeholder={tr('Paste it here')} className="h-14 rounded-2xl border-2 pr-12 text-center font-mono text-sm" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? tr('Hide token') : tr('Show token')} className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-fg-3 hover:text-fg">
        {show ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
      </button>
    </div>
  )
}

function ConnectedCard({ status }: { status: Extract<CanvasStatus, { state: 'connected' }> }) {
  const navigate = useNavigate()
  const syncing = useCanvasSync((s) => s.syncing)
  const disconnect = useDisconnect()
  const t = useT()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" data-testid="connect-connected">
      <CardIcon icon={<CheckCircle2 className="size-9" strokeWidth={2.4} aria-hidden />} tone="green" />
      <h1 className="text-2xl font-black">{t('Connected as {name}', { name: status.userName })}</h1>
      <p className="font-semibold text-fg-2">{status.baseHost} · {t('syncs automatically while CampusFlow is open')}</p>
      <div className="flex w-full flex-col gap-2">
        <Button variant="primary" size="lg" icon={RefreshCw} disabled={syncing} className={syncing ? '[&_svg]:animate-spin' : ''} onClick={() => void syncCanvas({ account: { userName: status.userName, baseHost: status.baseHost } })}>
          {syncing ? t('Syncing…') : t('Sync now')}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          {t('Go to Today')}
        </Button>
        <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => void disconnect().then((ok) => ok && navigate('/'))}>
          {t('Disconnect')}
        </Button>
      </div>
    </div>
  )
}

/** Sign out of Canvas on the server. Imported records and XP stay unless removed in Settings. */
export function useDisconnect() {
  const disconnectCanvas = useStore((s) => s.disconnectCanvas)
  return async () => {
    const ok = await confirm({ title: tr('Disconnect Canvas?'), message: tr('CampusFlow will sign out of Canvas and stop syncing. Your classes, assignments and XP stay here unless you delete them in Settings. You can also delete the token in your Canvas settings.'), confirmLabel: tr('Disconnect') })
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

/** Small language switch on the sign-in cards, so a new student can read them in their language. */
function LangSwitch() {
  const lang = useStore((s) => s.prefs.language)
  const update = useStore((s) => s.updatePrefs)
  return (
    <span className="flex gap-1" role="radiogroup" aria-label={tr('Language')}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={lang === l.id} aria-label={l.label} lang={l.id} title={l.label} onClick={() => update({ language: l.id })} className={cn('grid size-9 place-items-center rounded-full border-2 text-lg', lang === l.id ? 'border-accent bg-accent-soft' : 'border-transparent opacity-60 hover:opacity-100')}>
          {l.flag}
        </button>
      ))}
    </span>
  )
}
