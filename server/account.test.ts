import { describe, expect, it } from 'vitest'
import { account, AccountError } from './account.ts'
import { memoryKv } from './kv.ts'

const setup = () => {
  let t = 1_800_000_000_000
  return { a: account(memoryKv(), () => t), tick: (ms: number) => (t += ms) }
}
const grant = { baseUrl: 'https://ocps.instructure.com', accessToken: 'secret-token-1234567890', userName: 'Clara V', userId: '42' }

describe('account', () => {
  it('saves with revisions and refuses a stale save, returning the newer copy', async () => {
    const { a } = setup()
    expect(await a.load('s1')).toBeNull()
    expect(await a.save('s1', 0, { xp: 1 })).toMatchObject({ rev: 1 })
    expect(await a.save('s1', 1, { xp: 2 })).toMatchObject({ rev: 2 })
    const stale = await a.save('s1', 1, { xp: 3 }).catch((e) => e)
    expect(stale).toBeInstanceOf(AccountError)
    expect(stale).toMatchObject({ status: 409, current: { rev: 2, data: { xp: 2 } } })
    expect((await a.load('s1'))?.data).toEqual({ xp: 2 })
  })

  it('device codes work once, for 10 minutes', async () => {
    const { a, tick } = setup()
    const { code } = await a.createDeviceCode(grant)
    expect(code).toMatch(/^\d{6}$/)
    expect(await a.redeemDeviceCode(code)).toEqual(grant)
    await expect(a.redeemDeviceCode(code)).rejects.toThrow(/didn’t work/)
    const late = await a.createDeviceCode(grant)
    tick(11 * 60_000)
    await expect(a.redeemDeviceCode(late.code)).rejects.toBeInstanceOf(AccountError)
    await expect(a.redeemDeviceCode('12')).rejects.toThrow(/6 numbers/)
  })
})
