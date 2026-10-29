import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Flame, LifeBuoy, Sparkles } from 'lucide-react'
import { badgeDef, levelTitle } from '@/domain/game'
import { petStage } from '@/domain/pet'
import { useStore } from '@/store/appStore'
import { PetArt } from '@/components/game/Pet'
import { AnimatedNumber, BadgeIcon, LevelBadge } from '@/components/game/GameUI'
import { Button } from '@/components/ui/Button'
import { cannons, haptic, sfx, starShower, burst } from './fx'
import { useCelebrations, type Celebration } from './celebrations'

/** Full-screen reward moments, shown one at a time from the queue. */
export function Celebrations() {
  const current = useCelebrations((s) => s.queue[0])
  const next = useCelebrations((s) => s.next)
  const button = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => button.current?.focus(), 400)
    if (current.kind === 'quest') {
      sfx.quest()
      haptic([30, 50, 30, 50, 80])
      setTimeout(cannons, 250)
    } else if (current.kind === 'rescue') {
      sfx.quest()
      haptic([30, 50, 30, 50, 80])
      setTimeout(cannons, 250)
      setTimeout(starShower, 600)
    } else if (current.kind === 'level') {
      sfx.levelUp()
      haptic([40, 60, 40, 60, 120])
      setTimeout(cannons, 150)
      setTimeout(starShower, 500)
    } else {
      sfx.badge()
      haptic([20, 40, 20])
      setTimeout(() => burst(document.getElementById('celebration-icon'), 'medium'), 350)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && next()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [current, next])

  return (
    <AnimatePresence mode="wait">
      {current && (
        <motion.div
          key={JSON.stringify(current)}
          className="fixed inset-0 z-[80] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && next()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="celebration-title"
        >
          <motion.div
            className="relative w-full max-w-md rounded-[32px] bg-surface px-7 pt-20 pb-7 text-center shadow-lg"
            initial={reduce ? { opacity: 0 } : { scale: 0.6, y: 60, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.8, y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <Hero c={current} />
            <Body c={current} />
            <Button ref={button} variant="primary" size="lg" className="mt-6 w-full" onClick={next}>
              {current.kind === 'badge' ? 'Nice!' : 'Keep going'}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Rays() {
  return (
    <motion.div
      aria-hidden
      className="absolute top-1/2 left-1/2 -z-10 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
      style={{ background: 'repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--gold) 45%, transparent) 0deg 12deg, transparent 12deg 30deg)', maskImage: 'radial-gradient(circle, black 30%, transparent 70%)' }}
      animate={{ rotate: 360 }}
      transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
    />
  )
}

function Hero({ c }: { c: Celebration }) {
  return (
    <div id="celebration-icon" className="absolute -top-16 left-1/2 -translate-x-1/2">
      <Rays />
      <motion.div
        initial={{ y: -160, rotate: -30, scale: 0.3 }}
        animate={{ y: 0, rotate: c.kind === 'level' ? -6 : 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.1 }}
      >
        {c.kind === 'level' && <LevelBadge level={c.level} size="xl" className="shadow-[0_0_0_10px_var(--surface)]" />}
        {c.kind === 'rescue' && (
          <span className="btn-3d grid size-32 place-items-center rounded-[40px] bg-success-bright text-white shadow-[0_0_0_10px_var(--surface)] [--press:var(--success-press)]">
            <LifeBuoy className="size-16" aria-hidden />
          </span>
        )}
        {c.kind === 'quest' && (
          <span className="btn-3d grid size-32 place-items-center rounded-[40px] bg-fire text-white shadow-[0_0_0_10px_var(--surface)] [--press:#d9480f]">
            <Flame className="flicker size-16 fill-white" aria-hidden />
          </span>
        )}
        {c.kind === 'badge' && (
          <motion.div animate={{ rotateY: [0, 360] }} transition={{ duration: 0.9, delay: 0.3 }} className="rounded-[28px] shadow-[0_0_0_10px_var(--surface)]">
            <BadgeIcon id={c.id} size="lg" />
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

function Body({ c }: { c: Celebration }) {
  const pet = useStore((s) => s.prefs.pet)
  const grew = c.kind === 'level' && petStage(c.level).stage !== petStage(c.level - 1).stage ? petStage(c.level).stage : null
  const pop = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } }
  if (c.kind === 'quest')
    return (
      <>
        <motion.h2 id="celebration-title" {...pop} transition={{ delay: 0.25 }} className="mt-14 text-3xl font-black text-fire">
          Quest complete!
        </motion.h2>
        <motion.p {...pop} transition={{ delay: 0.35 }} className="mt-1 text-base font-bold text-fg-2">
          Today is a gold day. Your streak is safe.
        </motion.p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Stat delay={0.45} label="streak" tone="text-fire">
            <AnimatedNumber value={c.streak} /> {c.streak === 1 ? 'day' : 'days'}
          </Stat>
          <Stat delay={0.55} label="bonus XP" tone="text-gold-text">
            +<AnimatedNumber value={c.bonus} />
          </Stat>
        </div>
      </>
    )
  if (c.kind === 'rescue')
    return (
      <>
        <motion.h2 id="celebration-title" {...pop} transition={{ delay: 0.25 }} className="mt-14 text-3xl font-black text-success">
          Rescue complete!
        </motion.h2>
        <motion.p {...pop} transition={{ delay: 0.35 }} className="mt-1 text-base font-bold text-fg-2">
          You caught up on all your late work. Your pet is so proud.
        </motion.p>
        <div className="mt-5 grid grid-cols-1 gap-3">
          <Stat delay={0.45} label="rescue bonus XP" tone="text-gold-text">
            +<AnimatedNumber value={c.bonus} />
          </Stat>
        </div>
      </>
    )
  if (c.kind === 'level')
    return (
      <>
        <motion.h2 id="celebration-title" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 10, delay: 0.3 }} className="mt-20 text-4xl font-black text-accent-text">
          Level up!
        </motion.h2>
        <motion.p {...pop} transition={{ delay: 0.45 }} className="mt-1 text-base font-bold text-fg-2">
          You’re now level {c.level}: <span className="font-black text-fg">{levelTitle(c.level)}</span>
        </motion.p>
        {pet && grew ? (
          <motion.div {...pop} transition={{ delay: 0.6 }} className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-success-soft px-3 py-2">
            <PetArt species={pet.species} stage={grew} size={56} />
            <span className="text-sm font-black text-success">
              {pet.name} grew into a {petStage(c.level).label}!
            </span>
          </motion.div>
        ) : (
          <motion.p {...pop} transition={{ delay: 0.6 }} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-sm font-black text-gold-text">
            <Sparkles className="size-4" aria-hidden /> New title unlocked
          </motion.p>
        )}
      </>
    )
  const def = badgeDef(c.id)
  return (
    <>
      <motion.p {...pop} transition={{ delay: 0.2 }} className="mt-10 text-xs font-black tracking-[0.14em] text-fg-3 uppercase">
        Badge unlocked
      </motion.p>
      <motion.h2 id="celebration-title" {...pop} transition={{ delay: 0.3 }} className="text-3xl font-black">
        {def.name}
      </motion.h2>
      <motion.p {...pop} transition={{ delay: 0.4 }} className="mt-1 font-bold text-fg-2">
        {def.description}
      </motion.p>
    </>
  )
}

function Stat({ children, label, tone, delay }: { children: React.ReactNode; label: string; tone: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', delay, stiffness: 300, damping: 14 }} className="card-3d px-3 py-3">
      <b className={`tabular block text-2xl font-black ${tone}`}>{children}</b>
      <span className="text-xs font-extrabold text-fg-3">{label}</span>
    </motion.div>
  )
}
