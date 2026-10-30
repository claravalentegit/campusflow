import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS helper shared with the command line
import { i18nKeys } from '../../scripts/i18n-keys.mjs'
import { STRINGS } from '@/parent/i18n'
import { DICTS, translate } from './core'
import { fill } from './langs'

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()

describe('student app translations', () => {
  const keys = [...(i18nKeys(process.cwd()) as Map<string, string>).keys()]
  it('finds the app text', () => expect(keys.length).toBeGreaterThan(500))
  for (const [lang, dict] of Object.entries(DICTS)) {
    it(`${lang} has every phrase, with the same {placeholders}`, () => {
      const missing = keys.filter((k) => !(k in dict))
      expect(missing).toEqual([])
      const broken = keys.filter((k) => placeholders(k).join() !== placeholders(dict[k]).join())
      expect(broken).toEqual([])
    })
  }
  it('falls back to English and fills placeholders', () => {
    expect(translate('es', 'Today')).toBe('Hoy')
    expect(translate('pt', 'Step {n} of {total}', { n: 2, total: 5 })).toBe('Passo 2 de 5')
    expect(translate('es', 'Something not translated yet')).toBe('Something not translated yet')
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}')
  })
})

describe('parent app translations', () => {
  it('every language has every string, and the same number of tips', () => {
    const en = STRINGS.en
    for (const lang of ['es', 'pt'] as const) {
      const other = STRINGS[lang] as Record<string, unknown>
      for (const [k, v] of Object.entries(en)) {
        expect(typeof other[k], `${lang}.${k}`).toBe(typeof v)
        if (Array.isArray(v)) expect((other[k] as string[]).length, `${lang}.${k}`).toBe(v.length)
        else expect(placeholders(other[k] as string), `${lang}.${k}`).toEqual(placeholders(v as string))
      }
    }
  })
})
