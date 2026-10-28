import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { format, subDays } from 'date-fns'
import { ChevronRight, Flame, GraduationCap, Settings, Star, Trophy } from 'lucide-react'
import { BADGES, completionsOn, isGoldDay, xpOn } from '@/domain/game'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { AnimatedNumber, BadgeIcon, LevelBadge, ProgressBar, useStreak, useXp } from '@/components/game/GameUI'
import { Page, usePageTitle } from '@/components/Page'
import { cn } from '@/components/ui/cn'

export function Me() {
  usePageTitle('Me')
  const now = useNow()
  const name = useStore((s) => s.prefs.displayName)
  const goal = useStore((s) => s.prefs.dailyGoal)
  const events = useStore((s) => s.xpEvents)
  const earned = useStore((s) => s.badges)
  const { total, level, title, into, needed, progress } = useXp()
  const { days } = useStreak(now)
  const week = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i))
  const xpWeek = week.map((d) => xpOn(events, d))
  const max = Math.max(50, ...xpWeek)
  const completed = events.filter((e) => e.kind === 'assignment' || e.kind === 'task').length
  const goldDays = Array.from({ length: 30 }, (_, i) => subDays(now, i)).filter((d) => isGoldDay(events, d, goal)).length
  const earnedIds = new Map(earned.map((b) => [b.id, b.at]))

  return (
    <Page className="max-w-4xl">
      <section className="card-3d flex flex-col items-center gap-5 p-6 sm:flex-row sm:p-7">
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
          <LevelBadge level={level} size="lg" />
        </motion.div>
        <div className="w-full min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-3xl font-black">{name || 'Student'}</h1>
          <p className="font-extrabold text-accent-text">
            Level {level} · {title}
          </p>
          <ProgressBar value={progress} height="h-4" className="mt-3" label="Progress to next level" />
          <p className="tabular mt-1.5 text-sm font-bold text-fg-3">
            {into} / {needed} XP to level {level + 1}
          </p>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Star className="size-5 fill-gold text-gold" aria-hidden />} label="Total XP" delay={0}>
          <AnimatedNumber value={total} />
        </Stat>
        <Stat icon={<Flame className="flicker size-5 fill-fire text-fire" aria-hidden />} label="Day streak" delay={0.05}>
          <AnimatedNumber value={days} />
        </Stat>
        <Stat icon={<Trophy className="size-5 text-success" aria-hidden />} label="Things finished" delay={0.1}>
          <AnimatedNumber value={completed} />
        </Stat>
        <Stat icon={<span className="size-5 rounded-full bg-gold shadow-[inset_0_-2px_0_var(--gold-press)]" aria-hidden />} label="Gold days (30d)" delay={0.15}>
          <AnimatedNumber value={goldDays} />
        </Stat>
      </div>

      <section className="card-3d mt-4 p-5" aria-labelledby="week-xp">
        <h2 id="week-xp" className="text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
          XP this week
        </h2>
        <div className="mt-4 flex h-36 items-end gap-2 sm:gap-4">
          {week.map((d, i) => {
            const gold = isGoldDay(events, d, goal)
            return (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${format(d, 'EEE MMM d')}: ${xpWeek[i]} XP, ${completionsOn(events, d)} finished`}>
                <span className="tabular text-xs font-black text-fg-2">{xpWeek[i] || ''}</span>
                <motion.span
                  className={cn('w-full max-w-12 rounded-t-xl shadow-[inset_0_-4px_0_rgb(0_0_0/0.15)]', gold ? 'bg-gold' : 'bg-accent/70')}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (xpWeek[i] / max) * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 15, delay: 0.1 + i * 0.06 }}
                />
                <span className={cn('text-xs font-black', i === 6 ? 'text-accent-text' : 'text-fg-3')}>{format(d, 'EEE')}</span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs font-bold text-fg-3">Gold bars are gold days, when you finished your daily quest of {goal}.</p>
      </section>

      <section className="mt-6" aria-labelledby="badges-title">
        <h2 id="badges-title" className="mb-3 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
          Badges · {earned.length} of {BADGES.length}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {BADGES.map((b, i) => {
            const at = earnedIds.get(b.id)
            return (
              <motion.li
                key={b.id}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4, rotate: at ? -2 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 + i * 0.04 }}
                className={cn('card-3d flex flex-col items-center gap-2 px-3 py-4 text-center', !at && 'opacity-70')}
              >
                <BadgeIcon id={b.id} earned={!!at} />
                <span className="text-sm leading-tight font-black">{b.name}</span>
                <span className="text-xs leading-tight font-bold text-fg-3">{at ? `Earned ${format(new Date(at), 'MMM d')}` : b.description}</span>
              </motion.li>
            )
          })}
        </ul>
      </section>

      <nav className="mt-6 flex flex-col gap-2" aria-label="More">
        <MoreLink to="/grades" icon={<GraduationCap className="size-5" aria-hidden />} label="Grades" hint="Estimates from your scores" />
        <MoreLink to="/settings" icon={<Settings className="size-5" aria-hidden />} label="Settings" hint="Daily goal, sound, Canvas, data" />
      </nav>
    </Page>
  )
}

function Stat({ icon, label, children, delay }: { icon: React.ReactNode; label: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }} className="card-3d flex flex-col gap-1 p-4">
      {icon}
      <span className="tabular text-2xl font-black">{children}</span>
      <span className="text-xs font-extrabold text-fg-3">{label}</span>
    </motion.div>
  )
}

function MoreLink({ to, icon, label, hint }: { to: string; icon: React.ReactNode; label: string; hint: string }) {
  return (
    <Link to={to} className="card-3d flex items-center gap-3 px-4 py-3.5 transition-transform hover:-translate-y-0.5">
      <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-text">{icon}</span>
      <span className="flex-1">
        <span className="block font-black">{label}</span>
        <span className="text-sm font-bold text-fg-3">{hint}</span>
      </span>
      <ChevronRight className="size-5 text-fg-3" aria-hidden />
    </Link>
  )
}
