import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { format, startOfDay } from 'date-fns'
import { ArrowLeft, BellPlus, CalendarPlus, Crown, ExternalLink, Link2, MoreHorizontal, Pencil, Plus, RotateCcw, Sparkles, Swords, Timer, Trash2, Wand2, X } from 'lucide-react'
import { checklistProgress, isAssignmentDone, isAssignmentOverdue, tasksForAssignment } from '@/domain/assignments'
import { formatRelative, parseInstant, parseLocalDay } from '@/domain/dates'
import { isBoss, xpForAssignmentNow, xpForTaskNow } from '@/domain/game'
import { canvasSubmissionLabel } from '@/domain/labels'
import type { Assignment, StudyTask } from '@/domain/types'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { useUi } from '@/store/ui'
import { completeAssignment, completeTask } from '@/game/actions'
import { CourseDot, courseColor } from '@/components/course'
import { CheckButton, ProgressBar, XpChip } from '@/components/game/GameUI'
import { Page, usePageTitle } from '@/components/Page'
import { useDeleteAssignment } from '@/components/work'
import { Button, IconButton } from '@/components/ui/Button'
import { confirm } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Field'
import { Menu } from '@/components/ui/Menu'
import { cn } from '@/components/ui/cn'
import { NotFound } from './NotFound'

