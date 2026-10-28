import type { ReactNode } from 'react'
import { cn } from './cn'

export type BadgeTone = 'neutral' | 'accent' | 'warn' | 'danger' | 'success' | 'outline'

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-2',
  accent: 'bg-accent-soft text-accent-text',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  outline: 'border border-line text-fg-2',
}

export function Badge({ tone = 'neutral', children, className, title }: { tone?: BadgeTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-2xs font-medium whitespace-nowrap', TONE[tone], className)}>
      {children}
    </span>
  )
}
