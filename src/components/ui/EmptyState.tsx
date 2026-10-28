import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'

export function EmptyState({ icon: Icon, title, description, actions, className, compact }: { icon: LucideIcon; title: string; description?: ReactNode; actions?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-6' : 'px-6 py-12', className)}>
      <div className={cn('mb-3 flex items-center justify-center rounded-lg border border-line bg-surface-2 text-fg-3', compact ? 'size-9' : 'size-11')}>
        <Icon className={compact ? 'size-4' : 'size-5'} aria-hidden />
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-3">{description}</p>}
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}
