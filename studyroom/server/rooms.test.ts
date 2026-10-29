import { beforeEach, describe, expect, it } from 'vitest'
import { IDLE, start } from '../shared/model.ts'
import { _reset, cheer, createRoom, join, leave, MEMBER_TIMEOUT_MS, roomExists, RoomError, state, subscribe, sweep, update } from './rooms.ts'

const look = { skin: 0, hair: 0, hairColor: 0, shirt: 0, pants: 0, hat: 0 }
const T0 = 1_800_000_000_000

beforeEach(_reset)

describe('rooms', () => {
  it('lets people join, study together and counts study time', () => {
    const code = createRoom(T0)
    const a = join(code, 'key-a', 'Clara', look, IDLE, T0)
    join(code, 'key-b', 'Maya', look, IDLE, T0)
    update(code, 'key-a', { timer: start('study', 25, T0) }, T0)
    const s = state(code, T0 + 10 * 60_000)
    expect(s.members).toHaveLength(2)
    expect(s.members.find((m) => m.id === a)!.studied).toBe(600)
    expect(s.studied).toBe(600)
    // Study time stops at the end of the study phase, and the timer rolls into rest.
    const later = state(code, T0 + 40 * 60_000)
    expect(later.members.find((m) => m.id === a)!.studied).toBe(25 * 60)
  })

  it('never exposes keys, and only the key holder can update', () => {
    const code = createRoom(T0)
    join(code, 'secret-key', 'Clara', look, IDLE, T0)
    expect(JSON.stringify(state(code, T0))).not.toContain('secret-key')
    expect(() => update(code, 'wrong-key', { name: 'Hacker' }, T0)).toThrow(RoomError)
  })

  it('keeps study time after someone leaves, and drops people who disappear', () => {
    const code = createRoom(T0)
    join(code, 'a', 'Clara', look, start('study', 25, T0), T0)
    join(code, 'b', 'Leo', look, IDLE, T0)
    leave(code, 'a', T0 + 5 * 60_000)
    expect(state(code, T0 + 5 * 60_000).studied).toBe(300)
    sweep(T0 + MEMBER_TIMEOUT_MS + 1)
    expect(state(code, T0 + MEMBER_TIMEOUT_MS + 1).members).toHaveLength(0)
    sweep(T0 + 2 * 3600_000)
    expect(roomExists(code)).toBe(false)
  })

  it('limits cheers and tells listeners', () => {
    const code = createRoom(T0)
    const a = join(code, 'a', 'Clara', look, IDLE, T0)
    join(code, 'b', 'Leo', look, IDLE, T0)
    const seen: number[] = []
    subscribe(code, (s) => seen.push(s.cheers.length))
    cheer(code, 'b', a, '🔥', T0)
    expect(() => cheer(code, 'b', a, '👏', T0 + 100)).toThrow(/Slow down/)
    expect(seen.at(-1)).toBe(1)
  })
})
