import { useEffect, useMemo, useState } from 'react'
import { Pause, Timer } from 'lucide-react'
import { recommendNext } from '@/domain/recommend'
import { useCourseMap } from '@/hooks/useData'
import { useStore } from '@/store/appStore'
import { toast, useUi } from '@/store/ui'
import { sfx } from '@/game/fx'
import { CourseTag } from '../course'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, Input, Select } from '../ui/Field'
import { cn } from '../ui/cn'
import { tr, useT } from '@/i18n'

function useRemaining(): number | null {
  const focus = useStore((s) => s.focus)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!focus) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [focus])
  if (!focus) return null
  return Math.max(0, new Date(focus.startedAt).getTime() + focus.durationMinutes * 60000 - Date.now())
}

const fmt = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Watches the running focus session and logs it when time is up, even if the dialog is closed. */
export function FocusWatcher() {
  const remaining = useRemaining()
  const focus = useStore((s) => s.focus)
  const finish = useStore((s) => s.finishFocus)
  const startedAt = focus?.startedAt
  const fresh = !!startedAt && Date.now() - new Date(startedAt).getTime() < 2000
  useEffect(() => {
    if (fresh) sfx.focusStart()
  }, [startedAt, fresh])
  useEffect(() => {
    if (focus && remaining === 0) {
      finish(true)
      sfx.focusDone()
      toast(tr('Focus session complete: {title}', { title: focus.title }), 'success')
    }
  }, [remaining, focus, finish])
  return null
}

export function FocusPill() {
  const remaining = useRemaining()
  const focus = useStore((s) => s.focus)
  const open = useUi((s) => s.setFocusDialogOpen)
  if (!focus || remaining == null) return null
  return (
    <button type="button" onClick={() => open(true)} className="tabular inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent-text transition-colors hover:bg-accent-soft/70" aria-label={tr('Focus session running, {time} left. Open timer', { time: fmt(remaining) })}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50" />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      {fmt(remaining)}
    </button>
  )
}

export function FocusDialog() {
  const open = useUi((s) => s.focusDialogOpen)
  const setOpen = useUi((s) => s.setFocusDialogOpen)
  const focus = useStore((s) => s.focus)
  const startFocus = useStore((s) => s.startFocus)
  const finish = useStore((s) => s.finishFocus)
  const prefs = useStore((s) => s.prefs)
  const assignments = useStore((s) => s.assignments)
  const tasks = useStore((s) => s.tasks)
  const courses = useStore((s) => s.courses)
  const courseMap = useCourseMap()
  const remaining = useRemaining()
  const suggestions = useMemo(() => (open ? recommendNext({ assignments, tasks, courses, prefs }, new Date(), 6) : []), [open, assignments, tasks, courses, prefs])
  const [choice, setChoice] = useState('')
  const [custom, setCustom] = useState('')
  const [minutes, setMinutes] = useState(prefs.focusMinutes)
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  useEffect(() => {
    if (open) {
      setChoice(suggestions[0] ? `${suggestions[0].kind}:${suggestions[0].id}` : 'custom')
      setMinutes(prefs.focusMinutes)
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const start = () => {
    if (choice === 'custom') {
      if (!custom.trim()) return setError(t('Name what you will focus on.'))
      startFocus({ title: custom.trim(), courseId: null, assignmentId: null, taskId: null, durationMinutes: minutes })
    } else {
      const s = suggestions.find((x) => `${x.kind}:${x.id}` === choice)
      if (!s) return
      startFocus({ title: s.title, courseId: s.courseId, assignmentId: s.assignmentId, taskId: s.kind === 'task' ? s.id : null, durationMinutes: minutes })
    }
  }

  const total = focus ? focus.durationMinutes * 60000 : 1
  const pct = remaining != null ? 1 - remaining / total : 0
  const course = focus?.courseId ? courseMap.get(focus.courseId) : undefined

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={focus ? t('Focus session') : t('Start a focus session')}
      size="sm"
      footer={
        focus ? (
          <>
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                finish(false)
                toast(t('Focus session discarded'), 'info')
              }}
            >
              {t('Discard')}
            </Button>
            <Button onClick={() => setOpen(false)}>{t('Hide')}</Button>
            <Button
              variant="primary"
              icon={Pause}
              onClick={() => {
                finish(true)
                setOpen(false)
                toast(t('Focus session saved'))
              }}
            >
              {t('End & log')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setOpen(false)}>{t('Cancel')}</Button>
            <Button variant="primary" icon={Timer} onClick={start}>
              {t('Start {n} min', { n: minutes })}
            </Button>
          </>
        )
      }
    >
      {focus && remaining != null ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="relative size-40">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${pct * 282.7} 282.7`} className="transition-[stroke-dasharray] duration-1000 ease-linear" />
            </svg>
            <span className="tabular absolute inset-0 flex items-center justify-center text-3xl font-semibold" role="timer" aria-live="off">
              {fmt(remaining)}
            </span>
          </div>
          <div>
            <p className="font-medium">{focus.title}</p>
            {course && <CourseTag course={course} className="mt-1 justify-center" />}
          </div>
          <p className="text-xs text-fg-3">{t('Every focused minute earns 1 XP.')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-fg-2">{t('Focus on')}</legend>
            {suggestions.map((s) => (
              <label key={s.id} className={cn('flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors', choice === `${s.kind}:${s.id}` ? 'border-accent bg-accent-soft/50' : 'border-line hover:bg-surface-2')}>
                <input type="radio" name="focus-choice" className="accent-[var(--accent)]" checked={choice === `${s.kind}:${s.id}`} onChange={() => setChoice(`${s.kind}:${s.id}`)} />
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <CourseTag course={s.courseId ? courseMap.get(s.courseId) : undefined} />
              </label>
            ))}
            <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm', choice === 'custom' ? 'border-accent bg-accent-soft/50' : 'border-line hover:bg-surface-2')}>
              <input type="radio" name="focus-choice" className="accent-[var(--accent)]" checked={choice === 'custom'} onChange={() => setChoice('custom')} />
              {t('Something else')}
            </label>
            {choice === 'custom' && <Input aria-label={t('What will you focus on?')} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="What will you focus on?" autoFocus />}
            {error && <p className="text-xs text-danger" role="alert">{error}</p>}
          </fieldset>
          <Field label="Length">
            {(p) => (
              <Select {...p} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[15, 25, 45, 50, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {t('{n} minutes', { n: m })}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}
    </Dialog>
  )
}
