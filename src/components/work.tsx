import type { Assignment } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { confirm } from './ui/Dialog'

export function useDeleteAssignment() {
  const remove = useStore((s) => s.deleteAssignment)
  return async (a: Assignment) => {
    const ok = await confirm({
      title: 'Delete assignment?',
      message: (
        <>
          “{a.title}” and its stages will be removed from CampusFlow. XP you already earned stays.
          {a.source === 'canvas' && ' It is not deleted from Canvas and may return on the next sync.'}
        </>
      ),
    })
    if (ok) {
      remove(a.id)
      toast('Assignment deleted')
      return true
    }
    return false
  }
}
