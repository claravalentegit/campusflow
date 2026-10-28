import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Download, Plug, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { formatMinutes } from '@/domain/dates'
import type { Preferences, Weekday } from '@/domain/types'
import { WEEKDAYS } from '@/domain/types'
import { syncCanvas, useCanvasSync } from '@/integrations/canvas/sync'
import { useDisconnect } from './Connect'
import { selectData, STORAGE_KEY, useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { Page, PageHeader, usePageTitle } from '@/components/Page'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { confirm } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { Segmented } from '@/components/ui/Segmented'
import { sfx } from '@/game/fx'

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
    <Page>
      <PageHeader title="Settings" description="Preferences are saved in this browser." />
      <div className="flex flex-col gap-5">
        <Panel title="Profile & appearance" id="profile">
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
            <Field label="Display name" hint="Used in your greeting.">
              {(p) => <Input {...p} value={prefs.displayName} maxLength={40} onChange={(e) => update({ displayName: e.target.value })} />}
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-2">Theme</span>
              <Segmented label="Theme" value={prefs.theme} onChange={(theme) => update({ theme })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} className="self-start" />
            </div>
            <Field label="Week starts on">
              {(p) => (
                <Select {...p} value={prefs.weekStartsOn} onChange={(e) => update({ weekStartsOn: Number(e.target.value) as 0 | 1 })}>
                  <option value={1}>Monday</option>
                  <option value={0}>Sunday</option>
                </Select>
              )}
            </Field>
            <div className="flex items-end">
              <Checkbox checked={prefs.sidebarCompact} onChange={(v) => update({ sidebarCompact: v })} label="Compact sidebar (icons only, desktop)" />
            </div>
          </div>
        </Panel>

        <Panel title="Game" id="game" description="How the XP game works for you.">
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
            <Field label="Daily quest: things to finish each day" hint="Hit it to make the day gold and keep your streak.">
              {(p) => (
                <Select {...p} value={prefs.dailyGoal} onChange={(e) => update({ dailyGoal: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'thing' : 'things'} a day
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-fg-2">Sound effects</span>
              <div className="flex items-center gap-3">
                <Checkbox checked={prefs.sound} onChange={(v) => update({ sound: v })} label="Play sounds when I finish things" />
                <Button size="sm" variant="secondary" disabled={!prefs.sound} onClick={() => { sfx.pop(); setTimeout(sfx.coin, 60) }}>
                  Test
                </Button>
              </div>
              <p className="text-xs text-fg-3">Animations follow your device’s reduce-motion setting.</p>
            </div>
          </div>
        </Panel>

        <AvailabilityPanel prefs={prefs} update={update} />

        <Panel title="Planning" id="planning">
          <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
            <Field label="Flag a day as overloaded above" hint={prefs.availability ? 'Not used while weekly availability is set.' : 'Used when you haven’t set your availability.'}>
              {(p) => (
                <Select {...p} value={prefs.overloadThresholdMinutes} onChange={(e) => update({ overloadThresholdMinutes: Number(e.target.value) })}>
                  {[120, 180, 240, 300, 360, 480].map((m) => (
                    <option key={m} value={m}>
                      {formatMinutes(m)} of work
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Default focus session length">
              {(p) => (
                <Select {...p} value={prefs.focusMinutes} onChange={(e) => update({ focusMinutes: Number(e.target.value) })}>
                  {[15, 25, 45, 50, 60, 90].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Panel>

        <CanvasPanel />
        <AssistantPanel />
        <DataPanel />
      </div>
    </Page>
  )
}

function AvailabilityPanel({ prefs, update }: { prefs: Preferences; update: (p: Partial<Preferences>) => void }) {
  const a = prefs.availability
  return (
    <Panel title="Available study time" id="availability" description="Used to warn about overloaded days and to suggest work that fits. Leave off if you’d rather not say.">
      <div className="flex flex-col gap-4 px-4 py-4">
        <Checkbox checked={!!a} onChange={(on) => update({ availability: on ? DEFAULT_AVAILABILITY : null })} label="Plan around the time I have each day" />
        {a ? (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {WEEKDAYS.map((d) => (
              <Field key={d} label={DAY_LABEL[d]}>
                {(p) => (
                  <Select {...p} value={a[d]} onChange={(e) => update({ availability: { ...a, [d]: Number(e.target.value) } })}>
                    {[0, 30, 60, 90, 120, 180, 240, 300, 360, 480].map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? 'None' : formatMinutes(m)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg-3">Not set. CampusFlow won’t assume how much free time you have; it will use the overload threshold below instead.</p>
        )}
      </div>
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
    <Panel title="Canvas" id="canvas" description="Read-only. CampusFlow never submits work, changes grades, or messages anyone.">
      <div className="flex flex-col gap-4 px-4 py-4" data-testid="canvas-status">
        {connected ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <Badge tone="success">Connected</Badge>
              {prefs.canvasUser} · {prefs.canvasHost}
            </p>
            {prefs.lastCanvasSyncAt && <p className="text-xs text-fg-3">Last synced {format(new Date(prefs.lastCanvasSyncAt), 'MMM d, h:mm a')} · syncs automatically while CampusFlow is open</p>}
            <div className="flex flex-wrap gap-2">
              <Button icon={RefreshCw} disabled={syncing} className={syncing ? '[&_svg]:animate-spin' : ''} onClick={() => void syncCanvas()}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
              <Button variant="ghost" onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
              <Badge tone={prefs.dataMode === 'demo' ? 'accent' : 'neutral'}>{prefs.dataMode === 'demo' ? 'Demo mode — not connected' : 'Not connected'}</Badge>
            </p>
            <p className="text-sm text-fg-2">Connect once and your classes, assignments, due dates and grades come in automatically.</p>
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
        <p className="flex items-start gap-2 text-xs text-fg-3">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Your Canvas sign-in is kept on the CampusFlow server, encrypted, never in this browser. CampusFlow never asks for your Canvas password.
        </p>
      </div>
    </Panel>
  )
}

function AssistantPanel() {
  const prefs = useStore((s) => s.prefs)
  const update = useStore((s) => s.updatePrefs)
  return (
    <Panel title="Planning assistant" id="assistant">
      <div className="flex flex-col gap-3 px-4 py-4 text-sm">
        <p className="flex items-center gap-2">
          <Sparkles className="size-4 text-fg-3" aria-hidden />
          <span className="font-medium">Rule-based templates</span>
          <Badge>Active</Badge>
          <Badge tone="outline">AI not configured</Badge>
        </p>
        <p className="text-xs text-fg-2">
          “Break into steps” and “What to work on next” use transparent rules that run in your browser. No AI service is connected, and nothing about your coursework leaves this device. An AI-backed assistant can be added later through the planning assistant interface (see README).
        </p>
        <Checkbox checked={prefs.aiConsent} onChange={(v) => update({ aiConsent: v })} label="If an AI assistant is enabled in the future, I allow sending assignment text I choose to it." />
      </div>
    </Panel>
  )
}

function DataPanel() {
  const state = useStore()
  const resetDemo = useStore((s) => s.resetDemoData)
  const startEmpty = useStore((s) => s.startEmpty)
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: 'CampusFlow', version: 1, data: selectData(state), prefs: state.prefs }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campusflow-export-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('Export downloaded')
  }
  let bytes = 0
  try {
    bytes = localStorage.getItem(STORAGE_KEY)?.length ?? 0
  } catch {
    /* unavailable */
  }
  return (
    <Panel title="Data & storage" id="data">
      <div className="flex flex-col gap-4 px-4 py-4 text-sm">
        <p className="text-xs text-fg-2">
          Everything is stored locally in this browser ({(bytes / 1024).toFixed(0)} KB). It is not synced between devices and is lost if you clear site data, so export a backup now and then. Attached files are stored in this browser’s IndexedDB.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={exportData}>
            Export JSON backup
          </Button>
          <Button
            icon={RotateCcw}
            onClick={async () => {
              if (await confirm({ title: 'Load fresh demo data?', message: 'This replaces everything in CampusFlow with the sample semester. Export first if you want to keep your data.', confirmLabel: 'Load demo data' })) {
                resetDemo()
                toast('Demo data loaded')
              }
            }}
          >
            {state.prefs.dataMode === 'demo' ? 'Reset demo data' : 'Load demo data'}
          </Button>
          <Button
            variant="ghost"
            icon={Trash2}
            className="text-danger hover:text-danger"
            onClick={async () => {
              if (await confirm({ title: 'Start with an empty workspace?', message: 'All courses, assignments, tasks, notes and grades in this browser will be deleted. Preferences are kept.', confirmLabel: 'Delete everything' })) {
                startEmpty()
                toast('Workspace cleared — add your first course to begin')
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
