import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useUi } from '@/store/ui'
import { cn } from './cn'

const ICON = { success: CheckCircle2, error: XCircle, info: Info }
const COLOR = { success: 'text-success', error: 'text-danger', info: 'text-accent' }

export function Toaster() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-5 sm:items-end sm:px-5">
      {toasts.map((t) => {
        const Icon = ICON[t.tone]
        return (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-pop-in items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm shadow-lg">
            <Icon className={cn('size-4 shrink-0', COLOR[t.tone])} aria-hidden />
            <p className="min-w-0 flex-1 text-fg">{t.message}</p>
            {t.action && (
              <button
                type="button"
                className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-accent-text hover:bg-accent-soft"
                onClick={() => {
                  t.action?.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="shrink-0 rounded p-0.5 text-fg-3 hover:text-fg">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
