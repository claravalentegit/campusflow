import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { Brain, Crown, Flame, Footprints, Gem, Heart, Moon, Rocket, Star, Sunrise, Zap, type LucideIcon } from 'lucide-react'
import { badgeDef, levelFor, levelTitle, streak, totalXp, type BadgeDef, type BadgeId } from '@/domain/game'
import { useStore } from '@/store/appStore'
import { XP_TARGET_ID } from '@/game/fx'
import { cn } from '../ui/cn'

export function useXp() {
  const events = useStore((s) => s.xpEvents)
  const total = totalXp(events)
  return { total, ...levelFor(total), title: levelTitle(levelFor(total).level) }
}

export function useStreak(now = new Date()) {
  const events = useStore((s) => s.xpEvents)
  const goal = useStore((s) => s.prefs.dailyGoal)
  return streak(events, now, goal)
}

/** Counts up/down smoothly. With `delay` it waits for flying XP to land before rolling. */
export function AnimatedNumber({ value, delay = 0, format = (n: number) => Math.round(n).toLocaleString() }: { value: number; delay?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  const reduce = useReducedMotion()
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (!ref.current) return
    if (reduce || from === value) {
      ref.current.textContent = format(value)
      return
    }
    const controls = animate(from, value, {
      duration: 0.8,
      delay: value > from ? delay : 0,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v)
      },
    })
    return () => controls.stop()
  }, [value, delay, reduce, format])
  return <span ref={ref}>{format(value)}</span>
}

/** Bumps when flying XP arrives. */
function useArrivalBump() {
  const [bump, setBump] = useState(0)
  useEffect(() => {
    const on = () => setBump((b) => b + 1)
    window.addEventListener('xp:arrive', on)
    return () => window.removeEventListener('xp:arrive', on)
  }, [])
  return bump
}

export function XpPill({ className }: { className?: string }) {
  const { total } = useXp()
  const bump = useArrivalBump()
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!bump || !ref.current) return
    ref.current.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' })
    ref.current.querySelector('svg')?.animate([{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(144deg) scale(1.5)' }, { transform: 'rotate(144deg) scale(1)' }], { duration: 500, easing: 'ease-out' })
  }, [bump])
  return (
    <span ref={ref} id={XP_TARGET_ID} className={cn('tabular inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-gold/40 bg-gold-soft px-3 text-sm font-black text-gold-text', className)} title="Your total XP">
      <Star className="size-4 fill-gold text-gold" aria-hidden />
      <AnimatedNumber value={total} delay={0.75} />
      <span className="sr-only"> XP</span>
      <span aria-hidden className="max-sm:hidden">XP</span>
    </span>
  )
}

export function StreakPill({ className }: { className?: string }) {
  const { days, todayDone } = useStreak()
  return (
    <span className={cn('tabular inline-flex h-9 items-center gap-1 rounded-full border-2 px-3 text-sm font-black', todayDone ? 'border-fire/40 bg-fire-soft text-fire' : 'border-line bg-surface text-fg-3', className)} title={todayDone ? `${days}-day streak — today is done` : `${days}-day streak — finish today’s quest to keep it`}>
      <Flame className={cn('size-4.5', todayDone ? 'flicker fill-fire text-fire' : days ? 'fill-fire/30 text-fire' : '')} aria-hidden />
      <AnimatedNumber value={days} />
      <span className="sr-only">-day streak</span>
    </span>
  )
}

