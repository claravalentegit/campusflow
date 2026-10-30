import type { Assignment } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { confirm } from './ui/Dialog'
import { tr } from '@/i18n/core'

export function useDeleteAssignment() {
  const remove = useStore((s) => s.deleteAssignment)
  return async (a: Assignment) => {
    const ok = await confirm({
      title: tr('Delete assignment?'),
      message: (
        <>
          {tr('“{title}” and its stages will be removed from CampusFlow. XP you already earned stays.', { title: a.title })}
          {a.source === 'canvas' && ` ${tr('It is not deleted from Canvas and may return on the next sync.')}`}
        </>
      ),
    })
    if (ok) {
      remove(a.id)
      toast(tr('Assignment deleted'))
      return true
    }
    return false
  }
}
