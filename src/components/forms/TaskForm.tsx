import { useState } from 'react'
import { combineLocalDateTime, splitLocalDateTime } from '@/domain/dates'
import type { Priority, StudyTask } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { Field, Input } from '../ui/Field'
import { AssignmentSelect, CourseSelect, EstimateSelect, PrioritySelect, trimOrError } from './shared'

export function TaskForm({ formId, initial, preset, onDone }: { formId: string; initial?: StudyTask; preset?: { courseId?: string | null; assignmentId?: string | null; day?: string }; onDone: (t: StudyTask) => void }) {
  const add = useStore((s) => s.addTask)
  const update = useStore((s) => s.updateTask)
  const assignments = useStore((s) => s.assignments)
  const tasks = useStore((s) => s.tasks)
  const due = splitLocalDateTime(initial?.dueAt ?? null)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [courseId, setCourseId] = useState<string | null>(initial?.courseId ?? preset?.courseId ?? null)
  const [assignmentId, setAssignmentId] = useState<string | null>(initial?.assignmentId ?? preset?.assignmentId ?? null)
  const [plannedFor, setPlannedFor] = useState(initial?.plannedFor ?? preset?.day ?? '')
  const [dueDay, setDueDay] = useState(due.day)
  const [dueTime, setDueTime] = useState(due.time || '23:59')
  const [estimate, setEstimate] = useState<number | null>(initial?.estimatedMinutes ?? null)
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const err = trimOrError(title, 'Title')
    setError(err)
    if (err) return document.getElementById(`${formId}-title`)?.focus()
    const linked = assignmentId ? assignments.find((a) => a.id === assignmentId) : undefined
    const fields = {
      title: title.trim(),
      courseId: linked?.courseId ?? courseId,
      assignmentId,
      plannedFor: plannedFor || null,
      dueAt: dueDay ? combineLocalDateTime(dueDay, dueTime) : null,
      estimatedMinutes: estimate,
      priority,
    }
    if (initial) {
      update(initial.id, fields)
      toast('Task updated')
      onDone({ ...initial, ...fields })
    } else {
      const position = Math.max(0, ...tasks.filter((t) => t.assignmentId === assignmentId).map((t) => t.position + 1))
      const created = add({ ...fields, done: false, position, createdAt: new Date().toISOString(), completedAt: null })
      toast('Task added')
      onDone(created)
    }
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${formId}-title`} label="Task" error={error}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review lecture 12 slides" data-autofocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" optional>
          {(p) => <CourseSelect {...p} value={courseId} onChange={(v) => { setCourseId(v); setAssignmentId(null) }} allowNone />}
        </Field>
        <Field label="Part of assignment" optional>
          {(p) => <AssignmentSelect {...p} value={assignmentId} onChange={setAssignmentId} courseId={courseId} />}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Plan for" hint="The day you intend to do it" optional>
          {(p) => <Input {...p} type="date" value={plannedFor} onChange={(e) => setPlannedFor(e.target.value)} />}
        </Field>
        <Field label="Estimated time">{(p) => <EstimateSelect {...p} value={estimate} onChange={setEstimate} />}</Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Deadline" optional>
          {(p) => <Input {...p} type="date" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />}
        </Field>
        <Field label="Time">{(p) => <Input {...p} type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDay} />}</Field>
        <Field label="Priority">{(p) => <PrioritySelect {...p} value={priority} onChange={setPriority} />}</Field>
      </div>
    </form>
  )
}
