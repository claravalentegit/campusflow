import { useCallback, useEffect, useRef, useState } from 'react'
import { canCheckOff, checklistProgress, isAssignmentDone } from '@/domain/assignments'
import { syncCanvas } from '@/integrations/canvas/sync'
import type { Assignment, StudyTask } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { celebrateCompletion, sfx } from './fx'
import { tr } from '@/i18n/core'

/** Skip an assignment: it leaves CampusFlow (not Canvas), with an Undo. */
export function skipAssignment(a: Assignment) {
  sfx.swish()
  useStore.getState().skipAssignment(a.id)
  toast(tr('Skipped “{title}”. It’s still on Canvas.', { title: a.title }), 'info', {
    label: tr('Undo'),
    run: () => {
      useStore.getState().unskipAssignment(a.id)
      sfx.pop()
    },
  })
}

/**
 * Not turned in on Canvas yet: say so, and check Canvas once more in case it was just submitted
 * (if it was, the sync checks it off and gives the XP).
 */
function refuseUntilSubmitted(a: Assignment) {
  sfx.nope()
  toast(tr('Not turned in on Canvas yet. Turn it in on Canvas first, then it checks off by itself.'), 'error', a.htmlUrl ? { label: tr('Open in Canvas'), run: () => window.open(a.htmlUrl!, '_blank', 'noopener') } : undefined)
  void syncCanvas({ silent: true }).then((r) => {
    const now = useStore.getState().assignments.find((x) => x.id === a.id)
    if (r && now && isAssignmentDone(now)) toast(tr('Canvas shows “{title}” as turned in. Checked off!', { title: a.title }), 'success')
  })
}

/**
 * Complete (or reopen) an assignment with the full reward treatment and an Undo.
 * Returns false when it can't be checked off yet (a Canvas assignment that isn't turned in).
 */
export function completeAssignment(a: Assignment, el: Element | null): boolean {
  const st = useStore.getState()
  if (!canCheckOff(a)) {
    refuseUntilSubmitted(a)
    return false
  }
  if (isAssignmentDone(a) && a.status !== 'completed' && a.status !== 'submitted') {
    // Done because Canvas says it's turned in: that can't be undone from here.
    toast(tr('Canvas shows this as turned in, so it stays checked.'), 'info')
    return false
  }
  if (isAssignmentDone(a)) {
    st.setAssignmentStatus(a.id, checklistProgress(st.tasks, a.id).done ? 'in_progress' : 'not_started')
    sfx.undo()
    toast(tr('Reopened “{title}”', { title: a.title }), 'info')
    return true
  }
  const prev = a.status
  const ev = st.setAssignmentStatus(a.id, 'completed')
  if (!ev) return true
  celebrateCompletion(el, ev.amount, { boss: ev.boss })
  toast(ev.boss ? tr('Boss defeated! +{n} XP', { n: ev.amount }) : `+${ev.amount} XP · ${a.title}`, 'success', {
    label: tr('Undo'),
    run: () => {
      useStore.getState().setAssignmentStatus(a.id, prev)
      sfx.undo()
    },
  })
  return true
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
    label: tr('Undo'),
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
