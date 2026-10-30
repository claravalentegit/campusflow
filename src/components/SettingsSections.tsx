import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { format } from 'date-fns'
import { Check, Database, Download, Flame, Gamepad2, Languages, Monitor, Moon, Palette, Plug, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Sun, Timer, Trash2, Volume2 } from 'lucide-react'
import type { ThemePreference } from '@/domain/types'
import { syncCanvas, useCanvasSync } from '@/integrations/canvas/sync'
import { selectData, STORAGE_KEY, useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { sfx } from '@/game/fx'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { confirm } from '@/components/ui/Dialog'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/components/ui/cn'
import { useDisconnect } from '@/pages/Connect'
import { fmtDate, useT } from '@/i18n'
import { msg } from '@/i18n/langs'
import { LanguagePicker } from '@/components/LanguagePicker'


/** All settings, shown at the bottom of the Me tab. */
export function SettingsSections() {
  const prefs = useStore((s) => s.prefs)
  const update = useStore((s) => s.updatePrefs)
  const t = useT()

  return (
    <section aria-labelledby="settings-title" id="settings" className="scroll-mt-24">
      <h2 id="settings-title" className="mb-3 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
        {t('Settings')}
      </h2>
      <div className="flex flex-col gap-5">
        <Panel id="language" title={t('Language')} description={t('The language CampusFlow uses. Your classes and assignments stay as your teachers wrote them.')} icon={Languages} tone="blue" bodyClassName="flex flex-col gap-3 px-5 pt-2 pb-5">
          <LanguagePicker value={prefs.language} onChange={(language) => update({ language })} label={t('Language')} />
        </Panel>

        <Panel id="game" title={t('Game')} description={t('How the XP game works for you.')} icon={Gamepad2} tone="fire" bodyClassName="flex flex-col gap-6 px-5 pt-2 pb-5">
          <div>
            <p className="text-sm font-extrabold">{t('Daily quest')}</p>
            <p className="mb-3 text-xs font-semibold text-fg-3">{t('How many things to finish each day for a gold day and to keep your streak.')}</p>
            <ChoiceChips
              label={t('Daily quest goal')}
              value={prefs.dailyGoal}
              options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n), sub: n === 1 ? t('thing') : t('things') }))}
              onChange={(n) => update({ dailyGoal: n })}
              big
              icon={<Flame className="size-3.5" aria-hidden />}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Checkbox checked={prefs.sound} onChange={(v) => update({ sound: v })} label={t('Sound effects')} description={t('Pops, coins and fanfares when you finish things')} />
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
              {t('Play a sound')}
            </Button>
          </div>
          <div>
            <p className="text-sm font-extrabold">{t('Focus session length')}</p>
            <p className="mb-3 text-xs font-semibold text-fg-3">{t('Every focused minute earns 1 XP.')}</p>
            <ChoiceChips label={t('Focus session length')} value={prefs.focusMinutes} options={[15, 25, 45, 60, 90].map((m) => ({ value: m, label: String(m), sub: 'min' }))} onChange={(m) => update({ focusMinutes: m })} icon={<Timer className="size-3.5" aria-hidden />} />
          </div>
        </Panel>

        <Panel id="look" title={t('Look')} icon={Palette} tone="pink" bodyClassName="flex flex-col gap-5 px-5 pt-2 pb-5">
          <ThemePicker value={prefs.theme} onChange={(theme) => update({ theme })} />
</Panel>

        <CanvasPanel />

        <Panel id="assistant" title={t('Planning helper')} description={t('Suggestions for stages and what to do next.')} icon={Sparkles} tone="blue" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">{t('Rule-based: active')}</Badge>
            <Badge tone="outline">{t('AI: not set up')}</Badge>
          </div>
          <p className="text-sm font-semibold text-fg-2">{t('Suggestions use simple, transparent rules that run in your browser. No AI service is connected, and nothing about your coursework leaves your device.')}</p>
          <Checkbox checked={prefs.aiConsent} onChange={(v) => update({ aiConsent: v })} label={t('Allow AI help later')} description={t('If an AI helper is added, it may read assignment text you choose')} />
        </Panel>

        <DataPanel />
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
  { value: 'system', label: msg('Auto'), icon: Monitor },
  { value: 'light', label: msg('Light'), icon: Sun },
  { value: 'dark', label: msg('Dark'), icon: Moon },
]

