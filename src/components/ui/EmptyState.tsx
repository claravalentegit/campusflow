import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'

export function EmptyState({ icon: Icon, title, description, actions, className, compact }: { icon: LucideIcon; title: string; description?: ReactNode; actions?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-6' : 'px-6 py-12', className)}>
      <div className={cn('btn-3d bob mb-3 flex items-center justify-center rounded-2xl bg-accent-soft text-accent-text [--press:var(--line-strong)]', compact ? 'size-12' : 'size-16')}>
        <Icon className={compact ? 'size-6' : 'size-8'} strokeWidth={2.4} aria-hidden />
      </div>
      <p className="text-lg font-black text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm font-semibold text-fg-2">{description}</p>}
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  )
}
