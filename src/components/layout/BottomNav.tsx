import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { useUi } from '@/store/ui'
import { cn } from '../ui/cn'
import { NAV_ITEMS, type NavItem } from './nav'
import { useT } from '@/i18n'

function Tab({ item }: { item: NavItem }) {
  const t = useT()
  return (
    <NavLink to={item.to} end={item.end} data-sfx="swish" className={({ isActive }) => cn('relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-black', isActive ? 'text-accent-text' : 'text-fg-3')}>
      {({ isActive }) => (
        <>
          <motion.span animate={isActive ? { y: -2, scale: 1.12 } : { y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
            <item.icon className="size-6" strokeWidth={2.4} aria-hidden />
          </motion.span>
          {t(item.label)}
          {isActive && <motion.span layoutId="tab-dot" className="absolute top-1 h-1 w-6 rounded-full bg-accent" />}
        </>
      )}
    </NavLink>
  )
}

/** Phone tab bar: Today · Plan · + · Courses · Me. */
export function BottomNav() {
  const openQuickAdd = useUi((s) => s.openQuickAdd)
  const [today, plan, courses, me] = NAV_ITEMS
  const t = useT()
  return (
    <nav aria-label={t('Tabs')} className="fixed inset-x-0 bottom-0 z-30 flex h-[76px] border-t-2 border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <Tab item={today} />
      <Tab item={plan} />
      <div className="flex flex-1 items-center justify-center">
        <motion.button whileTap={{ scale: 0.85, rotate: 90 }} type="button" data-sfx="pop" aria-label={t('Add')} onClick={() => openQuickAdd()} className="btn-3d -mt-5 grid size-14 place-items-center rounded-2xl bg-accent text-white [--press:var(--accent-press)]">
          <Plus className="size-7" strokeWidth={3} aria-hidden />
        </motion.button>
      </div>
      <Tab item={courses} />
      <Tab item={me} />
    </nav>
  )
}
