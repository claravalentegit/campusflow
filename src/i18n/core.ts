import { format } from 'date-fns'
import { DATE_LOCALES, fill, type Lang } from './langs'
import { ES } from './es'
import { PT } from './pt'

/**
 * Translations without React or the store, so domain code can use them too.
 * Keys are the English text itself: English needs no dictionary, and anything missing falls back
 * to English. i18n.test.ts checks that every t('…'), tr('…') and msg('…') has es and pt entries.
 */
export const DICTS: Record<Exclude<Lang, 'en'>, Record<string, string>> = { es: ES, pt: PT }

let current: Lang = 'en'
export const setCurrentLang = (l: Lang) => void (current = l)
export const currentLang = () => current

export type Vars = Record<string, string | number>
export type T = (text: string, vars?: Vars) => string

export function translate(lang: Lang, text: string, vars?: Vars): string {
  return fill(lang === 'en' ? text : (DICTS[lang][text] ?? text), vars)
}

/** Translate in the current app language. */
export const tr: T = (text, vars) => translate(current, text, vars)

export const dateLocale = () => DATE_LOCALES[current]

/** date-fns format in the app's language. */
export function fmtDate(date: Date | number, pattern: string): string {
  return format(date, pattern, { locale: dateLocale() })
}
