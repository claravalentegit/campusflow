import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { create } from 'zustand'
import { Button, IconButton } from './Button'
import { cn } from './cn'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Element to focus on open; defaults to the first focusable control. */
  initialFocusSelector?: string
}

/** Modal dialog built on the native <dialog> element: focus trap, Esc to close, and top-layer stacking. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', initialFocusSelector }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      const target = initialFocusSelector ? el.querySelector<HTMLElement>(initialFocusSelector) : el.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), textarea, select')
      target?.focus()
    } else if (!open && el.open) el.close()
  }, [open, initialFocusSelector])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handle = (e: Event) => {
      e.preventDefault()
      onCloseRef.current()
    }
    el.addEventListener('cancel', handle)
    return () => el.removeEventListener('cancel', handle)
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto max-h-[min(92dvh,860px)] w-[calc(100%-24px)] overflow-hidden rounded-xl border border-line bg-surface p-0 text-fg shadow-lg backdrop:animate-fade-in open:animate-pop-in',
        'max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none',
        size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl',
      )}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-fg-3">{description}</p>}
            </div>
            <IconButton icon={X} label="Close" size="sm" onClick={onClose} tooltip={false} className="-mr-1.5" />
          </header>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/50 px-5 py-3">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

interface ConfirmRequest {
  title: string
  message: ReactNode
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  resolve: (ok: boolean) => void
}

const useConfirmStore = create<{ request: ConfirmRequest | null; set: (r: ConfirmRequest | null) => void }>((set) => ({
  request: null,
  set: (request) => set({ request }),
}))

/** Promise-based confirmation for destructive actions: `if (await confirm({...})) remove()`. */
export function confirm(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.getState().set({ ...opts, resolve }))
}

export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request)
  const setRequest = useConfirmStore((s) => s.set)
  const finish = (ok: boolean) => {
    request?.resolve(ok)
    setRequest(null)
  }
  return (
    <Dialog
      open={!!request}
      onClose={() => finish(false)}
      title={request?.title ?? ''}
      size="sm"
      initialFocusSelector="[data-confirm]"
      footer={
        <>
          <Button onClick={() => finish(false)}>Cancel</Button>
          <Button data-confirm variant={request?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => finish(true)}>
            {request?.confirmLabel ?? 'Delete'}
          </Button>
        </>
      }
    >
      <div className="text-sm text-fg-2">{request?.message}</div>
    </Dialog>
  )
}