/** Theme cards with a tiny preview of each look. */
function ThemePicker({ value, onChange }: { value: ThemePreference; onChange: (t: ThemePreference) => void }) {
  const tt = useT()
  return (
    <div>
      <p className="mb-3 text-sm font-extrabold">{tt('Theme')}</p>
      <div role="radiogroup" aria-label={tt('Theme')} className="grid grid-cols-3 gap-3">
        {THEMES.map((t) => {
          const active = value === t.value
          return (
            <motion.button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t.label === 'Auto' ? tt('System') : tt(t.label)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
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
                <t.icon className="size-4" aria-hidden /> {tt(t.label)}
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

function CanvasPanel() {
  const prefs = useStore((s) => s.prefs)
  const disconnectCanvas = useStore((s) => s.disconnectCanvas)
  const syncing = useCanvasSync((s) => s.syncing)
  const navigate = useNavigate()
  const disconnect = useDisconnect()
  const connected = prefs.dataMode === 'canvas'
  const t = useT()
  return (
    <Panel id="canvas" title="Canvas" description={t('Read-only: never submits work, changes grades or messages anyone.')} icon={Plug} tone="accent" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
      <div data-testid="canvas-status" className="flex flex-col gap-3">
        {connected ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3">
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-bright opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-success-bright" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-black text-success">{t('Connected')}</span>
                <span className="block truncate text-sm font-bold text-fg-2">
                  {prefs.canvasUser} · {prefs.canvasHost}
                </span>
              </span>
            </div>
            {prefs.lastCanvasSyncAt && <p className="text-xs font-semibold text-fg-3">{t('Last synced {when} · syncs automatically while CampusFlow is open', { when: fmtDate(new Date(prefs.lastCanvasSyncAt), 'MMM d, h:mm a') })}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={RefreshCw} disabled={syncing} className={syncing ? '[&_svg]:animate-spin' : ''} onClick={() => void syncCanvas()}>
                {syncing ? t('Syncing…') : t('Sync now')}
              </Button>
              <Button variant="secondary" onClick={() => void disconnect()}>
                {t('Disconnect')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <span className="size-3 rounded-full bg-line-strong" aria-hidden />
              <span className="font-black text-fg-2">{prefs.dataMode === 'demo' ? t('Demo mode — not connected') : t('Not connected')}</span>
            </div>
            <p className="text-sm font-semibold text-fg-2">{t('Connect once and your classes, assignments and grades come in by themselves.')}</p>
            <Button variant="primary" icon={Plug} className="self-start" onClick={() => navigate('/connect')}>
              {t('Connect Canvas')}
            </Button>
          </>
        )}
        {!connected && prefs.dataMode === 'manual' && useStore.getState().courses.some((c) => c.source === 'canvas') && (
          <Button
            variant="ghost"
            icon={Trash2}
            className="self-start text-danger hover:text-danger"
            onClick={async () => {
              if (await confirm({ title: t('Remove imported Canvas data?'), message: t('Classes and assignments that came from Canvas will be deleted from CampusFlow. Things you added yourself and your XP stay.'), confirmLabel: t('Remove') })) {
                disconnectCanvas(true)
                toast(t('Canvas data removed'))
              }
            }}
          >
            {t('Remove imported Canvas data')}
          </Button>
        )}
      </div>
      <p className="flex items-start gap-2 text-xs font-semibold text-fg-3">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t('Your Canvas token is kept on the CampusFlow server, encrypted, never in this browser. CampusFlow never asks for your Canvas password.')}
      </p>
    </Panel>
  )
}

function DataPanel() {
  const state = useStore()
  const resetDemo = useStore((s) => s.resetDemoData)
  const startEmpty = useStore((s) => s.startEmpty)
  const t = useT()
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: 'CampusFlow', version: 2, data: selectData(state), prefs: state.prefs }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campusflow-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast(t('Backup downloaded'))
  }
  let bytes = 0
  try {
    bytes = localStorage.getItem(STORAGE_KEY)?.length ?? 0
  } catch {
    /* unavailable */
  }
  return (
    <Panel id="data" title={t('Your data')} description={t('Saved in this browser ({n} KB). Not synced between devices.', { n: Math.max(1, Math.round(bytes / 1024)) })} icon={Database} tone="slate" bodyClassName="flex flex-col gap-4 px-5 pt-2 pb-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={Download} onClick={exportData}>
          {t('Download a backup')}
        </Button>
      </div>
      <SkippedList />
      <div className="rounded-2xl border-2 border-dashed border-danger/40 p-4">
        <p className="text-sm font-black text-danger">{t('Danger zone')}</p>
        <p className="mb-3 text-xs font-semibold text-fg-3">{t('These can’t be undone. Download a backup first if you want to keep anything.')}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={async () => {
              if (await confirm({ title: t('Load fresh demo data?'), message: t('This replaces everything in CampusFlow with the sample semester.'), confirmLabel: t('Load demo data') })) {
                resetDemo()
                toast(t('Demo data loaded'))
              }
            }}
          >
            {state.prefs.dataMode === 'demo' ? t('Reset demo data') : t('Load demo data')}
          </Button>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={async () => {
              if (await confirm({ title: t('Start with an empty workspace?'), message: t('All classes, assignments, tasks, grades and XP in this browser will be deleted. Settings are kept.'), confirmLabel: t('Delete everything') })) {
                startEmpty()
                toast(t('Workspace cleared — add your first class to begin'))
              }
            }}
          >
            {t('Start empty')}
          </Button>
        </div>
      </div>
    </Panel>
  )
}

/** Assignments the student skipped, with a way to bring each one back. */
function SkippedList() {
  const skipped = useStore((s) => s.prefs.skipped)
  const courses = useStore((s) => s.courses)
  const unskip = useStore((s) => s.unskipAssignment)
  const t = useT()
  if (!skipped.length) return null
  return (
    <section aria-label={t('Skipped assignments')} className="rounded-2xl bg-surface-2 p-4">
      <p className="text-sm font-black">{t('Skipped assignments')} · {skipped.length}</p>
      <p className="mb-2 text-xs font-semibold text-fg-3">{t('Hidden in CampusFlow only. They’re still on Canvas.')}</p>
      <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        {skipped.map((x) => (
          <li key={x.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">{x.title}</span>
              <span className="block truncate text-xs font-bold text-fg-3">{courses.find((c) => c.id === x.courseId)?.name ?? t('Class')} · {t('skipped {date}', { date: fmtDate(new Date(x.skippedAt), 'MMM d') })}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              icon={RotateCcw}
              onClick={() => {
                unskip(x.id)
                toast(t('“{title}” is back', { title: x.title }))
              }}
            >
              {t('Restore')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
