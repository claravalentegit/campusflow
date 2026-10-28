import type { ReactNode } from 'react'
import { cn } from './cn'

const SIDE = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
}

/** Visual tooltip for icon controls. The control itself must carry an aria-label. */
export function Tooltip({ label, side = 'bottom', children, className }: { label: ReactNode; side?: keyof typeof SIDE; children: ReactNode; className?: string }) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        aria-hidden
        className={cn(
          // display:none until needed, so off-screen tooltips never widen the page; no tooltips on touch-sized screens.
          'tooltip-in pointer-events-none absolute z-50 hidden rounded-md bg-fg px-2 py-1 text-2xs font-medium whitespace-nowrap text-bg shadow-md',
          'sm:group-hover/tt:block sm:group-has-[:focus-visible]/tt:block',
          SIDE[side],
        )}
      >
        {label}
      </span>
    </span>
  )
}
