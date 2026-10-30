import { useId } from 'react'
import { motion } from 'motion/react'
import { cn } from './cn'
import { useT } from '@/i18n'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/** Chunky single-choice control (radio group semantics) with a sliding highlight. */
export function Segmented<T extends string>({ value, onChange, options, label, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: SegmentedOption<T>[]; label: string; className?: string; size?: 'sm' | 'md' }) {
  const id = useId()
  const t = useT()
  return (
    <div role="radiogroup" aria-label={t(label)} className={cn('inline-flex gap-0.5 rounded-xl bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value)
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault()
                const next = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length]
                onChange(next.value)
                ;(e.currentTarget.parentElement?.querySelectorAll('button')[options.indexOf(next)] as HTMLButtonElement | undefined)?.focus()
              }
            }}
            tabIndex={active ? 0 : -1}
            className={cn('relative rounded-lg font-extrabold whitespace-nowrap transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm', active ? 'text-accent-text' : 'text-fg-3 hover:text-fg')}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-surface shadow-[0_2px_0_var(--line-strong)]" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(o.label)}</span>
          </button>
        )
      })}
    </div>
  )
}
