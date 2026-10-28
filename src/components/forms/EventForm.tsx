import { useState } from 'react'
import { combineLocalDateTime, splitLocalDateTime } from '@/domain/dates'
import { EVENT_KIND_LABEL } from '@/domain/labels'
import type { CalendarEvent, CalendarEventKind } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { Checkbox } from '../ui/Checkbox'
import { Field, Input, Select, Textarea } from '../ui/Field'
import { CourseSelect, trimOrError } from './shared'

export function EventForm({ formId, initial, preset, onDone }: { formId: string; initial?: CalendarEvent; preset?: { courseId?: string | null; day?: string; time?: string }; onDone: (e: CalendarEvent) => void }) {
  const add = useStore((s) => s.addEvent)
  const update = useStore((s) => s.updateEvent)
  const start = splitLocalDateTime(initial?.start ?? null)
  const end = splitLocalDateTime(initial?.end ?? null)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [kind, setKind] = useState<CalendarEventKind>(initial?.kind ?? 'event')
  const [courseId, setCourseId] = useState<string | null>(initial?.courseId ?? preset?.courseId ?? null)
  const [day, setDay] = useState(start.day || preset?.day || '')
  const [allDay, setAllDay] = useState(initial?.allDay ?? false)
  const [startTime, setStartTime] = useState(start.time || preset?.time || '10:00')
  const [endTime, setEndTime] = useState(end.time || '11:00')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const t = trimOrError(title, 'Title')
    if (t) errs.title = t
    const s = day ? combineLocalDateTime(day, allDay ? '00:00' : startTime) : null
    const en = day && !allDay ? combineLocalDateTime(day, endTime) : null
    if (!s) errs.day = 'Choose a date.'
    else if (!allDay && en && new Date(en) <= new Date(s)) errs.end = 'End must be after start.'
    setErrors(errs)
    if (Object.keys(errs).length) return document.getElementById(`${formId}-${Object.keys(errs)[0]}`)?.focus()
    const fields = { title: title.trim(), kind, courseId, start: s as string, end: en, allDay, location: location.trim(), notes: notes.trim() }
    if (initial) {
      update(initial.id, fields)
      toast('Event updated')
      onDone({ ...initial, ...fields })
    } else {
      const created = add({ ...fields, source: 'manual', canvasId: null, linkedAssignmentId: null })
      toast('Event added')
      onDone(created)
    }
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {initial?.source === 'canvas' && <p className="rounded-md bg-accent-soft px-3 py-2 text-xs text-accent-text">From your Canvas calendar. Changes here are local and may be replaced on the next sync.</p>}
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field id={`${formId}-title`} label="Title" error={errors.title}>
          {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chem midterm" data-autofocus />}
        </Field>
        <Field label="Kind">
          {(p) => (
            <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as CalendarEventKind)}>
              {(['exam', 'class', 'event'] as CalendarEventKind[]).map((k) => (
                <option key={k} value={k}>
                  {EVENT_KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field id={`${formId}-day`} label="Date" error={errors.day}>
          {(p) => <Input {...p} type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
        </Field>
        <Field label="Start">{(p) => <Input {...p} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={allDay} />}</Field>
        <Field id={`${formId}-end`} label="End" error={errors.end}>
          {(p) => <Input {...p} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={allDay} />}
        </Field>
      </div>
      <Checkbox checked={allDay} onChange={setAllDay} label="All day" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" optional>
          {(p) => <CourseSelect {...p} value={courseId} onChange={setCourseId} allowNone />}
        </Field>
        <Field label="Location" optional>
          {(p) => <Input {...p} value={location} onChange={(e) => setLocation(e.target.value)} />}
        </Field>
      </div>
      <Field label="Notes" optional>
        {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
      </Field>
    </form>
  )
}
