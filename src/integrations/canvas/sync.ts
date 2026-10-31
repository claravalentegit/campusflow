import { useEffect } from 'react'
import { create } from 'zustand'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { sfx } from '@/game/fx'
import { canvasApi, CanvasError } from './adapter'
import { tr } from '@/i18n/core'

interface SyncState {
  syncing: boolean
  error: string | null
  needsReconnect: boolean
}

export const useCanvasSync = create<SyncState>(() => ({ syncing: false, error: null, needsReconnect: false }))

let navigate: (to: string) => void = (to) => window.location.assign(to)
/** The app shell registers the router so toasts can link to the Connect page. */
export function setSyncNavigator(fn: (to: string) => void) {
  navigate = fn
}

export interface SyncResult {
  courses: number
  assignments: number
  submissions: number
}

/**
 * Pull everything from Canvas through the CampusFlow server and merge it in. Student-owned fields
 * are never overwritten. Work newly turned in on Canvas goes on the list to cross off for XP.
 */
export async function syncCanvas(opts: { silent?: boolean; account?: { userName: string; baseHost: string } } = {}): Promise<SyncResult | null> {
  if (useCanvasSync.getState().syncing) return null
  useCanvasSync.setState({ syncing: true, error: null })
  try {
    const mapped = await canvasApi.fetchData()
    const prefs = useStore.getState().prefs
    const account = opts.account ?? { userName: prefs.canvasUser ?? 'Canvas user', baseHost: prefs.canvasHost ?? '' }
    const { turnedIn, courses, assignments } = useStore.getState().applyCanvasSync(mapped, account)
    useCanvasSync.setState({ syncing: false, needsReconnect: false })
    // Newly turned-in work opens the "Good job!" list (see TurnedInDialog), where it's crossed off for XP.
    if (turnedIn.length) sfx.quest()
    else if (!opts.silent) {
      sfx.tap()
      toast(tr('Synced with Canvas'), 'success')
    }
    return { courses, assignments, submissions: turnedIn.length }
  } catch (e) {
    const err = e as CanvasError
    const needsReconnect = err.status === 401
    useCanvasSync.setState({ syncing: false, error: err.message, needsReconnect })
    if (needsReconnect) toast(tr('Your Canvas sign-in expired. Reconnect to keep syncing.'), 'error', { label: tr('Reconnect'), run: () => navigate('/connect') })
    else if (!opts.silent) toast(err.message || tr('Canvas sync failed.'), 'error')
    return null
  }
}

const AUTO_MS = 30 * 60_000
const STALE_MS = 10 * 60_000

/** While connected: sync on open, every 30 minutes, and when you come back to the tab. */
export function useCanvasAutoSync() {
  const mode = useStore((s) => s.prefs.dataMode)
  useEffect(() => {
    if (mode !== 'canvas') return
    const maybeSync = () => {
      const last = useStore.getState().prefs.lastCanvasSyncAt
      if (!last || Date.now() - new Date(last).getTime() > STALE_MS) void syncCanvas({ silent: true })
    }
    maybeSync()
    const id = setInterval(() => void syncCanvas({ silent: true }), AUTO_MS)
    const onVisible = () => document.visibilityState === 'visible' && maybeSync()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [mode])
}
