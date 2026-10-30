import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from './cn'
import { useT } from '@/i18n'

/** On/off switch. Keeps a real checkbox underneath for forms and screen readers. */
export function Checkbox({ checked, onChange, label, id, className, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id?: string; className?: string; description?: ReactNode }) {
  const auto = useId()
  const inputId = id ?? auto
  const t = useT()
  return (
    <label htmlFor={inputId} className={cn('group inline-flex cursor-pointer items-center gap-3 text-sm font-bold text-fg', className)}>
      <input id={inputId} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ring)]', checked ? 'bg-success-bright shadow-[inset_0_-3px_0_var(--success-press)]' : 'bg-surface-3 shadow-[inset_0_-3px_0_var(--line-strong)]')} aria-hidden>
        <motion.span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow-md" animate={{ x: checked ? 20 : 0 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }} />
      </span>
      <span className="flex flex-col">
        {typeof label === 'string' ? t(label) : label}
        {description && <span className="text-xs font-semibold text-fg-3">{typeof description === 'string' ? t(description) : description}</span>}
      </span>
    </label>
  )
}
