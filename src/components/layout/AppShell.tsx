import { useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useShortcuts, type Shortcut } from '@/hooks/useShortcuts'
import { useStore } from '@/store/appStore'
import { useUi } from '@/store/ui'
import { Celebrations } from '@/game/Celebrations'
import { setSyncNavigator, useCanvasAutoSync } from '@/integrations/canvas/sync'
import { GameWatcher } from '@/game/GameWatcher'
import { BreakdownDialog } from '../overlays/BreakdownDialog'
import { CommandPalette } from '../overlays/CommandPalette'
import { EditorHost } from '../overlays/EditorHost'
import { FocusDialog, FocusWatcher } from '../overlays/Focus'
import { QuickAddDialog } from '../overlays/QuickAddDialog'
import { ConfirmHost } from '../ui/Dialog'
import { Toaster } from '../ui/Toaster'
import { BottomNav } from './BottomNav'
import { DATA_MODE_LABEL } from './nav'
import { ShortcutsDialog } from './ShortcutsDialog'
import { TopBar } from './TopBar'
import { installClickSounds } from '@/game/fx'
import { useFamilySync } from '@/integrations/family'
import { useT } from '@/i18n'

function useApplyTheme() {
  const theme = useStore((s) => s.prefs.theme)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#1b1729' : '#ffffff')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export function AppShell() {
  const { pathname } = useLocation()
  const mode = useStore((s) => s.prefs.dataMode)
  const onboarded = useStore((s) => s.prefs.onboarded)
  // First launch opens on the Canvas sign-in screen until the student connects or skips.
  const mustSignIn = !onboarded && mode !== 'canvas' && pathname !== '/connect'
  const bare = !onboarded && pathname === '/connect'
  useApplyTheme()
  const t = useT()
  const lang = useStore((s) => s.prefs.language)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  useCanvasAutoSync()
  useFamilySync()
  const navigate = useNavigate()
  useEffect(() => setSyncNavigator(navigate), [navigate])
  useEffect(() => installClickSounds(), [])
  useEffect(() => {
    if (mustSignIn) navigate('/connect', { replace: true })
  }, [mustSignIn, navigate])
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const shortcuts = useMemo<Shortcut[]>(() => {
    const ui = useUi.getState
    return [
      { key: 'k', mod: true, allowInInputs: true, run: () => ui().setPaletteOpen(!ui().paletteOpen) },
      { key: '/', run: () => ui().setPaletteOpen(true) },
      { key: 'c', run: () => ui().openQuickAdd() },
      { key: 'f', run: () => ui().setFocusDialogOpen(true) },
      { key: '?', run: () => ui().setShortcutsOpen(true) },
    ]
  }, [])
  useShortcuts(shortcuts)

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lg">
        {t('Skip to content')}
      </a>
      {!bare && <TopBar />}
      <motion.main key={pathname} id="main" tabIndex={-1} className="flex-1 outline-none max-sm:pb-24" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
        {mustSignIn ? null : <Outlet />}
      </motion.main>
      <footer hidden={bare} className="pb-6 text-center text-xs font-bold text-fg-3 max-sm:pb-24">
        {mode === 'demo' ? (
          <>
            {t('Demo data · not connected to Canvas')} ·{' '}
            <Link to="/connect" className="text-accent-text hover:underline">
              {t('Connect Canvas')}
            </Link>
          </>
        ) : (
          t(DATA_MODE_LABEL[mode])
        )}
      </footer>
      {!bare && <BottomNav />}
      <QuickAddDialog />
      <EditorHost />
      <BreakdownDialog />
      <CommandPalette />
      <FocusDialog />
      <FocusWatcher />
      <ShortcutsDialog />
      <ConfirmHost />
      <Toaster />
      <GameWatcher />
      <Celebrations />
    </div>
  )
}
