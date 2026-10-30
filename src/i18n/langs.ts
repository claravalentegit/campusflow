import { es, ptBR } from 'date-fns/locale'
import type { Locale } from 'date-fns'

/** The languages CampusFlow speaks. English is the default. */
export type Lang = 'en' | 'es' | 'pt'

export const LANGS: Array<{ id: Lang; label: string; flag: string }> = [
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'pt', label: 'Português', flag: '🇧🇷' },
]

export const DATE_LOCALES: Record<Lang, Locale | undefined> = { en: undefined, es, pt: ptBR }

export const isLang = (x: unknown): x is Lang => x === 'en' || x === 'es' || x === 'pt'

/** Fill {placeholders}. */
export function fill(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/** Marks English text that is translated later, where it's shown (lets the i18n test find it). */
export const msg = <S extends string>(text: S): S => text
