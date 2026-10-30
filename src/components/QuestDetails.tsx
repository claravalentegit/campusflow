import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ExternalLink, Lock, Pencil, Plus, SkipForward, Timer, Trash2, Wand2, X } from 'lucide-react'
import { lockText } from '@/components/LockTag'
import { isAssignmentDone, tasksForAssignment } from '@/domain/assignments'
import { parseInstant } from '@/domain/dates'
import { xpForTaskNow } from '@/domain/game'
import { canvasSubmissionLabel } from '@/domain/labels'
import type { Assignment, StudyTask } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { useUi } from '@/store/ui'
import { completeTask, skipAssignment } from '@/game/actions'
import { sfx } from '@/game/fx'
import { CheckButton, XpChip } from '@/components/game/GameUI'
import { useDeleteAssignment } from '@/components/work'
import { Button, IconButton } from '@/components/ui/Button'
import { confirm } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { cn } from '@/components/ui/cn'
import { fmtDate, useT } from '@/i18n'

/** Everything about one assignment, opened in place inside its row: what it is, its stages, and actions. */
export function AssignmentDetails({ a, now }: { a: Assignment; now: Date }) {
  const tasks = useStore((s) => s.tasks)
  const addTask = useStore((s) => s.addTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const startFocus = useStore((s) => s.startFocus)
  const edit = useUi((s) => s.edit)
  const openBreakdown = useUi((s) => s.openBreakdown)
  const setFocusDialogOpen = useUi((s) => s.setFocusDialogOpen)
  const del = useDeleteAssignment()
  const [draft, setDraft] = useState('')
  const [cleared, setCleared] = useState<string | null>(null)
  const steps = tasksForAssignment(tasks, a.id)
  const nextStep = steps.find((s) => !s.done)
  const done = isAssignmentDone(a)
  const due = parseInstant(a.dueAt)
  const lock = lockText(a, now)
  const t = useT()

  const clear = (t: StudyTask, el: HTMLElement) => {
    if (!t.done) {
      setCleared(t.id)
      setTimeout(() => setCleared((c) => (c === t.id ? null : c)), 1400)
    }
    completeTask(t, el)
  }
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    addTask({ title: draft.trim(), courseId: a.courseId, assignmentId: a.id, plannedFor: null, dueAt: null, estimatedMinutes: null, priority: a.priority, done: false, position: Math.max(-1, ...steps.map((s) => s.position)) + 1, createdAt: new Date().toISOString(), completedAt: null })
    setDraft('')
    sfx.add()
  }

  return (
    <div className="flex flex-col gap-4 border-t-2 border-dashed border-line px-4 pt-4 pb-4 sm:px-5" data-testid="quest-details">
      <p className="text-sm font-bold text-fg-2">
        {due ? t('Due {when}', { when: fmtDate(due, 'EEEE, MMM d · h:mm a') }) : t('No due date')}
        {a.pointsPossible != null && ` · ${t('{n} points', { n: a.pointsPossible })}`}
      </p>
      {lock && (
        <p className={cn('flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-bold', lock.closed ? 'bg-surface-2 text-fg-2' : 'bg-[#e7f0ff] text-[#2f5fcf]')} data-testid="lock-notice">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {lock.detail}
        </p>
      )}
      {a.description && <p className="line-clamp-4 text-sm leading-relaxed font-semibold whitespace-pre-line text-fg-2">{a.description}</p>}

      <section aria-label={t('Stages')}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-black tracking-[0.12em] text-fg-3 uppercase">{t('Stages')} {steps.length > 0 && `· ${steps.filter((s) => s.done).length} / ${steps.length}`}</h3>
          <Button size="sm" variant="ghost" icon={Wand2} onClick={() => openBreakdown(a.id)}>
            {t('Suggest stages')}
          </Button>
        </div>
        {steps.length === 0 && <p className="mb-2 text-sm font-semibold text-fg-3">{t('Split it into small stages and earn XP for each one.')}</p>}
        <motion.ol layout className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {steps.map((st, i) => (
              <motion.li
                key={st.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={cn('group relative flex items-center gap-2.5 rounded-xl bg-surface-2 px-2.5 py-1.5', st.id === nextStep?.id && !done && 'ring-2 ring-accent/40', st.done && 'opacity-70')}
              >
                <CheckButton checked={st.done} label={st.done ? t('Undo {title}', { title: st.title }) : t('Clear stage {n}: {title}', { n: i + 1, title: st.title })} onToggle={(el) => clear(st, el)} />
                <span className={cn('min-w-0 flex-1 truncate text-sm font-extrabold', st.done && 'text-fg-3 line-through')}>{st.title}</span>
                <XpChip amount={xpForTaskNow(st, a, now)} tone={st.done ? 'muted' : 'gold'} />
                <IconButton
                  icon={X}
                  size="sm"
                  label={t('Remove stage {title}', { title: st.title })}
                  tooltip={false}
                  className="-mr-1 opacity-60 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                  onClick={async () => {
                    if (await confirm({ title: t('Remove stage?'), message: t('“{title}” will be removed.', { title: st.title }), confirmLabel: t('Remove') })) deleteTask(st.id)
                  }}
                />
                <AnimatePresence>
                  {cleared === st.id && (
                    <motion.span
                      aria-hidden
                      initial={{ opacity: 0, scale: 0.4, y: 0 }}
                      animate={{ opacity: 1, scale: 1, y: -24 }}
                      exit={{ opacity: 0, y: -40 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                      className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 rounded-full bg-success-bright px-3 py-1 text-xs font-black whitespace-nowrap text-white shadow-md"
                    >
                      {t('Stage cleared!')}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ol>
        <form onSubmit={add} className="mt-2 flex gap-2">
          <Input aria-label={t('New stage')} placeholder={t('Add a stage and press Enter')} value={draft} onChange={(e) => setDraft(e.target.value)} className="h-10" />
          <Button type="submit" variant="secondary" icon={Plus} disabled={!draft.trim()} className="h-10">
            {t('Add')}
          </Button>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        {!done && (
          <Button
            variant="primary"
            icon={Timer}
            onClick={() => {
              startFocus({ title: nextStep?.title ?? a.title, courseId: a.courseId, assignmentId: a.id, taskId: nextStep?.id ?? null })
              setFocusDialogOpen(true)
            }}
          >
            {t('Focus 25 min')}
          </Button>
        )}
        {a.htmlUrl && (
          <a href={a.htmlUrl} target="_blank" rel="noopener noreferrer" className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-sm font-extrabold [--press:var(--line)]">
            {t('Open in Canvas')} <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
        <Button variant="ghost" icon={Pencil} onClick={() => edit({ kind: 'assignment', id: a.id })}>
          {t('Edit details')}
        </Button>
        {!done && (
          <Button variant="ghost" icon={SkipForward} onClick={() => skipAssignment(a)}>
            {t('Skip')}
          </Button>
        )}
        <IconButton icon={Trash2} label={t('Delete')} onClick={() => void del(a)} />
      </div>
      <p className="text-xs font-semibold text-fg-3" data-testid="submission-notice">
        {t('Checking it off here is your own tracking and does not submit anything to Canvas.')} Canvas: {canvasSubmissionLabel(a.canvasSubmission)}.
      </p>
    </div>
  )
}

/** A to-do or a stage, opened in place. */
export function TaskDetails({ t, parent }: { t: StudyTask; parent?: Assignment }) {
  const startFocus = useStore((s) => s.startFocus)
  const deleteTask = useStore((s) => s.deleteTask)
  const edit = useUi((s) => s.edit)
  const setFocusDialogOpen = useUi((s) => s.setFocusDialogOpen)
  const tt = useT()
  return (
    <div className="flex flex-col gap-3 border-t-2 border-dashed border-line px-4 pt-3 pb-4 sm:px-5" data-testid="quest-details">
      {parent && <p className="text-sm font-bold text-fg-2">{tt('A stage of {title}', { title: parent.title })}</p>}
      <div className="flex flex-wrap gap-2">
        {!t.done && (
          <Button
            variant="primary"
            icon={Timer}
            onClick={() => {
              startFocus({ title: t.title, courseId: t.courseId, assignmentId: t.assignmentId, taskId: t.id })
              setFocusDialogOpen(true)
            }}
          >
            {tt('Focus 25 min')}
          </Button>
        )}
        <Button variant="ghost" icon={Pencil} onClick={() => edit({ kind: 'task', id: t.id })}>
          {tt('Edit')}
        </Button>
        <IconButton
          icon={Trash2}
          label={tt('Delete')}
          onClick={async () => {
            if (await confirm({ title: tt('Delete this?'), message: tt('“{title}” will be removed.', { title: t.title }), confirmLabel: tt('Delete') })) deleteTask(t.id)
          }}
        />
      </div>
    </div>
  )
}
