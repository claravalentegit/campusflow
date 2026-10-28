import { useState } from 'react'
import { combineLocalDateTime, splitLocalDateTime } from '@/domain/dates'
import type { Reminder } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { Field, Input } from '../ui/Field'
import { CourseSelect, trimOrError } from './shared'

export function ReminderForm({ formId, initial, preset, onDone }: { formId: string; initial?: Reminder; preset?: { courseId?: string | null; assignmentId?: string | null; day?: string; time?: string }; onDone: (r: Reminder) => void }) {
  const add = useStore((s) => s.addReminder)
  const update = useStore((s) => s.updateReminder)
  const at = splitLocalDateTime(initial?.remindAt ?? null)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [courseId, setCourseId] = useState<string | null>(initial?.courseId ?? preset?.courseId ?? null)
  const [day, setDay] = useState(at.day || preset?.day || '')
  const [time, setTime] = useState(at.time || preset?.time || '09:00')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const t = trimOrError(title, 'Reminder')
    if (t) errs.title = t
    const remindAt = day ? combineLocalDateTime(day, time) : null
    if (!remindAt) errs.day = 'Choose a date.'
    setErrors(errs)
    if (Object.keys(errs).length) return document.getElementById(`${formId}-${Object.keys(errs)[0]}`)?.focus()
    const fields = { title: title.trim(), courseId, remindAt: remindAt as string }
    if (initial) {
      update(initial.id, fields)
      toast('Reminder updated')
      onDone({ ...initial, ...fields })
    } else {
      const created = add({ ...fields, assignmentId: preset?.assignmentId ?? null, done: false, createdAt: new Date().toISOString() })
      toast('Reminder set')
      onDone(created)
    }
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${formId}-title`} label="Remind me to…" error={errors.title}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Buy lab goggles" data-autofocus />}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id={`${formId}-day`} label="Date" error={errors.day}>
          {(p) => <Input {...p} type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
        </Field>
        <Field label="Time">{(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
      </div>
      <Field label="Course" optional>
        {(p) => <CourseSelect {...p} value={courseId} onChange={setCourseId} allowNone />}
      </Field>
      <p className="text-xs text-fg-3">Reminders appear in your notifications and calendar while CampusFlow is open. Browser push notifications are not enabled.</p>
    </form>
  )
}
