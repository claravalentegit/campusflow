import { describe, expect, it } from 'vitest'
import { EMPTY_DATA } from '@/domain/types'
import { DEFAULT_PREFS } from '@/store/appStore'
import { buildAccountData, mergeAccountData, type AccountData } from './account'

const base = (): AccountData => ({ ...buildAccountData(), data: { ...EMPTY_DATA }, prefs: buildAccountData().prefs })
const ev = (id: string, at: string) => ({ id, at, amount: 10, kind: 'task' as const, refId: id })

describe('account merge', () => {
  it('keeps XP and skips from both devices, and this device wins on the same record', () => {
    const remote = base()
    remote.data.xpEvents = [ev('a', '2026-11-01T10:00:00Z'), ev('b', '2026-11-02T10:00:00Z')]
    remote.prefs = { ...remote.prefs, displayName: 'Old', skipped: [{ id: 's1' } as never], lastSeenLevel: 4 }
    const local = base()
    local.data.xpEvents = [ev('b', '2026-11-02T10:00:00Z'), ev('c', '2026-11-03T10:00:00Z')]
    local.prefs = { ...local.prefs, displayName: 'Clara', skipped: [{ id: 's2' } as never], lastSeenLevel: 2 }
    const m = mergeAccountData(remote, local)
    expect(m.data.xpEvents.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(m.prefs.skipped.map((x) => x.id).sort()).toEqual(['s1', 's2'])
    expect(m.prefs).toMatchObject({ displayName: 'Clara', lastSeenLevel: 4 })
  })
  it('never syncs device-only settings', () => {
    const d = buildAccountData()
    for (const k of ['dataMode', 'lastCanvasSyncAt', 'onboarded', 'account'] as const) expect(k in d.prefs).toBe(false)
    expect(DEFAULT_PREFS.account.rev).toBe(0)
  })
})
