import { useEffect } from 'react'

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    return !['checkbox', 'radio', 'button', 'submit', 'range'].includes(type)
  }
  return false
}

export interface Shortcut {
  key: string
  mod?: boolean
  /** Allow while focus is in a text field (only sensible for modifier shortcuts). */
  allowInInputs?: boolean
  run: (e: KeyboardEvent) => void
}

/** Global keyboard shortcuts that never fire while typing (unless explicitly allowed) or with a dialog open. */
export function useShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      for (const s of shortcuts) {
        const modPressed = e.metaKey || e.ctrlKey
        if (s.mod ? !modPressed : modPressed || e.altKey) continue
        if (e.key.toLowerCase() !== s.key) continue
        if (!s.allowInInputs && isTypingTarget(e.target)) continue
        if (!s.mod && document.querySelector('dialog[open]')) continue
        e.preventDefault()
        s.run(e)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts])
}
