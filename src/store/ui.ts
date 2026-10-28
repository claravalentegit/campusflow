import { create } from 'zustand'
import { newId } from '@/domain/ids'

export type QuickAddKind = 'assignment' | 'task' | 'session' | 'reminder' | 'note' | 'event'

export interface Toast {
  id: string
  tone: 'success' | 'error' | 'info'
  message: string
  action?: { label: string; run: () => void }
}

export interface QuickAddPreset {
  kind: QuickAddKind
  courseId?: string | null
  assignmentId?: string | null
  /** yyyy-MM-dd */
  day?: string
  /** HH:mm */
  time?: string
}

export type EditTarget = { kind: 'assignment' | 'course' | 'task' | 'session' | 'event' | 'reminder'; id: string }

interface UiState {
  editing: EditTarget | null
  edit: (target: EditTarget | null) => void
  breakdownFor: string | null
  openBreakdown: (assignmentId: string | null) => void
  focusDialogOpen: boolean
  setFocusDialogOpen: (open: boolean) => void
  toasts: Toast[]
  quickAdd: QuickAddPreset | null
  paletteOpen: boolean
  mobileNavOpen: boolean
  shortcutsOpen: boolean
  toast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void
  dismissToast: (id: string) => void
  openQuickAdd: (preset?: Partial<QuickAddPreset>) => void
  closeQuickAdd: () => void
  setPaletteOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
}

export const useUi = create<UiState>((set, get) => ({
  editing: null,
  edit: (editing) => set({ editing, paletteOpen: false }),
  breakdownFor: null,
  openBreakdown: (breakdownFor) => set({ breakdownFor, paletteOpen: false }),
  focusDialogOpen: false,
  setFocusDialogOpen: (focusDialogOpen) => set({ focusDialogOpen, paletteOpen: false }),
  toasts: [],
  quickAdd: null,
  paletteOpen: false,
  mobileNavOpen: false,
  shortcutsOpen: false,
  toast: (message, tone = 'success', action) => {
    const id = newId('tst')
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message, action }] }))
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 7000 : 4500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  openQuickAdd: (preset) => set({ quickAdd: { kind: 'assignment', ...preset }, paletteOpen: false }),
  closeQuickAdd: () => set({ quickAdd: null }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
}))

export const toast = (message: string, tone?: Toast['tone'], action?: Toast['action']) => useUi.getState().toast(message, tone, action)
