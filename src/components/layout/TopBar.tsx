import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Keyboard, Moon, Plug, Plus, Search, Settings, Sun, UserRound } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { useUi } from '@/store/ui'
import { StreakPill, XpPill, useXp } from '../game/GameUI'
import { FocusPill } from '../overlays/Focus'
import { Button, IconButton } from '../ui/Button'
import { Menu } from '../ui/Menu'
import { cn } from '../ui/cn'
import { BrandMark } from './Brand'
import { NAV_ITEMS } from './nav'
import { useT } from '@/i18n'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
export const MOD_KEY = isMac ? '⌘' : 'Ctrl'

export function useThemeToggle() {
  const theme = useStore((s) => s.prefs.theme)
  const update = useStore((s) => s.updatePrefs)
  const isDark = theme === 'dark' || (theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)
  return { isDark, toggle: () => update({ theme: isDark ? 'light' : 'dark' }) }
}

export function TopBar() {
  const openQuickAdd = useUi((s) => s.openQuickAdd)
  const setPaletteOpen = useUi((s) => s.setPaletteOpen)
  const setShortcutsOpen = useUi((s) => s.setShortcutsOpen)
  const name = useStore((s) => s.prefs.displayName)
  const { level } = useXp()
  const navigate = useNavigate()
  const { isDark, toggle } = useThemeToggle()
  const t = useT()

  return (
    <header className="sticky top-0 z-30 border-b-2 border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5 text-lg font-black text-accent-text" aria-label={t('CampusFlow home')}>
          <BrandMark className="size-9 wiggle-hover" />
          <span className="max-sm:hidden">CampusFlow</span>
        </NavLink>
        <nav aria-label={t('Main')} className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} data-sfx="swish" className={({ isActive }) => cn('relative rounded-xl px-4 py-2 text-[15px] font-extrabold transition-colors', isActive ? 'text-accent-text' : 'text-fg-3 hover:text-fg')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-xl bg-accent-soft" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  {t(item.label)}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <FocusPill />
          <StreakPill />
          <XpPill />
          <IconButton icon={Search} label={`${t('Search')} (${MOD_KEY} K)`} className="max-md:hidden" onClick={() => setPaletteOpen(true)} />
          <Button variant="primary" icon={Plus} onClick={() => openQuickAdd()} className="max-sm:hidden" title={`${t('Add')} (C)`}>
            {t('Add')}
          </Button>
          <Menu
            className="max-sm:hidden"
            items={[
              { label: t('Me: level & badges'), icon: UserRound, onSelect: () => navigate('/me') },
              { label: t('Canvas connection'), icon: Plug, onSelect: () => navigate('/connect') },
              { label: t('Settings'), icon: Settings, onSelect: () => navigate('/me#settings') },
              'separator',
              { label: isDark ? t('Light theme') : t('Dark theme'), icon: isDark ? Sun : Moon, onSelect: toggle },
              { label: t('Keyboard shortcuts'), icon: Keyboard, hint: '?', onSelect: () => setShortcutsOpen(true) },
            ]}
            trigger={(p) => (
              <button type="button" {...p} aria-label={t('Profile menu')} className="relative grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#ffd56b] to-[#ff8a4c] text-sm font-black text-white ring-2 ring-gold ring-offset-2 ring-offset-surface transition-transform active:scale-90">
                {(name || 'S').slice(0, 1).toUpperCase()}
                <span className="absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-md bg-accent text-[10px] font-black text-white">{level}</span>
              </button>
            )}
          />
        </div>
      </div>
    </header>
  )
}
