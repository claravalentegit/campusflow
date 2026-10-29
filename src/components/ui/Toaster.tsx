import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { sfx } from '@/game/fx'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useUi } from '@/store/ui'
import { cn } from './cn'

const ICON = { success: CheckCircle2, error: XCircle, info: Info }
const TILE = { success: 'bg-success-bright [--press:var(--success-press)]', error: 'bg-danger [--press:rgb(0_0_0/0.25)]', info: 'bg-accent [--press:var(--accent-press)]' }

export function Toaster() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  const newest = toasts.at(-1)?.id
  useEffect(() => {
    if (newest) sfx.blip()
  }, [newest])
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-5 sm:items-end sm:px-5">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICON[t.tone]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 30, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="card-3d pointer-events-auto flex w-full max-w-sm items-center gap-3 px-3 py-2.5 shadow-lg"
            >
              <span className={cn('btn-3d grid size-8 shrink-0 place-items-center rounded-lg text-white', TILE[t.tone])}>
                <Icon className="size-4.5" strokeWidth={2.5} aria-hidden />
              </span>
              <p className="min-w-0 flex-1 text-sm font-bold text-fg">{t.message}</p>
              {t.action && (
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-black text-accent-text transition-transform hover:brightness-95 active:scale-95"
                  onClick={() => {
                    t.action?.run()
                    dismiss(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="shrink-0 rounded-lg p-1 text-fg-3 hover:bg-surface-2 hover:text-fg">
                <X className="size-4" aria-hidden />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
