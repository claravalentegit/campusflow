import confetti from 'canvas-confetti'
import { useStore } from '@/store/appStore'

/**
 * Game feedback: synthesized sound effects, confetti, flying XP and haptics.
 * Everything respects prefers-reduced-motion and the Sound setting.
 */

export const prefersReducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const COLORS = ['#6d4aff', '#ffb800', '#22c55e', '#ff6b2c', '#ec4899', '#0ea5e9']

// ——— Sound ———

let audio: AudioContext | null = null
function ctx(): AudioContext | null {
  if (!useStore.getState().prefs.sound) return null
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
    return audio
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {}) {
  const c = ctx()
  if (!c) return
  const t0 = c.currentTime + start
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t0)
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

const arpeggio = (notes: number[], step: number, dur: number, type: OscillatorType = 'triangle', gain = 0.1) =>
  notes.forEach((f, i) => tone(f, i * step, dur, { type, gain }))

export const sfx = {
  tap: () => tone(520, 0, 0.06, { type: 'triangle', gain: 0.05 }),
  pop: () => tone(380, 0, 0.12, { type: 'sine', slideTo: 900, gain: 0.14 }),
  coin: () => {
    tone(988, 0.05, 0.08, { type: 'square', gain: 0.05 })
    tone(1319, 0.12, 0.28, { type: 'square', gain: 0.05 })
  },
  stage: () => arpeggio([523, 659, 784, 1047], 0.07, 0.18, 'triangle', 0.1),
  quest: () => arpeggio([523, 659, 784, 1047, 1319, 1568], 0.08, 0.3, 'triangle', 0.1),
  levelUp: () => {
    arpeggio([392, 523, 659, 784], 0.09, 0.22, 'square', 0.05)
    arpeggio([1047, 1319, 1568], 0.12, 0.5, 'triangle', 0.09)
  },
  badge: () => arpeggio([880, 1109, 1319, 1760], 0.06, 0.25, 'sine', 0.1),
  undo: () => tone(500, 0, 0.14, { type: 'sine', slideTo: 260, gain: 0.08 }),
}

// ——— Haptics ———

export function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}

// ——— Confetti ———

function originOf(el: Element | null) {
  if (!el) return { x: 0.5, y: 0.5 }
  const r = el.getBoundingClientRect()
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }
}

export function burst(el: Element | null, size: 'small' | 'medium' | 'big' = 'small') {
  if (prefersReducedMotion()) return
  const n = size === 'small' ? 26 : size === 'medium' ? 60 : 120
  confetti({
    particleCount: n,
    spread: size === 'small' ? 55 : 80,
    startVelocity: size === 'small' ? 22 : 35,
    scalar: size === 'small' ? 0.7 : 0.9,
    ticks: 120,
    gravity: 1.1,
    origin: originOf(el),
    colors: COLORS,
    disableForReducedMotion: true,
    zIndex: 90,
  })
}

/** Two side cannons — for quest complete and level up. */
export function cannons() {
  if (prefersReducedMotion()) return
  const end = Date.now() + 900
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: COLORS, zIndex: 90, disableForReducedMotion: true })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: COLORS, zIndex: 90, disableForReducedMotion: true })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

export function starShower() {
  if (prefersReducedMotion()) return
  confetti({ particleCount: 80, spread: 120, startVelocity: 30, origin: { x: 0.5, y: 0.35 }, shapes: ['star'], colors: ['#ffb800', '#ffd54f', '#fff2b3'], scalar: 1.2, zIndex: 90, disableForReducedMotion: true })
}

// ——— Flying XP ———

export const XP_TARGET_ID = 'xp-target'

/** "+60 XP" pops out of the clicked element and flies into the XP counter. */
export function flyXp(from: Element | null, amount: number, tone: 'gold' | 'purple' = 'gold') {
  if (!from || typeof document === 'undefined') return
  const r = from.getBoundingClientRect()
  const chip = document.createElement('div')
  chip.textContent = `+${amount} XP`
  chip.className = `xp-fly xp-fly-${tone}`
  chip.style.left = `${r.left + r.width / 2}px`
  chip.style.top = `${r.top + r.height / 2}px`
  document.body.appendChild(chip)
  const target = document.getElementById(XP_TARGET_ID)
  const visibleTarget = target && target.getBoundingClientRect().width > 0 ? target : null
  const tr = visibleTarget?.getBoundingClientRect()
  const dx = tr ? tr.left + tr.width / 2 - (r.left + r.width / 2) : 0
  const dy = tr ? tr.top + tr.height / 2 - (r.top + r.height / 2) : -120
  if (prefersReducedMotion()) {
    chip.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 900 }).onfinish = () => chip.remove()
    return
  }
  const anim = chip.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0 },
      { transform: 'translate(-50%, -140%) scale(1.25)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -160%) scale(1)', opacity: 1, offset: 0.45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.5)`, opacity: tr ? 0.9 : 0 },
    ],
    { duration: 1000, easing: 'cubic-bezier(.5,0,.3,1)' },
  )
  anim.onfinish = () => {
    chip.remove()
    window.dispatchEvent(new CustomEvent('xp:arrive'))
  }
}

/** Everything that happens when you finish something. */
export function celebrateCompletion(el: Element | null, amount: number, opts: { boss?: boolean } = {}) {
  sfx.pop()
  setTimeout(sfx.coin, 60)
  haptic(opts.boss ? [20, 40, 30, 40, 60] : 18)
  burst(el, opts.boss ? 'big' : 'small')
  flyXp(el, amount, opts.boss ? 'purple' : 'gold')
  if (opts.boss) {
    setTimeout(sfx.stage, 150)
    setTimeout(cannons, 200)
  }
}
