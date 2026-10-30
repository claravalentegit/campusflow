import { Check } from 'lucide-react'
import { LANGS, type Lang } from '@/i18n/langs'
import { cn } from './ui/cn'

/** Three big buttons: English, Español, Português. */
export function LanguagePicker({ value, onChange, label, accent = 'var(--accent)' }: { value: Lang; onChange: (l: Lang) => void; label: string; accent?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {LANGS.map((l) => {
        const on = l.id === value
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={on}
            lang={l.id}
            data-sfx="click"
            onClick={() => onChange(l.id)}
            className={cn('flex items-center gap-2 rounded-2xl border-2 px-4 py-3 text-left font-black transition-colors', on ? 'bg-surface' : 'border-line bg-surface-2 text-fg-2')}
            style={on ? { borderColor: accent } : undefined}
          >
            <span className="text-xl" aria-hidden>
              {l.flag}
            </span>
            <span className="flex-1">{l.label}</span>
            {on && <Check className="size-5" style={{ color: accent }} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
