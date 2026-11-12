import { useEffect } from 'react'
import { create } from 'zustand'
import type { AppData, Preferences } from '@/domain/types'
import { selectData, useStore } from '@/store/appStore'
import { call, CanvasError } from './canvas/adapter'
import { syncCanvas } from './canvas/sync'

/**
 * Your CampusFlow account: the same progress on every device.
 * The account is your Canvas account (see server/account.ts). This keeps the app's data saved there:
 * changes are saved a few seconds after they happen, and another device's changes are loaded when
 * you come back to the app. If two devices changed things at the same time, they're merged.
 */

/** Settings that belong to this device, not the account. */
const DEVICE_PREFS = ['dataMode', 'lastCanvasSyncAt', 'onboarded', 'familyGoals', 'account', 'sidebarCompact'] as const
type DevicePref = (typeof DEVICE_PREFS)[number]
type SyncedPrefs = Omit<Preferences, DevicePref>

export interface AccountData {
  v: 1
  data: AppData
  prefs: SyncedPrefs
}

export interface AccountInfo {
  signedIn: boolean
  userName?: string
  baseHost?: string
  rev?: number
  updatedAt?: string | null
  /** "memory" means the server forgets saved data when it restarts (no database yet). */
  storage?: 'postgres' | 'file' | 'memory'
}

interface Saved {
  rev: number
  updatedAt: string | null
  data: AccountData | null
}

export const accountApi = {
  info: () => call<AccountInfo>('/api/account'),
  load: () => call<Saved>('/api/account/data'),
  save: (baseRev: number, data: AccountData) => call<{ rev: number; updatedAt: string }>('/api/account/data', { method: 'POST', body: JSON.stringify({ baseRev, data }) }),
  deviceCode: () => call<{ code: string; expiresAt: number }>('/api/account/device-code', { method: 'POST', body: '{}' }),
  deviceLink: (code: string) => call<{ userName: string; baseHost: string }>('/api/account/device-link', { method: 'POST', body: JSON.stringify({ code }) }),
}

export const useAccountSync = create<{ state: 'idle' | 'saving' | 'saved' | 'error'; savedAt: string | null; error: string | null }>(() => ({ state: 'idle', savedAt: null, error: null }))

function syncedPrefs(p: Preferences): SyncedPrefs {
  const out: Record<string, unknown> = { ...p }
  for (const k of DEVICE_PREFS) delete out[k]
  return out as SyncedPrefs
}

export function buildAccountData(s = useStore.getState()): AccountData {
  return { v: 1, data: selectData(s), prefs: syncedPrefs(s.prefs) }
}

const byId = <T extends { id: string }>(remote: T[] = [], local: T[] = []): T[] => {
  const m = new Map(remote.map((x) => [x.id, x]))
  for (const x of local) m.set(x.id, x)
  return [...m.values()]
}

/**
 * Both devices changed things: keep everything from both. On the same record this device wins.
 * Lists of things that only grow (XP, badges, skips…) are combined.
 */
export function mergeAccountData(remote: AccountData, local: AccountData): AccountData {
  const r = remote.data
  const l = local.data
  const data: AppData = {
    courses: byId(r.courses, l.courses),
    announcements: byId(r.announcements, l.announcements),
    modules: byId(r.modules, l.modules),
    assignments: byId(r.assignments, l.assignments),
    tasks: byId(r.tasks, l.tasks),
    sessions: byId(r.sessions, l.sessions),
    events: byId(r.events, l.events),
    reminders: byId(r.reminders, l.reminders),
    notes: byId(r.notes, l.notes),
    resources: byId(r.resources, l.resources),
    grades: byId(r.grades, l.grades),
    dismissedNotificationIds: [...new Set([...(r.dismissedNotificationIds ?? []), ...(l.dismissedNotificationIds ?? [])])],
    xpEvents: byId(r.xpEvents, l.xpEvents).sort((a, b) => a.at.localeCompare(b.at)),
    badges: [...new Map([...(r.badges ?? []), ...(l.badges ?? [])].map((b) => [b.id, b])).values()],
  }
  const rp = remote.prefs
  const lp = local.prefs
  const prefs: SyncedPrefs = {
    ...rp,
    ...lp,
    skipped: byId(rp.skipped, lp.skipped),
    planDone: byId(rp.planDone, lp.planDone),
    toClaim: byId(rp.toClaim, lp.toClaim),
    goalsCelebrated: [...new Set([...(rp.goalsCelebrated ?? []), ...(lp.goalsCelebrated ?? [])])],
    lastSeenLevel: Math.max(rp.lastSeenLevel ?? 1, lp.lastSeenLevel ?? 1),
    pet: lp.pet ?? rp.pet,
  }
  return { v: 1, data, prefs }
}

