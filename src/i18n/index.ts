import { useCallback } from 'react'
import { useStore } from '@/store/appStore'
import { DATE_LOCALES } from './langs'
import { setCurrentLang, translate, type T } from './core'

export { tr, fmtDate, dateLocale, translate, type T } from './core'

// Keep the store-free translator in step with the student's choice.
setCurrentLang(useStore.getState().prefs.language ?? 'en')
useStore.subscribe((s) => setCurrentLang(s.prefs.language ?? 'en'))

/** In components: const t = useT(); t('Today'). Re-renders when the language changes. */
export function useT(): T {
  const lang = useStore((s) => s.prefs.language)
  return useCallback((text, vars) => translate(lang, text, vars), [lang])
}

export const useLang = () => useStore((s) => s.prefs.language)
export const useDateLocale = () => DATE_LOCALES[useLang()]
