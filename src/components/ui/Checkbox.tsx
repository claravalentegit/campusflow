import { Check } from 'lucide-react'
import { cn } from './cn'

/** Round completion toggle used for tasks and assignments. */
export function CompleteToggle({ checked, onChange, label, color, className }: { checked: boolean; onChange: () => void; label: string; color?: string; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      style={color && !checked ? { borderColor: color } : undefined}
      className={cn(
        'group/cb relative z-[1] flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors before:absolute before:-inset-2 before:content-[""]',
        checked ? 'border-success bg-success text-white' : 'border-line-strong hover:bg-surface-2',
        className,
      )}
    >
      <Check className={cn('size-3 transition-opacity', checked ? 'opacity-100' : 'opacity-0 group-hover/cb:opacity-40')} strokeWidth={3} aria-hidden />
    </button>
  )
}

export function Checkbox({ checked, onChange, label, id, className }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; id?: string; className?: string }) {
  return (
    <label htmlFor={id} className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-fg-2', className)}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded accent-[var(--accent)]" />
      {label}
    </label>
  )
}
