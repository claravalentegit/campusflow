import { useUi } from '@/store/ui'
import { Dialog } from '../ui/Dialog'
import { MOD_KEY } from './TopBar'

const SHORTCUTS: Array<[string[], string]> = [
  [[MOD_KEY, 'K'], 'Search and commands'],
  [['/'], 'Search'],
  [['C'], 'Quick add'],
  [['F'], 'Start or show focus session'],
  [['?'], 'Show keyboard shortcuts'],
  [['Esc'], 'Close dialogs and menus'],
]

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen)
  const setOpen = useUi((s) => s.setShortcutsOpen)
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" description="Single-key shortcuts are ignored while you’re typing." size="sm">
      <dl className="divide-y divide-line">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between py-2 text-sm">
            <dt className="text-fg-2">{label}</dt>
            <dd className="flex gap-1">
              {keys.map((k) => (
                <kbd key={k} className="min-w-6 rounded border border-line bg-surface-2 px-1.5 text-center font-sans text-xs">
                  {k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
