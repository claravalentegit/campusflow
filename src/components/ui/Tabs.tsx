import { cn } from './cn'

export interface TabDef<T extends string> {
  value: T
  label: string
  count?: number
}

/** Underlined tab bar. Panels are rendered by the caller with matching ids. */
export function Tabs<T extends string>({ value, onChange, tabs, label, idPrefix }: { value: T; onChange: (v: T) => void; tabs: TabDef<T>[]; label: string; idPrefix: string }) {
  return (
    <div role="tablist" aria-label={label} className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => (
        <button
          key={t.value}
          role="tab"
          id={`${idPrefix}-tab-${t.value}`}
          aria-selected={value === t.value}
          aria-controls={`${idPrefix}-panel-${t.value}`}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
            e.preventDefault()
            const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
            onChange(next.value)
            document.getElementById(`${idPrefix}-tab-${next.value}`)?.focus()
          }}
          className={cn(
            'relative flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-sm font-medium transition-colors',
            value === t.value ? 'text-fg after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent' : 'text-fg-3 hover:text-fg',
          )}
        >
          {t.label}
          {t.count != null && <span className="tabular rounded-sm bg-surface-2 px-1 text-2xs text-fg-3">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
