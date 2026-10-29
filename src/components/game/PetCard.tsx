import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Flame, Heart } from 'lucide-react'
import { completionsOn } from '@/domain/game'
import { PET_SPECIES, petLine, petMood, petStage, type PetSpecies } from '@/domain/pet'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { cannons, sfx } from '@/game/fx'
import { ProgressBar, useStreak, useXp } from '@/components/game/GameUI'
import { Pet, PetArt } from '@/components/game/Pet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { cn } from '@/components/ui/cn'

/** Today's top card: the pet, its mood, the daily quest as hearts, and level progress. */
export function PetCard() {
  const pet = useStore((s) => s.prefs.pet)
  const goal = useStore((s) => s.prefs.dailyGoal)
  const assignments = useStore((s) => s.assignments)
  const events = useStore((s) => s.xpEvents)
  const now = useNow(60_000)
  const { level, progress } = useXp()
  const { days } = useStreak(now)
  const filled = Math.min(completionsOn(events, now), goal)
  const prevFilled = useRef(filled)
  useEffect(() => {
    // A heart fills up a moment after the XP lands.
    if (filled > prevFilled.current) setTimeout(sfx.heart, 650)
    prevFilled.current = filled
  }, [filled])
  if (!pet) return <PetPicker />

  const { mood, late } = petMood(assignments, events, now)
  const stage = petStage(level)
  const line = stage.stage === 'egg' ? { title: `${pet.name} is about to hatch!`, text: 'Reach Level 2 and your egg hatches.' } : petLine(mood, pet.name, late)
  const done = completionsOn(events, now)
  const complete = done >= goal

  return (
    <section aria-label="Your pet" className={cn('card-3d relative flex items-center gap-4 overflow-hidden p-4 sm:gap-5 sm:p-5', mood === 'worried' ? 'bg-gradient-to-b from-danger-soft/50 to-surface' : 'bg-gradient-to-b from-accent-soft/60 to-surface')}>
      <Pet species={pet.species} mood={mood} stage={stage.stage} size={100} label={`${pet.name}, your pet. Tap to say hi.`} />
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-tight font-black sm:text-xl" data-testid="pet-mood">
          {line.title}
        </p>
        <p className="mt-0.5 text-sm font-bold text-fg-2">{line.text}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex gap-0.5" role="img" aria-label={`Today’s quest: ${Math.min(done, goal)} of ${goal} done`}>
            {Array.from({ length: goal }, (_, i) => (
              <motion.span key={i} initial={false} animate={i < done ? { scale: [1, 1.4, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}>
                <Heart className={cn('size-5', i < done ? 'fill-[#ff5a7a] text-[#ff5a7a]' : 'text-line-strong')} strokeWidth={2.5} aria-hidden />
              </motion.span>
            ))}
          </span>
          <span className={cn('text-xs font-black', complete ? 'text-success' : 'text-fg-3')}>
            {complete ? 'Quest complete! Today is a gold day.' : `Finish ${goal} today to ${days ? `keep your ${days}-day streak` : 'start a streak'}`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 text-xs font-black text-accent-text">Lv {level}</span>
          <ProgressBar value={progress} height="h-2.5" className="flex-1" label="Progress to next level" />
          {days > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-xs font-black text-fire">
              <Flame className="size-3.5 fill-current" aria-hidden />
              {days}
            </span>
          )}
        </div>
        {stage.next && stage.stage !== 'egg' && <p className="mt-1 text-[11px] font-bold text-fg-3">Grows into a {stage.next.label} at Level {stage.next.at}</p>}
      </div>
    </section>
  )
}

/** Pick one of the five pets and name it. Used on Today the first time, and on Me to switch. */
export function PetPicker({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const current = useStore((s) => s.prefs.pet)
  const update = useStore((s) => s.updatePrefs)
  const { level } = useXp()
  const [species, setSpecies] = useState<PetSpecies>(current?.species ?? 'dragon')
  const [name, setName] = useState(current?.name ?? '')
  const def = PET_SPECIES.find((p) => p.id === species)!
  const stage = petStage(level).stage

  const choose = () => {
    update({ pet: { species, name: name.trim() || def.name } })
    sfx.quest()
    if (!current) setTimeout(cannons, 200)
    setTimeout(() => window.dispatchEvent(new Event('pet:cheer')), 300)
    onDone?.()
  }

  return (
    <section aria-label="Pick your pet" className={cn('card-3d p-4 sm:p-5', !compact && 'bg-gradient-to-b from-accent-soft/60 to-surface')}>
      {!compact && (
        <>
          <p className="text-xl font-black">Pick your study pet!</p>
          <p className="text-sm font-bold text-fg-2">It grows as you level up, and cheers when you finish things.</p>
        </>
      )}
      <div role="radiogroup" aria-label="Pet" className="mt-3 grid grid-cols-5 gap-2">
        {PET_SPECIES.map((p) => {
          const active = p.id === species
          return (
            <motion.button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={p.kind}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.92 }}
              data-sfx="pet"
              onClick={() => {
                if (!name.trim() || PET_SPECIES.some((x) => x.name === name.trim())) setName('')
                setSpecies(p.id)
              }}
              className={cn('relative flex flex-col items-center rounded-2xl border-2 border-b-4 px-1 pt-1 pb-1.5 transition-colors', active ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong')}
            >
              <motion.span animate={active ? { y: [0, -8, 0] } : { y: 0 }} transition={{ duration: 0.4 }}>
                <PetArt species={p.id} stage={stage === 'egg' ? 'adult' : stage} size={60} className="max-sm:size-12" />
              </motion.span>
              <span className="text-[11px] leading-tight font-black max-sm:text-[10px]">{p.kind}</span>
              {active && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-accent text-white">
                  <Check className="size-3" strokeWidth={4} aria-hidden />
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1">
          <span className="text-xs font-black text-fg-3">Name</span>
          <Input value={name} maxLength={20} placeholder={def.name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </label>
        <Button variant="primary" onClick={choose}>
          {current ? 'Save pet' : `Choose ${name.trim() || def.name}`}
        </Button>
      </div>
    </section>
  )
}
