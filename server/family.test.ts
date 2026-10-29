import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { family, FamilyError, studentIdFor } from './family.ts'
import { memoryKv } from './kv.ts'

const setup = () => {
  let t = 1_800_000_000_000
  const kv = memoryKv()
  return { kv, f: family(kv, () => t), tick: (ms: number) => (t += ms) }
}
const SID = studentIdFor('https://ocps.instructure.com', '42')

describe('family sharing', () => {
  it('links a parent with a one-time code and shares the snapshot', async () => {
    const { f } = setup()
    const { code } = await f.createCode(SID, 'Clara')
    expect(code).toMatch(/^\d{6}$/)
    // No parent yet: snapshots are not kept.
    expect(await f.saveSnapshot(SID, { a: 1 })).toEqual({ stored: false, parents: 0 })
    const { token, studentName } = await f.link(code, 'Mom', undefined)
    expect(studentName).toBe('Clara')
    await expect(f.link(code, 'Someone else', undefined)).rejects.toThrow(/didn’t work/) // single use
    expect(await f.saveSnapshot(SID, { a: 1 })).toEqual({ stored: true, parents: 1 })
    const view = await f.parentView(token, SID)
    expect(view.data).toEqual({ a: 1 })
    expect((await f.overview(SID)).parents.map((p) => p.name)).toEqual(['Mom'])
  })

  it('stores only sealed data', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cf-kv-'))
    const f = family(memoryKv(join(dir, 'family.json')))
    const { code } = await f.createCode(SID, 'Clara')
    await f.link(code, 'Mom', undefined)
    await f.saveSnapshot(SID, { grade: 'B+ in Algebra' })
    const raw = readFileSync(join(dir, 'family.json'), 'utf8')
    expect(raw).not.toMatch(/Clara|Mom|Algebra/)
  })

  it('expires codes and rejects bad input', async () => {
    const { f, tick } = setup()
    const { code } = await f.createCode(SID, 'Clara')
    await expect(f.link(code, '', undefined)).rejects.toThrow(/name/)
    await expect(f.link('12', 'Mom', undefined)).rejects.toThrow(/6 numbers/)
    tick(16 * 60_000)
    await expect(f.link(code, 'Mom', undefined)).rejects.toBeInstanceOf(FamilyError)
  })

  it('a new code replaces the old one', async () => {
    const { f } = setup()
    const first = await f.createCode(SID, 'Clara')
    await f.createCode(SID, 'Clara')
    await expect(f.link(first.code, 'Mom', undefined)).rejects.toThrow(/didn’t work/)
  })

  it('removing a parent stops sharing and deletes the snapshot', async () => {
    const { f } = setup()
    const { code } = await f.createCode(SID, 'Clara')
    const { token } = await f.link(code, 'Dad', undefined)
    await f.saveSnapshot(SID, { a: 1 })
    const parentId = (await f.overview(SID)).parents[0].id
    await f.remove(SID, parentId)
    await expect(f.parentView(token, SID)).rejects.toMatchObject({ status: 410 })
    expect((await f.parentMe(token))!.students[0]).toMatchObject({ active: false })
    expect((await f.overview(SID)).snapshotAt).toBeNull()
  })

  it('one parent device can follow two students, and unlinking removes it everywhere', async () => {
    const { f } = setup()
    const SID2 = studentIdFor('https://ocps.instructure.com', '43')
    const a = await f.link((await f.createCode(SID, 'Clara')).code, 'Mom', undefined)
    const b = await f.link((await f.createCode(SID2, 'Leo')).code, 'Mom', a.token)
    expect(b.token).toBe(a.token)
    expect((await f.parentMe(a.token))!.students.map((s) => s.name)).toEqual(['Clara', 'Leo'])
    await f.parentUnlink(a.token)
    expect(await f.parentMe(a.token)).toBeNull()
    expect((await f.overview(SID2)).parents).toEqual([])
  })

  it('rejects unknown devices', async () => {
    const { f } = setup()
    await expect(f.parentView('x'.repeat(43), SID)).rejects.toMatchObject({ status: 401 })
  })
})
