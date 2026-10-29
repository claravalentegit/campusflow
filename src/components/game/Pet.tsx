import { useEffect, useId, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import type { PetMood, PetSpecies, PetStage } from '@/domain/pet'
import { cn } from '@/components/ui/cn'

const INK = '#1d1a2b'
const SCALE: Record<PetStage, number> = { egg: 1, baby: 0.66, kid: 0.8, teen: 0.9, adult: 1, legend: 1 }

/** Eyes, mouth and blush. The eyes blink unless the pet is happy (closed, smiling eyes) or asleep. */
function Face({ mood, cx = 50, ey = 52, gap = 10, my = 63 }: { mood: PetMood; cx?: number; ey?: number; gap?: number; my?: number }) {
  const l = cx - gap
  const r = cx + gap
  return (
    <>
      <ellipse cx={l - 8} cy={ey + 9} rx="5" ry="3.5" fill="#ff8fab" opacity=".55" />
      <ellipse cx={r + 8} cy={ey + 9} rx="5" ry="3.5" fill="#ff8fab" opacity=".55" />
      {mood === 'happy' && <path d={`M${l - 5} ${ey} q5 -7 10 0 M${r - 5} ${ey} q5 -7 10 0`} stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />}
      {(mood === 'ok' || mood === 'worried') && (
        <g className="pet-blink" style={{ transformOrigin: `${cx}px ${ey}px` }}>
          <circle cx={l} cy={ey} r="4.5" fill={INK} />
          <circle cx={r} cy={ey} r="4.5" fill={INK} />
          <circle cx={l + 1.5} cy={ey - 1.5} r="1.5" fill="#fff" />
          <circle cx={r + 1.5} cy={ey - 1.5} r="1.5" fill="#fff" />
        </g>
      )}
      {mood === 'worried' && <path d={`M${l - 7} ${ey - 6} l10 -4 M${r + 7} ${ey - 6} l-10 -4`} stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {mood === 'sleepy' && <path d={`M${l - 5} ${ey} h10 M${r - 5} ${ey} h10`} stroke={INK} strokeWidth="4" strokeLinecap="round" />}
      {mood === 'happy' && <path d={`M${cx - 6} ${my} q6 8 12 0`} fill="#ff7a8a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />}
      {mood === 'ok' && <path d={`M${cx - 5} ${my + 1} q5 4 10 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      {mood === 'worried' && (
        <>
          <path d={`M${cx - 6} ${my + 3} q6 -6 12 0`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d={`M${r + 3} ${ey + 7} q3 6 0 8 q-3 -2 0 -8`} fill="#6cc3ff" />
        </>
      )}
      {mood === 'sleepy' && <ellipse cx={cx} cy={my + 1} rx="3" ry="3.5" fill={INK} />}
    </>
  )
}

function Body({ species, mood }: { species: PetSpecies; mood: PetMood }) {
  switch (species) {
    case 'cat':
      return (
        <>
          <path d="M28 36 l-5 -18 17 11z M72 36 l5 -18 -17 11z" fill="#a68bff" />
          <path d="M30 33 l-2 -8 7 5z M70 33 l2 -8 -7 5z" fill="#ffb3c7" />
          <path d="M16 64 q0 -40 34 -40 q34 0 34 40 q0 28 -34 28 q-34 0 -34 -28z" fill="#a68bff" />
          <ellipse cx="50" cy="74" rx="19" ry="13" fill="#fff" opacity=".35" />
          <Face mood={mood} />
        </>
      )
    case 'dragon':
      return (
        <>
          <g className="pet-flap" style={{ transformOrigin: '50px 55px' }}>
            <path d="M14 58 q-10 -16 4 -22 q2 12 12 14z M86 58 q10 -16 -4 -22 q-2 12 -12 14z" fill="#3fb57c" />
          </g>
          <path d="M36 30 q-4 -14 2 -18 q4 8 6 16z M64 30 q4 -14 -2 -18 q-4 8 -6 16z" fill="#ffd36b" />
          <path d="M20 64 q0 -38 30 -38 q30 0 30 38 q0 28 -30 28 q-30 0 -30 -28z" fill="#5fd39a" />
          <path d="M38 74 h24 M40 80 h20 M43 86 h14" stroke="#fff7d1" strokeWidth="5" strokeLinecap="round" />
          <path d="M46 26 l4 -6 4 6z" fill="#3fb57c" />
          <Face mood={mood} />
        </>
      )
    case 'bunny':
      return (
        <>
          <g className="pet-ears" style={{ transformOrigin: '50px 34px' }}>
            <ellipse cx="38" cy="22" rx="7" ry="20" fill="#fff" stroke="#e7e2f3" strokeWidth="3" transform="rotate(-12 38 22)" />
            <ellipse cx="62" cy="22" rx="7" ry="20" fill="#fff" stroke="#e7e2f3" strokeWidth="3" transform="rotate(12 62 22)" />
            <ellipse cx="38" cy="22" rx="3" ry="13" fill="#ffc2d4" transform="rotate(-12 38 22)" />
            <ellipse cx="62" cy="22" rx="3" ry="13" fill="#ffc2d4" transform="rotate(12 62 22)" />
          </g>
          <path d="M16 66 q0 -36 34 -36 q34 0 34 36 q0 26 -34 26 q-34 0 -34 -26z" fill="#fff" stroke="#e7e2f3" strokeWidth="3" />
          <Face mood={mood} ey={58} my={69} />
        </>
      )
    case 'fox':
      return (
        <>
          <g className="pet-wag" style={{ transformOrigin: '78px 82px' }}>
            <path d="M78 82 q22 -4 14 -28 q-6 14 -20 16z" fill="#ff9a4d" />
            <path d="M90 58 q2 -4 2 -6 q-3 4 -6 5z" fill="#fff" />
          </g>
          <path d="M24 40 l-4 -24 20 14z M76 40 l4 -24 -20 14z" fill="#ff9a4d" />
          <path d="M26 36 l-2 -12 9 7z M74 36 l2 -12 -9 7z" fill="#5a3a2e" />
          <path d="M18 64 q0 -36 32 -36 q32 0 32 36 q0 28 -32 28 q-32 0 -32 -28z" fill="#ff9a4d" />
          <path d="M26 66 q24 -12 48 0 q-4 24 -24 24 q-20 0 -24 -24z" fill="#fff" />
          <ellipse cx="50" cy="66" rx="3.5" ry="2.5" fill={INK} />
          <Face mood={mood} ey={54} my={70} />
        </>
      )
    case 'axolotl':
      return (
        <>
          <g className="pet-flap" style={{ transformOrigin: '50px 56px' }}>
            {[
              [22, 48, -12, -8],
              [21, 56, -14, 0],
              [22, 64, -12, 8],
              [78, 48, 12, -8],
              [79, 56, 14, 0],
              [78, 64, 12, 8],
            ].map(([x, y, dx, dy], i) => (
              <path key={i} d={`M${x} ${y} q${dx} ${dy} ${dx * 1.6} ${dy * 0.4}`} stroke="#ff6f9f" strokeWidth="5" fill="none" strokeLinecap="round" />
            ))}
          </g>
          <path d="M18 64 q0 -36 32 -36 q32 0 32 36 q0 28 -32 28 q-32 0 -32 -28z" fill="#ffa8c5" />
          <ellipse cx="50" cy="76" rx="17" ry="11" fill="#fff" opacity=".4" />
          <circle cx="34" cy="36" r="2" fill="#fff" opacity=".7" />
          <circle cx="40" cy="32" r="1.4" fill="#fff" opacity=".7" />
          <Face mood={mood} gap={13} />
        </>
      )
  }
}

function Egg({ species }: { species: PetSpecies }) {
  const spot = { cat: '#a68bff', dragon: '#5fd39a', bunny: '#ffc2d4', fox: '#ff9a4d', axolotl: '#ffa8c5' }[species]
  return (
    <>
      <ellipse cx="50" cy="56" rx="30" ry="37" fill="#fff8e6" stroke="#f0c56a" strokeWidth="4" />
      <circle cx="38" cy="44" r="6" fill={spot} opacity=".7" />
      <circle cx="62" cy="62" r="8" fill={spot} opacity=".7" />
      <circle cx="44" cy="74" r="4" fill={spot} opacity=".7" />
      <path d="M26 54 l7 -5 7 5 7 -5 7 5 7 -5 7 5 7 -5" fill="none" stroke="#f0c56a" strokeWidth="3.5" strokeLinejoin="round" />
    </>
  )
}

/** The pet as a static picture. */
export function PetArt({ species, mood = 'happy', stage = 'adult', size = 96, className }: { species: PetSpecies; mood?: PetMood; stage?: PetStage; size?: number; className?: string }) {
  const s = SCALE[stage]
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={cn('overflow-visible', className)} aria-hidden>
      <ellipse cx="50" cy="94" rx={24 * s} ry="4.5" fill="#000" opacity=".08" />
      <g transform={`translate(50 92) scale(${s}) translate(-50 -92)`}>
        {stage === 'egg' ? <Egg species={species} /> : <Body species={species} mood={mood} />}
        {stage === 'legend' && <path d="M37 14 l6 9 7 -11 7 11 6 -9 v13 h-26z" fill="#ffb800" stroke="#c98a00" strokeWidth="2" strokeLinejoin="round" />}
      </g>
      {mood === 'sleepy' && stage !== 'egg' && (
        <g className="pet-zzz" fill="#6d4aff" fontWeight="900" fontFamily="inherit">
          <text x="72" y="30" fontSize="15">z</text>
          <text x="82" y="18" fontSize="11">z</text>
        </g>
      )}
    </svg>
  )
}

/**
 * The living pet: idles with a gentle bob, and jumps for joy (smiling) whenever XP lands.
 * Tapping it makes it jump too.
 */
export function Pet({ species, mood, stage, size = 96, className, label }: { species: PetSpecies; mood: PetMood; stage: PetStage; size?: number; className?: string; label: string }) {
  const controls = useAnimationControls()
  const reduce = useReducedMotion()
  const [cheer, setCheer] = useState(false)
  const id = useId()

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const jump = () => {
      setCheer(true)
      clearTimeout(t)
      t = setTimeout(() => setCheer(false), 1600)
      if (!reduce) void controls.start({ y: [0, -size * 0.28, 0, -size * 0.12, 0], rotate: [0, -8, 8, -4, 0], transition: { duration: 0.8, ease: 'easeOut' } })
    }
    window.addEventListener('xp:arrive', jump)
    window.addEventListener('pet:cheer', jump)
    return () => {
      clearTimeout(t)
      window.removeEventListener('xp:arrive', jump)
      window.removeEventListener('pet:cheer', jump)
    }
  }, [controls, reduce, size])

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-describedby={id}
      data-sfx="pet"
      onClick={() => window.dispatchEvent(new Event('pet:cheer'))}
      className={cn('relative shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-4 focus-visible:ring-accent-soft', className)}
      animate={controls}
      whileTap={{ scale: 0.9 }}
    >
      <span className={cn('block', stage === 'egg' ? 'pet-wobble' : mood === 'sleepy' ? 'pet-breathe' : 'bob')}>
        <PetArt species={species} mood={cheer ? 'happy' : mood} stage={stage} size={size} />
      </span>
      <span id={id} className="sr-only">
        {cheer ? 'Cheering' : mood}
      </span>
    </motion.button>
  )
}
