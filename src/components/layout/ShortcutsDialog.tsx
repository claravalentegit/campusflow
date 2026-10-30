import { useUi } from '@/store/ui'
import { Dialog } from '../ui/Dialog'
import { MOD_KEY } from './TopBar'
import { useT } from '@/i18n'
import { msg } from '@/i18n/langs'

const SHORTCUTS: Array<[string[], string]> = [
  [[MOD_KEY, 'K'], msg('Search and commands')],
  [['/'], msg('Search')],
  [['C'], msg('Quick add')],
  [['F'], msg('Start or show focus session')],
  [['?'], msg('Show keyboard shortcuts')],
  [['Esc'], msg('Close dialogs and menus')],
]

export function ShortcutsDialog() {
  const open = useUi((s) => s.shortcutsOpen)
  const setOpen = useUi((s) => s.setShortcutsOpen)
  const t = useT()
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t('Keyboard shortcuts')} description={t('Single-key shortcuts are ignored while you’re typing.')} size="sm">
      <dl className="divide-y divide-line">
        {SHORTCUTS.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between py-2 text-sm">
            <dt className="text-fg-2">{t(label)}</dt>
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
