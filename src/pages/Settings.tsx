import { useEffect, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { format } from 'date-fns'
import { CalendarClock, Check, Database, Download, Flame, Gamepad2, Minus, Monitor, Moon, Palette, Plug, Plus, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Sun, Timer, Trash2, Volume2 } from 'lucide-react'
import { formatMinutes } from '@/domain/dates'
import type { Preferences, ThemePreference, Weekday } from '@/domain/types'
import { WEEKDAYS } from '@/domain/types'
import { syncCanvas, useCanvasSync } from '@/integrations/canvas/sync'
import { selectData, STORAGE_KEY, useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { sfx } from '@/game/fx'
import { LevelBadge, ProgressBar, useXp } from '@/components/game/GameUI'
import { Page, usePageTitle } from '@/components/Page'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { confirm } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { Segmented } from '@/components/ui/Segmented'
import { cn } from '@/components/ui/cn'
import { useDisconnect } from './Connect'

const DAY_LABEL: Record<Weekday, string> = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' }
const DEFAULT_AVAILABILITY: Record<Weekday, number> = { sun: 120, mon: 180, tue: 180, wed: 180, thu: 180, fri: 120, sat: 60 }

export function Settings() {
  usePageTitle('Settings')
  const prefs = useStore((s) => s.prefs)
  const update = useStore((s) => s.updatePrefs)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <Page className="max-w-3xl">
      <h1 className="mb-5 text-3xl font-black tracking-tight">Settings</h1>
      <div className="flex flex-col gap-5">
        <ProfileCard />

        <Panel id="game" title="Game" description="How the XP game works for you." icon={Gamepad2} tone="fire" bodyClassName="flex flex-col gap-6 px-5 pt-2 pb-5">
          <div>
            <p className="text-sm font-extrabold">Daily quest</p>
            <p className="mb-3 text-xs font-semibold text-fg-3">How many things to finish each day for a gold day and to keep your streak.</p>
            <ChoiceChips
              label="Daily quest goal"
              value={prefs.dailyGoal}
              options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n), sub: n === 1 ? 'thing' : 'things' }))}
              onChange={(n) => update({ dailyGoal: n })}
              big
              icon={<Flame className="size-3.5" aria-hidden />}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Checkbox checked={prefs.sound} onChange={(v) => update({ sound: v })} label="Sound effects" description="Pops, coins and fanfares when you finish things" />
            <Button
              size="sm"
              variant="secondary"
              icon={Volume2}
              disabled={!prefs.sound}
              onClick={() => {
                sfx.pop()
                setTimeout(sfx.coin, 60)
              }}
            >
              Play a sound
            </Button>
          </div>
          <div>
            <p className="text-sm font-extrabold">Focus session length</p>
            <p className="mb-3 text-xs font-semibold text-fg-3">Every focused minute earns 1 XP.</p>
            <ChoiceChips label="Focus session length" value={prefs.focusMinutes} options={[15, 25, 45, 60, 90].map((m) => ({ value: m, label: String(m), sub: 'min' }))} onChange={(m) => update({ focusMinutes: m })} icon={<Timer className="size-3.5" aria-hidden />} />
          </div>
        </Panel>

        <Panel id="look" title="Look" icon={Palette} tone="pink" bodyClassName="flex flex-col gap-5 px-5 pt-2 pb-5">
          <ThemePicker value={prefs.theme} onChange={(theme) => update({ theme })} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold">Week starts on</p>
              <p className="text-xs font-semibold text-fg-3">For the calendar and your weekly goal</p>
            </div>
            <Segmented label="Week starts on" value={String(prefs.weekStartsOn) as '0' | '1'} onChange={(v) => update({ weekStartsOn: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
          </div>
        </Panel>

        <StudyTimePanel prefs={prefs} update={update} />
        <CanvasPanel />

        <Panel id="assistant" title="Planning helper" description="Suggestions for stages and what to do next." icon={Sparkles} tone="blue" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Rule-based: active</Badge>
            <Badge tone="outline">AI: not set up</Badge>
          </div>
          <p className="text-sm font-semibold text-fg-2">Suggestions use simple, transparent rules that run in your browser. No AI service is connected, and nothing about your coursework leaves your device.</p>
          <Checkbox checked={prefs.aiConsent} onChange={(v) => update({ aiConsent: v })} label="Allow AI help later" description="If an AI helper is added, it may read assignment text you choose" />
        </Panel>

        <DataPanel />
      </div>
    </Page>
  )
}

/** Your player card: avatar, level, and name. */
function ProfileCard() {
  const name = useStore((s) => s.prefs.displayName)
  const update = useStore((s) => s.updatePrefs)
  const { level, title, progress, into, needed } = useXp()
  return (
    <section id="profile" className="card-3d relative overflow-hidden p-5 sm:p-6">
      <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-44 rounded-full bg-accent-soft" />
      <div className="relative flex flex-col items-center gap-4 sm:flex-row">
        <span className="relative grid size-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffd56b] to-[#ff8a4c] text-3xl font-black text-white ring-4 ring-gold ring-offset-4 ring-offset-surface">
          {(name || 'S').slice(0, 1).toUpperCase()}
          <LevelBadge level={level} size="sm" className="absolute -right-2 -bottom-2" />
        </span>
        <div className="w-full min-w-0 flex-1">
          <label htmlFor="display-name" className="text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
            Your name
          </label>
          <Input id="display-name" value={name} maxLength={40} onChange={(e) => update({ displayName: e.target.value })} className="mt-1 h-12 text-lg font-black" placeholder="What should we call you?" />
          <div className="mt-3 flex items-center gap-3">
            <span className="shrink-0 text-sm font-extrabold text-accent-text">
              Level {level} · {title}
            </span>
            <ProgressBar value={progress} className="flex-1" label="Progress to next level" />
            <span className="tabular shrink-0 text-xs font-bold text-fg-3">
              {into}/{needed}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Row of chunky 3D choice buttons; the selected one pops. */
function ChoiceChips<T extends number>({ label, value, options, onChange, big, icon }: { label: string; value: T; options: Array<{ value: T; label: string; sub?: string }>; onChange: (v: T) => void; big?: boolean; icon?: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${o.label} ${o.sub ?? ''}`.trim()}
            whileTap={{ scale: 0.9 }}
            animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
            onClick={() => {
              if (!active) sfx.tap()
              onChange(o.value)
            }}
            className={cn(
              'btn-3d flex flex-col items-center justify-center rounded-2xl border-2 font-black',
              big ? 'size-16 text-2xl' : 'h-14 min-w-16 px-3 text-lg',
              active ? 'border-transparent bg-accent text-white [--press:var(--accent-press)]' : 'border-line bg-surface text-fg-2 [--press:var(--line)] hover:border-line-strong',
            )}
          >
            <span className="leading-none">{o.label}</span>
            {o.sub && (
              <span className={cn('mt-1 flex items-center gap-0.5 text-[10px] leading-none font-extrabold', active ? 'text-white/85' : 'text-fg-3')}>
                {active && icon}
                {o.sub}
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'Auto', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

/** Theme cards with a tiny preview of each look. */
function ThemePicker({ value, onChange }: { value: ThemePreference; onChange: (t: ThemePreference) => void }) {
  return (
    <div>
      <p className="mb-3 text-sm font-extrabold">Theme</p>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => {
          const active = value === t.value
          return (
            <motion.button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t.label === 'Auto' ? 'System' : t.label}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (!active) sfx.tap()
                onChange(t.value)
              }}
              className={cn('card-3d relative flex flex-col gap-2 p-2.5 text-left transition-colors', active && 'border-accent')}
            >
              <span aria-hidden className={cn('flex h-16 overflow-hidden rounded-xl border-2 border-line', t.value === 'system' && 'bg-gradient-to-r from-white from-50% to-[#1b1729] to-50%', t.value === 'light' && 'bg-white', t.value === 'dark' && 'bg-[#1b1729]')}>
                <span className="m-2 flex w-full flex-col gap-1.5">
                  <span className="h-2 w-2/3 rounded-full bg-[#6d4aff]" />
                  <span className="h-2 w-full rounded-full bg-[#d4d0e3] opacity-70" />
                  <span className="h-2 w-1/2 rounded-full bg-[#ffb800]" />
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-sm font-extrabold">
                <t.icon className="size-4" aria-hidden /> {t.label}
              </span>
              {active && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-accent text-white shadow-md">
                  <Check className="size-3.5" strokeWidth={4} aria-hidden />
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function StudyTimePanel({ prefs, update }: { prefs: Preferences; update: (p: Partial<Preferences>) => void }) {
  const a = prefs.availability
  const total = a ? WEEKDAYS.reduce((s, d) => s + a[d], 0) : 0
  const step = (d: Weekday, delta: number) => {
    if (!a) return
    sfx.tap()
    update({ availability: { ...a, [d]: Math.max(0, Math.min(600, a[d] + delta)) } })
  }
  return (
    <Panel id="availability" title="Study time" description="Tell CampusFlow how much time you have, so it can warn you about busy days." icon={CalendarClock} tone="green" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
      <Checkbox checked={!!a} onChange={(on) => update({ availability: on ? DEFAULT_AVAILABILITY : null })} label="Plan around my free time" description={a ? `${formatMinutes(total)} a week` : 'Off: busy days are flagged above a fixed amount of work'} />
      {a ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className="card-3d flex flex-col items-center gap-1.5 p-2.5">
              <span className="text-xs font-black tracking-wider text-fg-3 uppercase">{DAY_LABEL[d]}</span>
              <span className="tabular text-base font-black">{a[d] ? formatMinutes(a[d]) : 'Off'}</span>
              <span className="flex gap-1">
                <button type="button" onClick={() => step(d, -30)} disabled={a[d] === 0} aria-label={`Less time on ${DAY_LABEL[d]}`} className="btn-3d grid size-7 place-items-center rounded-lg bg-surface-2 text-fg-2 [--press:var(--line-strong)] disabled:opacity-40">
                  <Minus className="size-3.5" strokeWidth={3} aria-hidden />
                </button>
                <button type="button" onClick={() => step(d, 30)} aria-label={`More time on ${DAY_LABEL[d]}`} className="btn-3d grid size-7 place-items-center rounded-lg bg-success-bright text-white [--press:var(--success-press)]">
                  <Plus className="size-3.5" strokeWidth={3} aria-hidden />
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm font-extrabold">Flag a day as busy above</p>
          <ChoiceChips label="Busy day threshold" value={prefs.overloadThresholdMinutes} options={[180, 240, 300, 360, 480].map((m) => ({ value: m, label: `${m / 60}h`, sub: 'of work' }))} onChange={(m) => update({ overloadThresholdMinutes: m })} />
        </div>
      )}
    </Panel>
  )
}

function CanvasPanel() {
  const prefs = useStore((s) => s.prefs)
  const disconnectCanvas = useStore((s) => s.disconnectCanvas)
  const syncing = useCanvasSync((s) => s.syncing)
  const navigate = useNavigate()
  const disconnect = useDisconnect()
  const connected = prefs.dataMode === 'canvas'
  return (
    <Panel id="canvas" title="Canvas" description="Read-only: never submits work, changes grades or messages anyone." icon={Plug} tone="accent" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
      <div data-testid="canvas-status" className="flex flex-col gap-3">
        {connected ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-bright opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-success-bright" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-success">Connected</span>
                <span className="block truncate text-sm font-bold text-fg-2">
                  {prefs.canvasUser} · {prefs.canvasHost}
                </span>
              </span>
            </div>
            {prefs.lastCanvasSyncAt && <p className="text-xs font-semibold text-fg-3">Last synced {format(new Date(prefs.lastCanvasSyncAt), 'MMM d, h:mm a')} · syncs automatically while CampusFlow is open</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={RefreshCw} disabled={syncing} className={syncing ? '[&_svg]:animate-spin' : ''} onClick={() => void syncCanvas()}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
              <Button variant="secondary" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <span className="size-3 rounded-full bg-line-strong" aria-hidden />
              <span className="font-black text-fg-2">{prefs.dataMode === 'demo' ? 'Demo mode — not connected' : 'Not connected'}</span>
            </div>
            <p className="text-sm font-semibold text-fg-2">Connect once and your classes, assignments and grades come in by themselves.</p>
            <Button variant="primary" icon={Plug} className="self-start" onClick={() => navigate('/connect')}>
              Connect Canvas
            </Button>
          </>
        )}
        {!connected && prefs.dataMode === 'manual' && useStore.getState().courses.some((c) => c.source === 'canvas') && (
          <Button
            variant="ghost"
            icon={Trash2}
            className="self-start text-danger hover:text-danger"
            onClick={async () => {
              if (await confirm({ title: 'Remove imported Canvas data?', message: 'Classes and assignments that came from Canvas will be deleted from CampusFlow. Things you added yourself and your XP stay.', confirmLabel: 'Remove' })) {
                disconnectCanvas(true)
                toast('Canvas data removed')
              }
            }}
          >
            Remove imported Canvas data
          </Button>
        )}
      </div>
      <p className="flex items-start gap-2 text-xs font-semibold text-fg-3">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Your Canvas token is kept on the CampusFlow server, encrypted, never in this browser. CampusFlow never asks for your Canvas password.
      </p>
    </Panel>
  )
}

function DataPanel() {
  const state = useStore()
  const resetDemo = useStore((s) => s.resetDemoData)
  const startEmpty = useStore((s) => s.startEmpty)
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: 'CampusFlow', version: 2, data: selectData(state), prefs: state.prefs }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campusflow-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('Backup downloaded')
  }
  let bytes = 0
  try {
    bytes = localStorage.getItem(STORAGE_KEY)?.length ?? 0
  } catch {
    /* unavailable */
  }
  return (
    <Panel id="data" title="Your data" description={`Saved in this browser (${Math.max(1, Math.round(bytes / 1024))} KB). Not synced between devices.`} icon={Database} tone="slate" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={Download} onClick={exportData}>
          Download a backup
        </Button>
        <Link to="/me" className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-sm font-extrabold [--press:var(--line)]">
          See your stats
        </Link>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-danger/40 p-4">
        <p className="text-sm font-black text-danger">Danger zone</p>
        <p className="mb-3 text-xs font-semibold text-fg-3">These can’t be undone. Download a backup first if you want to keep anything.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={async () => {
              if (await confirm({ title: 'Load fresh demo data?', message: 'This replaces everything in CampusFlow with the sample semester.', confirmLabel: 'Load demo data' })) {
                resetDemo()
                toast('Demo data loaded')
              }
            }}
          >
            {state.prefs.dataMode === 'demo' ? 'Reset demo data' : 'Load demo data'}
          </Button>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={async () => {
              if (await confirm({ title: 'Start with an empty workspace?', message: 'All classes, assignments, tasks, grades and XP in this browser will be deleted. Settings are kept.', confirmLabel: 'Delete everything' })) {
                startEmpty()
                toast('Workspace cleared — add your first class to begin')
              }
            }}
          >
            Start empty
          </Button>
        </div>
      </div>
    </Panel>
  )
}