export function LevelBadge({ level, size = 'md', className }: { level: number; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const dims = { sm: 'size-8 text-sm rounded-lg', md: 'size-13 text-2xl rounded-2xl', lg: 'size-20 text-4xl rounded-3xl', xl: 'size-32 text-6xl rounded-[40px]' }[size]
  return (
    <span className={cn('btn-3d inline-grid shrink-0 place-items-center bg-gold font-black text-white [--press:var(--gold-press)] [text-shadow:0_2px_0_var(--gold-press)]', dims, className)} aria-label={`Level ${level}`}>
      {level}
    </span>
  )
}

/** Spring-animated progress bar with moving stripes while in progress. */
export function ProgressBar({ value, tone = 'gold', className, height = 'h-3.5', label }: { value: number; tone?: 'gold' | 'green' | 'purple' | 'fire'; className?: string; height?: string; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const color = { gold: 'bg-gold', green: 'bg-success-bright', purple: 'bg-accent', fire: 'bg-fire' }[tone]
  const track = { gold: 'bg-gold-soft', green: 'bg-success-soft', purple: 'bg-accent-soft', fire: 'bg-fire-soft' }[tone]
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={cn('overflow-hidden rounded-full', track, height, className)}>
      <motion.div
        className={cn('h-full rounded-full shadow-[inset_0_-3px_0_rgb(0_0_0/0.15)]', color, pct > 0 && pct < 100 && 'bar-stripes')}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      />
    </div>
  )
}

/** Progress ring for the daily quest. */
export function Ring({ value, size = 104, stroke = 12, children, track = 'rgb(255 255 255 / 0.25)', color = 'var(--gold)' }: { value: number; size?: number; stroke?: number; children?: ReactNode; track?: string; color?: string }) {
  const r = 50 - stroke / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ type: 'spring', stiffness: 90, damping: 16 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function XpChip({ amount, tone = 'gold', className }: { amount: number; tone?: 'gold' | 'purple' | 'muted'; className?: string }) {
  return (
    <span
      className={cn(
        'tabular inline-flex h-7 shrink-0 items-center rounded-full border-2 px-2.5 text-xs font-black whitespace-nowrap',
        tone === 'gold' && 'border-gold/40 bg-gold-soft text-gold-text',
        tone === 'purple' && 'border-accent/30 bg-accent-soft text-accent-text',
        tone === 'muted' && 'border-line bg-surface-2 text-fg-3',
        className,
      )}
    >
      +{amount} XP
    </span>
  )
}

/**
 * The satisfying checkbox: squash on press, pop + checkmark draw + ring burst on complete.
 * Calls onToggle with its own element so effects can start from it.
 */
export function CheckButton({ checked, onToggle, label, size = 'md', className }: { checked: boolean; onToggle: (el: HTMLElement) => void; label: string; size?: 'md' | 'lg'; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [burstKey, setBurstKey] = useState(0)
  const reduce = useReducedMotion()
  const dims = size === 'lg' ? 'size-10 rounded-xl' : 'size-8 rounded-[10px]'
  return (
    <motion.button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        if (!checked) setBurstKey((k) => k + 1)
        onToggle(ref.current as HTMLElement)
      }}
      whileHover={reduce ? undefined : { scale: 1.08 }}
      whileTap={reduce ? undefined : { scale: 0.8 }}
      animate={checked && !reduce ? { scale: [1, 1.3, 0.95, 1] } : { scale: 1 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative z-[1] grid shrink-0 place-items-center border-[3px] transition-colors before:absolute before:-inset-2 before:content-[""]',
        dims,
        checked ? 'border-success-bright bg-success-bright shadow-[inset_0_-3px_0_var(--success-press)]' : 'border-line-strong bg-surface hover:border-success-bright hover:bg-success-soft',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className={size === 'lg' ? 'size-6' : 'size-5'} aria-hidden>
        <motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }} transition={{ duration: 0.3, delay: checked ? 0.08 : 0 }} />
      </svg>
      {burstKey > 0 && !reduce && (
        <motion.span key={burstKey} aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] border-4 border-success-bright" initial={{ scale: 1, opacity: 0.9 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }} />
      )}
    </motion.button>
  )
}

const BADGE_ICON: Record<BadgeDef['icon'], LucideIcon> = { footprints: Footprints, sunrise: Sunrise, moon: Moon, rocket: Rocket, crown: Crown, heart: Heart, flame: Flame, zap: Zap, brain: Brain, gem: Gem }
const BADGE_COLOR: Record<BadgeDef['color'], string> = {
  gold: 'bg-gold [--press:var(--gold-press)]',
  purple: 'bg-accent [--press:var(--accent-press)]',
  fire: 'bg-fire [--press:#d9480f]',
  green: 'bg-success-bright [--press:var(--success-press)]',
  blue: 'bg-[#0ea5e9] [--press:#0369a1]',
  pink: 'bg-[#ec4899] [--press:#be185d]',
}

export function BadgeIcon({ id, earned = true, size = 'md' }: { id: BadgeId; earned?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const def = badgeDef(id)
  const Icon = BADGE_ICON[def.icon]
  const dims = { sm: 'size-9 rounded-xl', md: 'size-14 rounded-2xl', lg: 'size-24 rounded-[28px]' }[size]
  return (
    <span className={cn('btn-3d grid shrink-0 place-items-center text-white', dims, earned ? BADGE_COLOR[def.color] : 'bg-surface-3 text-fg-3 [--press:var(--line-strong)]')}>
      <Icon className={size === 'lg' ? 'size-11' : size === 'md' ? 'size-7' : 'size-4.5'} strokeWidth={2.5} aria-hidden />
    </span>
  )
}