/** True when this device has its own progress worth keeping (not just freshly imported Canvas data). */
const hasProgress = (s = useStore.getState()) => s.xpEvents.length > 0 || !!s.prefs.pet || s.tasks.length > 0

let applying = false
let timer: ReturnType<typeof setTimeout> | undefined

function apply(d: AccountData, rev: number, savedAt: string | null, dirty: boolean) {
  applying = true
  useStore.setState((s) => ({ ...d.data, prefs: { ...s.prefs, ...d.prefs, account: { rev, savedAt, dirty } } }))
  applying = false
}

async function push(retry = true): Promise<void> {
  const s = useStore.getState()
  useAccountSync.setState({ state: 'saving', error: null })
  try {
    const r = await accountApi.save(s.prefs.account.rev, buildAccountData(s))
    applying = true
    useStore.setState((st) => ({ prefs: { ...st.prefs, account: { rev: r.rev, savedAt: r.updatedAt, dirty: false } } }))
    applying = false
    useAccountSync.setState({ state: 'saved', savedAt: r.updatedAt })
  } catch (e) {
    const err = e as CanvasError
    if (err.status === 409 && retry) {
      // Another device saved first: combine both, then save again.
      const remote = await accountApi.load()
      if (remote.data) apply(mergeAccountData(remote.data, buildAccountData()), remote.rev, remote.updatedAt, true)
      return push(false)
    }
    useAccountSync.setState({ state: 'error', error: err.message })
  }
}

/** Load the account: take it as is on a new device, merge if this device changed things too. */
/** `adopt`: take the account as is (a device just signed in with a code). */
export async function pullAccount(opts: { adopt?: boolean } = {}): Promise<'adopted' | 'merged' | 'pushed' | 'same' | 'offline' | 'empty'> {
  let remote: Saved
  try {
    remote = await accountApi.load()
  } catch {
    return 'offline'
  }
  const local = useStore.getState().prefs.account
  if (!remote.data) {
    if (opts.adopt) return 'empty'
    await push()
    return 'pushed'
  }
  if (remote.rev === local.rev) {
    useAccountSync.setState({ state: 'saved', savedAt: remote.updatedAt })
    if (local.dirty) await push()
    return 'same'
  }
  if (opts.adopt || (!local.dirty && (local.rev > 0 || !hasProgress()))) {
    apply(remote.data, remote.rev, remote.updatedAt, false)
    useAccountSync.setState({ state: 'saved', savedAt: remote.updatedAt })
    return 'adopted'
  }
  apply(mergeAccountData(remote.data, buildAccountData()), remote.rev, remote.updatedAt, true)
  await push()
  return 'merged'
}

/** Keep the account up to date while connected to Canvas. */
export function useAccountAutoSync() {
  const on = useStore((s) => s.prefs.dataMode === 'canvas')
  useEffect(() => {
    if (!on) return
    // On a device that just loaded the account, refresh from Canvas too.
    void pullAccount().then((r) => r === 'adopted' && void syncCanvas({ silent: true }))
    const unsub = useStore.subscribe((s, prev) => {
      if (applying) return
      const changed =
        (Object.keys(selectData(s)) as Array<keyof AppData>).some((k) => s[k] !== prev[k]) ||
        (Object.keys(s.prefs) as Array<keyof Preferences>).some((k) => !(DEVICE_PREFS as readonly string[]).includes(k) && s.prefs[k] !== prev.prefs[k])
      if (!changed) return
      if (!s.prefs.account.dirty) {
        applying = true
        useStore.setState((st) => ({ prefs: { ...st.prefs, account: { ...st.prefs.account, dirty: true } } }))
        applying = false
      }
      clearTimeout(timer)
      timer = setTimeout(() => void push(), 4000)
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pullAccount()
      else if (useStore.getState().prefs.account.dirty) {
        clearTimeout(timer)
        void push()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsub()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [on])
}
