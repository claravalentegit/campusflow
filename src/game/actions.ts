import { useCallback, useEffect, useRef, useState } from 'react'
import { checklistProgress, isAssignmentDone } from '@/domain/assignments'
import type { Assignment, StudyTask } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { celebrateCompletion, sfx } from './fx'

/** Complete (or reopen) an assignment with the full reward treatment and an Undo. */
export function completeAssignment(a: Assignment, el: Element | null) {
  const st = useStore.getState()
  if (isAssignmentDone(a)) {
    st.setAssignmentStatus(a.id, checklistProgress(st.tasks, a.id).done ? 'in_progress' : 'not_started')
    sfx.undo()
    toast(`Reopened “${a.title}”`, 'info')
    return
  }
  const prev = a.status
  const ev = st.setAssignmentStatus(a.id, 'completed')
  if (!ev) return
  celebrateCompletion(el, ev.amount, { boss: ev.boss })
  toast(ev.boss ? `Boss defeated! +${ev.amount} XP` : `+${ev.amount} XP · ${a.title}`, 'success', {
    label: 'Undo',
    run: () => {
      useStore.getState().setAssignmentStatus(a.id, prev)
      sfx.undo()
    },
  })
}

/** Complete (or un-complete) a task or assignment step. */
export function completeTask(t: StudyTask, el: Element | null) {
  const st = useStore.getState()
  const ev = st.toggleTask(t.id)
  if (!ev) {
    sfx.undo()
    return
  }
  celebrateCompletion(el, ev.amount)
  toast(`+${ev.amount} XP · ${t.title}`, 'success', {
    label: 'Undo',
    run: () => {
      useStore.getState().toggleTask(t.id)
      sfx.undo()
    },
  })
}

/**
 * Keeps just-finished items on screen briefly so the checkmark and effects play
 * before the row slides away.
 */
export function useLinger(ms = 900) {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const t = timers.current
    return () => t.forEach(clearTimeout)
  }, [])
  const linger = useCallback(
    (id: string) => {
      setIds((s) => new Set(s).add(id))
      clearTimeout(timers.current.get(id))
      timers.current.set(
        id,
        setTimeout(() => {
          setIds((s) => {
            const n = new Set(s)
            n.delete(id)
            return n
          })
        }, ms),
      )
    },
    [ms],
  )
  return { lingering: ids, linger }
}
