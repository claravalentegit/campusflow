/** Tiny synthesized sounds (no audio files). Respects the sound toggle. */
let ctx: AudioContext | null = null
let enabled = true

export function setSound(on: boolean) {
  enabled = on
}

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, slideTo?: number) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + at
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(c.destination)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

export const sfx = {
  click: () => tone(720, 0, 0.04, 'triangle', 0.035),
  pick: () => tone(520, 0, 0.09, 'square', 0.03, 780),
  start: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.16, 'triangle', 0.08)),
  pause: () => tone(500, 0, 0.12, 'sine', 0.06, 300),
  chime: () => {
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.12, 0.5, 'sine', 0.09))
    tone(392, 0, 0.7, 'triangle', 0.05)
  },
  cheer: () => [880, 1175, 1568].forEach((f, i) => tone(f, i * 0.05, 0.12, 'square', 0.035)),
  join: () => [440, 660].forEach((f, i) => tone(f, i * 0.09, 0.14, 'triangle', 0.07)),
  leave: () => [520, 390].forEach((f, i) => tone(f, i * 0.09, 0.14, 'triangle', 0.05)),
}
