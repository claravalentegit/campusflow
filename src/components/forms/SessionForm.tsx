import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { combineLocalDateTime, parseInstant, splitLocalDateTime } from '@/domain/dates'
import type { StudySession } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { Field, Input } from '../ui/Field'
import { AssignmentSelect, CourseSelect, trimOrError } from './shared'

export function SessionForm({ formId, initial, preset, onDone }: { formId: string; initial?: StudySession; preset?: { courseId?: string | null; assignmentId?: string | null; day?: string; time?: string }; onDone: (s: StudySession) => void }) {
  const add = useStore((s) => s.addSession)
  const update = useStore((s) => s.updateSession)
  const sessions = useStore((s) => s.sessions)
  const events = useStore((s) => s.events)
  const assignments = useStore((s) => s.assignments)
  const start = splitLocalDateTime(initial?.start ?? null)
  const end = splitLocalDateTime(initial?.end ?? null)
  const defaultStart = preset?.time ?? '15:00'
  const [title, setTitle] = useState(initial?.title ?? '')
  const [courseId, setCourseId] = useState<string | null>(initial?.courseId ?? preset?.courseId ?? null)
  const [assignmentId, setAssignmentId] = useState<string | null>(initial?.assignmentId ?? preset?.assignmentId ?? null)
  const [day, setDay] = useState(start.day || preset?.day || '')
  const [startTime, setStartTime] = useState(start.time || defaultStart)
  const [endTime, setEndTime] = useState(end.time || `${String(Math.min(23, Number(defaultStart.slice(0, 2)) + 1)).padStart(2, '0')}${defaultStart.slice(2)}`)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const startAt = day ? combineLocalDateTime(day, startTime) : null
  const endAt = day ? combineLocalDateTime(day, endTime) : null

  const conflicts = useMemo(() => {
    const s = parseInstant(startAt)
    const e = parseInstant(endAt)
    if (!s || !e || e <= s) return []
    const overlaps = (a: Date | null, b: Date | null) => !!a && !!b && a < e && b > s
    return [
      ...sessions.filter((x) => x.id !== initial?.id && overlaps(parseInstant(x.start), parseInstant(x.end))).map((x) => x.title),
      ...events.filter((x) => !x.allDay && overlaps(parseInstant(x.start), parseInstant(x.end ?? x.start))).map((x) => x.title),
    ]
  }, [startAt, endAt, sessions, events, initial?.id])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const t = trimOrError(title, 'Title')
    if (t) errs.title = t
    if (!day || !startAt) errs.day = 'Choose a date.'
    else {
      const end = parseInstant(endAt)
      const start = parseInstant(startAt)
      if (!end || !start || end.getTime() <= start.getTime()) errs.end = 'End time must be after the start time.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return document.getElementById(`${formId}-${Object.keys(errs)[0]}`)?.focus()
    const linked = assignmentId ? assignments.find((a) => a.id === assignmentId) : undefined
    const fields = { title: title.trim(), courseId: linked?.courseId ?? courseId, assignmentId, start: startAt as string, end: endAt as string }
    if (initial) {
      update(initial.id, fields)
      toast('Study session updated')
      onDone({ ...initial, ...fields })
    } else {
      const created = add({ ...fields, taskId: null, completed: false, logged: false })
      toast('Study session added to your calendar')
      onDone(created)
    }
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${formId}-title`} label="What will you study?" error={errors.title}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review chapter 14 for Midterm 2" data-autofocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" optional>
          {(p) => <CourseSelect {...p} value={courseId} onChange={(v) => { setCourseId(v); setAssignmentId(null) }} allowNone />}
        </Field>
        <Field label="For assignment" optional>
          {(p) => <AssignmentSelect {...p} value={assignmentId} onChange={setAssignmentId} courseId={courseId} />}
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field id={`${formId}-day`} label="Date" error={errors.day}>
          {(p) => <Input {...p} type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
        </Field>
        <Field label="Start">{(p) => <Input {...p} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}</Field>
        <Field id={`${formId}-end`} label="End" error={errors.end}>
          {(p) => <Input {...p} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
        </Field>
      </div>
      {conflicts.length > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Overlaps with {conflicts.slice(0, 2).join(', ')}
          {conflicts.length > 2 ? ` and ${conflicts.length - 2} more` : ''}. You can still save it.
        </p>
      )}
    </form>
  )
}
