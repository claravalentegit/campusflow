import { describe, expect, it } from 'vitest'
import { advance, cleanLook, cleanName, cleanRoomCode, cleanTimer, formatClock, IDLE, makeRoomCode, pause, resume, secondsLeft, start } from './model.ts'

const NOW = 1_800_000_000_000

describe('timer', () => {
  it('counts down, pauses and resumes', () => {
    const t = start('study', 25, NOW)
    expect(secondsLeft(t, NOW + 60_000)).toBe(24 * 60)
    const p = pause(t, NOW + 60_000)
    expect(secondsLeft(p, NOW + 10 * 60_000)).toBe(24 * 60)
    const r = resume(p, NOW + 10 * 60_000)
    expect(secondsLeft(r, NOW + 11 * 60_000)).toBe(23 * 60)
  })
  it('rolls study into rest, and rest or break into ready', () => {
    const t = start('study', 25, NOW)
    expect(advance(t, NOW + 60_000, 5)).toBeNull()
    const rest = advance(t, NOW + 25 * 60_000 + 3000, 5)!
    expect(rest.status).toBe('rest')
    expect(rest.endsAt).toBe(NOW + 30 * 60_000) // rest starts when study ended, not when the tab noticed
    expect(advance(rest, NOW + 31 * 60_000, 5)).toEqual(IDLE)
    expect(advance(pause(t, NOW), NOW + 99 * 60_000, 5)).toBeNull()
  })
  it('formats the clock', () => {
    expect(formatClock(18 * 60 + 42)).toBe('18:42')
    expect(formatClock(3725)).toBe('1:02:05')
  })
})

describe('validation', () => {
  it('cleans names and strips markup', () => {
    expect(cleanName('  Clara  ')).toBe('Clara')
    expect(cleanName('<b>Leo</b>')).toBe('bLeob')
    expect(cleanName('')).toBeNull()
    expect(cleanName('x'.repeat(17))).toBeNull()
    expect(cleanName(42)).toBeNull()
  })
  it('accepts only known look options', () => {
    expect(cleanLook({ skin: 0, hair: 1, hairColor: 2, shirt: 3, pants: 0, hat: 0 })).toBeTruthy()
    expect(cleanLook({ skin: 9, hair: 1, hairColor: 2, shirt: 3, pants: 0, hat: 0 })).toBeNull()
    expect(cleanLook({ skin: 0 })).toBeNull()
  })
  it('rejects timers that are too long or in the past', () => {
    expect(cleanTimer({ status: 'study', endsAt: NOW + 25 * 60_000 }, NOW)).toBeTruthy()
    expect(cleanTimer({ status: 'study', endsAt: NOW + 999 * 60_000 }, NOW)).toBeNull()
    expect(cleanTimer({ status: 'nap', endsAt: NOW }, NOW)).toBeNull()
    expect(cleanTimer({ status: 'idle' }, NOW)).toEqual(IDLE)
  })
  it('makes and checks room codes', () => {
    expect(makeRoomCode(() => 0)).toBe('MAPLE-10')
    expect(cleanRoomCode(' maple 42 ')).toBe('MAPLE-42')
    expect(cleanRoomCode('MAPLE-4')).toBeNull()
  })
})