export function AssignmentDetail() {
  const { assignmentId } = useParams()
  const now = useNow(30_000)
  const navigate = useNavigate()
  const a = useStore((s) => s.assignments.find((x) => x.id === assignmentId))
  const course = useStore((s) => s.courses.find((c) => c.id === a?.courseId))
  const tasks = useStore((s) => s.tasks)
  const startFocus = useStore((s) => s.startFocus)
  const edit = useUi((s) => s.edit)
  const openBreakdown = useUi((s) => s.openBreakdown)
  const openQuickAdd = useUi((s) => s.openQuickAdd)
  const setFocusDialogOpen = useUi((s) => s.setFocusDialogOpen)
  const del = useDeleteAssignment()
  const mainBtn = useRef<HTMLButtonElement>(null)
  const [cleared, setCleared] = useState<string | null>(null)
  usePageTitle(a?.title ?? 'Not found')
  if (!a) return <NotFound what="assignment" />

  const done = isAssignmentDone(a)
  const boss = isBoss(a, tasks)
  const steps = tasksForAssignment(tasks, a.id)
  const progress = checklistProgress(tasks, a.id)
  const nextStep = steps.find((s) => !s.done)
  const overdue = isAssignmentOverdue(a, now)
  const xp = xpForAssignmentNow(a, tasks, now)
  const hp = done ? 1 : progress.total ? progress.done / (progress.total + 1) : 0

  const clearStep = (t: StudyTask, el: HTMLElement) => {
    if (!t.done) {
      setCleared(t.id)
      setTimeout(() => setCleared((c) => (c === t.id ? null : c)), 1400)
    }
    completeTask(t, el)
  }

  return (
    <Page className="max-w-5xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-extrabold text-fg-3 hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden /> Back
        </button>
        <div className="flex gap-1">
          <IconButton icon={Pencil} label="Edit details" onClick={() => edit({ kind: 'assignment', id: a.id })} />
          <Menu
            items={[
              { label: 'Schedule study time', icon: CalendarPlus, onSelect: () => openQuickAdd({ kind: 'session', courseId: a.courseId, assignmentId: a.id }) },
              { label: 'Set a reminder', icon: BellPlus, onSelect: () => openQuickAdd({ kind: 'reminder', courseId: a.courseId, assignmentId: a.id }) },
              ...(a.htmlUrl ? [{ label: 'Open in Canvas', icon: ExternalLink, onSelect: () => window.open(a.htmlUrl!, '_blank', 'noopener') }] : []),
              'separator' as const,
              { label: 'Delete', icon: Trash2, tone: 'danger' as const, onSelect: async () => { if (await del(a)) navigate('/') } },
            ]}
            trigger={(p) => <IconButton icon={MoreHorizontal} label="More actions" {...p} />}
          />
        </div>
      </div>

      {/* Header: boss fight or regular quest */}
      <motion.header
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className={cn(
          'btn-3d relative overflow-hidden rounded-[28px] p-6 [--press:rgb(0_0_0/0.25)] sm:p-7',
          boss ? 'bg-gradient-to-br from-[#2b1d63] to-[#4a2bb8] text-white' : 'border-2 border-line bg-surface',
        )}
        style={boss ? undefined : { boxShadow: `inset 0 -5px 0 ${courseColor(course?.color)}` }}
      >
        {boss && <span aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/5" />}
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className={cn('flex flex-wrap items-center gap-x-1.5 text-xs font-black tracking-[0.14em] uppercase', boss ? 'text-[#ffcf4d]' : 'text-fg-3')}>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                {boss ? <Crown className="size-4" aria-hidden /> : <Swords className="size-4" aria-hidden />}
                {boss ? 'Boss level' : 'Quest'} ·
              </span>
              <Link to={`/courses/${a.courseId}`} className="whitespace-nowrap hover:underline">
                {course?.name}
              </Link>
            </p>
            <h1 className="mt-1 text-3xl leading-tight font-black tracking-tight sm:text-4xl">{a.title}</h1>
            <p className={cn('mt-1.5 text-base font-bold', boss ? 'text-[#d8d0ff]' : 'text-fg-2')}>
              {a.dueAt ? (
                <>
                  Due {format(parseInstant(a.dueAt)!, 'EEE, MMM d · h:mm a')}{' '}
                  <span className={cn(overdue && !done && (boss ? 'text-[#ff9b9b]' : 'text-danger'))}>· {overdue && !done ? 'late, half XP' : done ? 'done' : formatRelative(a.dueAt, now)}</span>
                </>
              ) : (
                'No due date'
              )}
            </p>
          </div>
          <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.2, stiffness: 300, damping: 12 }}>
            <XpChip amount={xp} tone={boss ? 'gold' : 'gold'} className="h-9 px-4 text-base" />
          </motion.span>
        </div>
        <div className="relative mt-5 flex items-center gap-3">
          <span className="text-xs font-black tracking-wider uppercase opacity-80">{boss ? 'Boss HP' : 'Progress'}</span>
          <ProgressBar value={boss ? 1 - hp : hp} tone={boss ? (hp > 0.5 ? 'fire' : 'purple') : 'green'} height="h-4" className={cn('flex-1', boss && 'bg-white/15')} label={boss ? 'Boss health' : 'Progress'} />
          <span className="tabular text-sm font-black">{done ? (boss ? 'Defeated!' : 'Done!') : progress.total ? `${progress.done} / ${progress.total} stages` : 'Not started'}</span>
        </div>
      </motion.header>

      {/* Main action */}
      <div className="mt-5 flex flex-wrap gap-3">
        {done ? (
          <Button variant="secondary" size="lg" icon={RotateCcw} onClick={(e) => completeAssignment(a, e.currentTarget)}>
            Reopen
          </Button>
        ) : nextStep ? (
          <Button ref={mainBtn} variant="success" size="lg" icon={Sparkles} className="max-w-full" onClick={(e) => clearStep(nextStep, e.currentTarget)}>
            <span className="truncate">
              Clear stage {steps.indexOf(nextStep) + 1}: {nextStep.title}
            </span>
          </Button>
        ) : (
          <Button ref={mainBtn} variant={boss ? 'primary' : 'success'} size="lg" icon={boss ? Crown : Sparkles} onClick={(e) => completeAssignment(a, e.currentTarget)}>
            {boss ? 'Defeat the boss' : 'Complete'} · +{xp} XP
          </Button>
        )}
        {!done && (
          <Button
            variant="secondary"
            size="lg"
            icon={Timer}
            onClick={() => {
              startFocus({ title: nextStep?.title ?? a.title, courseId: a.courseId, assignmentId: a.id, taskId: nextStep?.id ?? null })
              setFocusDialogOpen(true)
            }}
          >
            Focus 25 min
          </Button>
        )}
        {!done && nextStep && progress.done === progress.total - 1 && (
          <p className="self-center text-sm font-bold text-fg-3">Last stage! Then the {boss ? 'boss' : 'quest'} is yours.</p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Stages a={a} steps={steps} now={now} nextStepId={nextStep?.id} cleared={cleared} onClear={clearStep} onSuggest={() => openBreakdown(a.id)} done={done} />
        <aside className="flex min-w-0 flex-col gap-5">
          <Briefing a={a} />
          <Notes a={a} />
          {a.links.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">Links</h2>
              <ul className="card-3d divide-y-2 divide-line overflow-hidden">
                {a.links.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-accent-text hover:bg-surface-2">
                      <Link2 className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{l.label}</span>
                      <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-60" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-xs font-semibold text-fg-3" data-testid="submission-notice">
            Checking it off here is your own tracking and does not submit anything to Canvas. Canvas: {canvasSubmissionLabel(a.canvasSubmission)}.
            {a.htmlUrl && (
              <>
                {' '}
                <a href={a.htmlUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-accent-text hover:underline">
                  Open in Canvas
                </a>
              </>
            )}
          </p>
        </aside>
      </div>
    </Page>
  )
}

function Stages({ a, steps, now, nextStepId, cleared, onClear, onSuggest, done }: { a: Assignment; steps: StudyTask[]; now: Date; nextStepId?: string; cleared: string | null; onClear: (t: StudyTask, el: HTMLElement) => void; onSuggest: () => void; done: boolean }) {
  const addTask = useStore((s) => s.addTask)
  const updateTask = useStore((s) => s.updateTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const [draft, setDraft] = useState('')
  const due = parseInstant(a.dueAt)

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    addTask({ title: draft.trim(), courseId: a.courseId, assignmentId: a.id, plannedFor: null, dueAt: null, estimatedMinutes: null, priority: a.priority, done: false, position: Math.max(-1, ...steps.map((s) => s.position)) + 1, createdAt: new Date().toISOString(), completedAt: null })
    setDraft('')
  }

  return (
    <section aria-labelledby="stages-title" className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="stages-title" className="text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
          Stages
        </h2>
        <Button size="sm" variant="ghost" icon={Wand2} onClick={onSuggest}>
          Suggest stages
        </Button>
      </div>
      {steps.length === 0 && (
        <div className="card-3d mb-3 px-5 py-5 text-sm font-semibold text-fg-2">
          Split it into small stages and earn XP for each one. Add your own below, or let CampusFlow suggest some you can edit.
          <div className="mt-3">
            <Button size="sm" variant="primary" icon={Wand2} onClick={onSuggest}>
              Suggest stages
            </Button>
          </div>
        </div>
      )}
      <motion.ol layout className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {steps.map((t, i) => {
            const current = t.id === nextStepId && !done
            const planned = parseLocalDay(t.plannedFor)
            const late = due && planned && startOfDay(planned) > startOfDay(due)
            return (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: -10 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30, delay: Math.min(i * 0.04, 0.3) }}
                className={cn('card-3d group relative flex items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4', current && 'border-accent bg-accent-soft/40', t.done && 'opacity-70')}
              >
                {current && <span aria-hidden className="pulse-ring pointer-events-none absolute inset-0 rounded-[18px] [--pulse:var(--accent)]" />}
                <CheckButton checked={t.done} label={t.done ? `Undo ${t.title}` : `Clear stage ${i + 1}: ${t.title}`} onToggle={(el) => onClear(t, el)} />
                <span className={cn('tabular grid size-7 shrink-0 place-items-center rounded-lg text-xs font-black max-sm:hidden', t.done ? 'bg-success-soft text-success' : current ? 'bg-accent text-white' : 'bg-surface-2 text-fg-3')}>{i + 1}</span>
                <StepTitle t={t} onRename={(title) => updateTask(t.id, { title })} />
                <label className="sr-only" htmlFor={`plan-${t.id}`}>
                  Day for {t.title}
                </label>
                <input id={`plan-${t.id}`} type="date" value={t.plannedFor ?? ''} onChange={(e) => updateTask(t.id, { plannedFor: e.target.value || null })} className={cn('hidden h-8 w-34 shrink-0 rounded-lg border-2 border-transparent bg-transparent px-1 text-xs font-bold hover:border-line focus:border-accent focus:outline-none sm:block', late ? 'text-warn' : 'text-fg-3')} />
                <XpChip amount={xpForTaskNow(t, a, now)} tone={t.done ? 'muted' : 'gold'} />
                <IconButton
                  icon={X}
                  size="sm"
                  label={`Remove stage ${t.title}`}
                  tooltip={false}
                  className="-mr-1 opacity-60 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                  onClick={async () => {
                    if (await confirm({ title: 'Remove stage?', message: `“${t.title}” will be removed.`, confirmLabel: 'Remove' })) deleteTask(t.id)
                  }}
                />
                <AnimatePresence>
                  {cleared === t.id && (
                    <motion.span
                      aria-hidden
                      initial={{ opacity: 0, scale: 0.4, y: 0 }}
                      animate={{ opacity: 1, scale: 1, y: -28 }}
                      exit={{ opacity: 0, y: -48 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                      className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 rounded-full bg-success-bright px-3 py-1 text-xs font-black whitespace-nowrap text-white shadow-md"
                    >
                      Stage cleared!
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </motion.ol>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <Input aria-label="New stage" placeholder="Add a stage and press Enter" value={draft} onChange={(e) => setDraft(e.target.value)} className="h-11 rounded-xl border-2" />
        <Button type="submit" variant="secondary" icon={Plus} disabled={!draft.trim()} className="h-11">
          Add
        </Button>
      </form>
    </section>
  )
}

function StepTitle({ t, onRename }: { t: StudyTask; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  if (editing)
    return (
      <Input
        autoFocus
        aria-label="Stage title"
        defaultValue={t.title}
        className="h-8 flex-1"
        onBlur={(e) => {
          if (e.target.value.trim()) onRename(e.target.value.trim())
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            e.stopPropagation()
            setEditing(false)
          }
        }}
      />
    )
  return (
    <button type="button" onClick={() => setEditing(true)} title="Click to rename" className={cn('min-w-0 flex-1 truncate text-left text-base font-extrabold', t.done && 'text-fg-3 line-through decoration-2')}>
      {t.title}
    </button>
  )
}

function Briefing({ a }: { a: Assignment }) {
  const edit = useUi((s) => s.edit)
  const empty = !a.description && !a.submissionInstructions && !a.rubricNotes
  return (
    <section>
      <h2 className="mb-2 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">Mission briefing</h2>
      <div className="card-3d flex flex-col gap-3 px-4 py-4 text-sm leading-relaxed font-semibold text-fg-2">
        {empty ? (
          <p>
            No instructions yet. Check Canvas Pages, Files and the syllabus, then{' '}
            <button type="button" className="font-extrabold text-accent-text hover:underline" onClick={() => edit({ kind: 'assignment', id: a.id })}>
              add the key requirements
            </button>
            .
          </p>
        ) : (
          <>
            {a.description && <p className="whitespace-pre-line text-fg">{a.description}</p>}
            {a.submissionInstructions && (
              <p>
                <b className="font-black text-fg">How to submit:</b> {a.submissionInstructions}
              </p>
            )}
            {a.rubricNotes && (
              <p>
                <b className="font-black text-fg">Grading:</b> {a.rubricNotes}
              </p>
            )}
          </>
        )}
        <p className="flex items-center gap-1.5 text-xs text-fg-3">
          <CourseDot color={useStore.getState().courses.find((c) => c.id === a.courseId)?.color} />
          {a.pointsPossible != null ? `${a.pointsPossible} points` : 'Points not set'}
        </p>
      </div>
    </section>
  )
}

function Notes({ a }: { a: Assignment }) {
  const update = useStore((s) => s.updateAssignment)
  const [text, setText] = useState(a.personalNotes)
  const [saved, setSaved] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(text)
  latest.current = text
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        update(a.id, { personalNotes: latest.current })
      }
    },
    [a.id, update],
  )
  return (
    <section>
      <h2 className="mb-2 flex items-center justify-between text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
        My notes <span className="tracking-normal normal-case" aria-live="polite">{saved ? '' : 'Saving…'}</span>
      </h2>
      <Textarea
        aria-label="My notes"
        value={text}
        rows={4}
        placeholder="Questions for office hours, ideas, things to double-check…"
        className="card-3d rounded-[18px] border-2 border-b-4 px-4 py-3 text-sm font-semibold"
        onChange={(e) => {
          setText(e.target.value)
          setSaved(false)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            update(a.id, { personalNotes: e.target.value })
            timer.current = undefined
            setSaved(true)
          }, 500)
        }}
      />
    </section>
  )
}
