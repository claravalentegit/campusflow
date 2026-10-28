import type { ReactNode } from 'react'
import { cn } from './cn'

/** Flat section container. Use one level only — never nest panels. */
export function Panel({ title, description, actions, children, className, bodyClassName, id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section aria-labelledby={id && title ? `${id}-title` : undefined} className={cn('rounded-lg border border-line bg-surface shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex min-h-11 items-center gap-2 border-b border-line px-4 py-2">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 id={id ? `${id}-title` : undefined} className="truncate text-sm font-semibold">
                {title}
              </h2>
            )}
            {description && <p className="truncate text-xs text-fg-3">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
