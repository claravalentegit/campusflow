import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Flame, Repeat, Star, Trophy } from 'lucide-react'
import { BADGES } from '@/domain/game'
import { petMood, petStage } from '@/domain/pet'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { AnimatedNumber, BadgeIcon, ProgressBar, useStreak, useXp } from '@/components/game/GameUI'
import { Pet } from '@/components/game/Pet'
import { PetPicker } from '@/components/game/PetCard'
import { FamilyPanel } from '@/components/FamilyPanel'
import { SettingsSections } from '@/components/SettingsSections'
import { Page, usePageTitle } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { cn } from '@/components/ui/cn'
import { fmtDate, useT } from '@/i18n'

export function Me() {
  const t = useT()
  usePageTitle(t('Me'))
  const now = useNow()
  const name = useStore((s) => s.prefs.displayName)
  const pet = useStore((s) => s.prefs.pet)
  const update = useStore((s) => s.updatePrefs)
  const events = useStore((s) => s.xpEvents)
  const assignments = useStore((s) => s.assignments)
  const earned = useStore((s) => s.badges)
  const { total, level, title, into, needed, progress } = useXp()
  const { days } = useStreak(now)
  const [changing, setChanging] = useState(false)
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }), 50)
  }, [hash])

  const completed = events.filter((e) => e.kind === 'assignment' || e.kind === 'task').length
  const earnedIds = new Map(earned.map((b) => [b.id, b.at]))
  const stage = petStage(level)

  return (
    <Page className="max-w-3xl">
      <section className="card-3d relative overflow-hidden p-5 sm:p-6">
        <span aria-hidden className="pointer-events-none absolute -top-14 -right-14 size-48 rounded-full bg-accent-soft" />
        <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          {pet ? (
            <div className="flex flex-col items-center">
              <Pet species={pet.species} mood={petMood(assignments, events, now).mood} stage={stage.stage} size={140} label={t('{name}, your pet. Tap to say hi.', { name: pet.name })} />
              <p className="text-base font-black">{pet.name}</p>
              <p className="text-xs font-bold text-fg-3">{t(stage.label)}{stage.next ? ` · ${t('{stage} at Level {n}', { stage: t(stage.next.label), n: stage.next.at })}` : ''}</p>
            </div>
          ) : null}
          <div className="w-full min-w-0 flex-1">
            <label htmlFor="display-name" className="text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
              {t('Your name')}
            </label>
            <Input id="display-name" value={name} maxLength={40} onChange={(e) => update({ displayName: e.target.value })} className="mt-1 h-12 text-lg font-black" placeholder={t('What should we call you?')} />
            <p className="mt-3 text-sm font-extrabold text-accent-text">
              {t('Level {n}', { n: level })} · {t(title)}
            </p>
            <ProgressBar value={progress} height="h-3.5" className="mt-1.5" label={t('Progress to next level')} />
            <p className="tabular mt-1 text-xs font-bold text-fg-3">
              {t('{into} / {needed} XP to level {n}', { into, needed, n: level + 1 })}
            </p>
            {pet && (
              <Button size="sm" variant="ghost" icon={Repeat} className="mt-2 -ml-2" aria-expanded={changing} data-sfx={changing ? 'close' : 'open'} onClick={() => setChanging((c) => !c)}>
                {changing ? t('Keep my pet') : t('Change or rename pet')}
              </Button>
            )}
          </div>
        </div>
        <AnimatePresence initial={false}>
          {(changing || !pet) && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative overflow-hidden">
              <div className="pt-4">
                <PetPicker compact={!!pet} onDone={() => setChanging(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat icon={<Star className="size-5 fill-gold text-gold" aria-hidden />} label={t('Total XP')} delay={0}>
          <AnimatedNumber value={total} />
        </Stat>
        <Stat icon={<Flame className="flicker size-5 fill-fire text-fire" aria-hidden />} label={t('Day streak')} delay={0.05}>
          <AnimatedNumber value={days} />
        </Stat>
        <Stat icon={<Trophy className="size-5 text-success" aria-hidden />} label={t('Finished')} delay={0.1}>
          <AnimatedNumber value={completed} />
        </Stat>
      </div>

      <section className="mt-6" aria-labelledby="badges-title">
        <h2 id="badges-title" className="mb-3 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
          {t('Badges · {n} of {total}', { n: earned.length, total: BADGES.length })}
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
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 + i * 0.03 }}
                className={cn('card-3d flex flex-col items-center gap-2 px-3 py-4 text-center', !at && 'opacity-70')}
              >
                <BadgeIcon id={b.id} earned={!!at} />
                <span className="text-sm leading-tight font-black">{t(b.name)}</span>
                <span className="text-xs leading-tight font-bold text-fg-3">{at ? t('Earned {date}', { date: fmtDate(new Date(at), 'MMM d') }) : t(b.description)}</span>
              </motion.li>
            )
          })}
        </ul>
      </section>

      <div className="mt-8">
        <FamilyPanel />
      </div>

      <div className="mt-8">
        <SettingsSections />
      </div>
    </Page>
  )
}

function Stat({ icon, label, children, delay }: { icon: React.ReactNode; label: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }} className="card-3d flex flex-col gap-1 p-3 sm:p-4">
      {icon}
      <span className="tabular text-xl font-black sm:text-2xl">{children}</span>
      <span className="text-xs font-extrabold text-fg-3">{label}</span>
    </motion.div>
  )
}
