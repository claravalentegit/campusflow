import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'

export type PanelTone = 'accent' | 'gold' | 'fire' | 'green' | 'blue' | 'pink' | 'slate'

const TONE: Record<PanelTone, string> = {
  accent: 'bg-accent [--press:var(--accent-press)]',
  gold: 'bg-gold [--press:var(--gold-press)]',
  fire: 'bg-fire [--press:#d9480f]',
  green: 'bg-success-bright [--press:var(--success-press)]',
  blue: 'bg-[#0ea5e9] [--press:#0369a1]',
  pink: 'bg-[#ec4899] [--press:#be185d]',
  slate: 'bg-[#64748b] [--press:#475569]',
}

/** A chunky section card with an optional 3D icon tile. Use one level only, never nest. */
export function Panel({ title, description, actions, children, className, bodyClassName, id, icon: Icon, tone = 'accent' }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string; icon?: LucideIcon; tone?: PanelTone }) {
  return (
    <section id={id} aria-labelledby={id && title ? `${id}-title` : undefined} className={cn('card-3d scroll-mt-24 overflow-hidden', className)}>
      {(title || actions) && (
        <header className="flex items-center gap-3 px-5 pt-4 pb-2">
          {Icon && (
            <span className={cn('btn-3d grid size-10 shrink-0 place-items-center rounded-xl text-white', TONE[tone])} aria-hidden>
              <Icon className="size-5" strokeWidth={2.5} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && (
              <h2 id={id ? `${id}-title` : undefined} className="truncate text-lg leading-tight font-black">
                {title}
              </h2>
            )}
            {description && <p className="text-sm font-semibold text-fg-3">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
