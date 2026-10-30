import { useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { combineLocalDateTime, splitLocalDateTime } from '@/domain/dates'
import { newId } from '@/domain/ids'
import { STATUS_LABEL, TYPE_LABEL } from '@/domain/labels'
import type { Assignment, AssignmentStatus, AssignmentType, Priority, ResourceLink } from '@/domain/types'
import { ASSIGNMENT_STATUSES, ASSIGNMENT_TYPES } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { Button, IconButton } from '../ui/Button'
import { Field, Input, Select, Textarea } from '../ui/Field'
import { cn } from '../ui/cn'
import { CourseSelect, EstimateSelect, PrioritySelect, trimOrError, validUrl } from './shared'
import { useT } from '@/i18n'
import { msg } from '@/i18n/langs'

export interface AssignmentFormProps {
  formId: string
  initial?: Assignment
  preset?: { courseId?: string | null; day?: string; time?: string }
  onDone: (a: Assignment) => void
}

export function AssignmentForm({ formId, initial, preset, onDone }: AssignmentFormProps) {
  const add = useStore((s) => s.addAssignment)
  const update = useStore((s) => s.updateAssignment)
  const visibleCourseCount = useStore((s) => s.courses.filter((c) => c.status === 'active' && !c.hidden).length)
  const split = splitLocalDateTime(initial?.dueAt ?? null)

  const [title, setTitle] = useState(initial?.title ?? '')
  const [courseId, setCourseId] = useState<string | null>(initial?.courseId ?? preset?.courseId ?? null)
  const [day, setDay] = useState(initial ? split.day : (preset?.day ?? ''))
  const [time, setTime] = useState(initial ? split.time : (preset?.time ?? '23:59'))
  const [type, setType] = useState<AssignmentType>(initial?.type ?? 'other')
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium')
  const [estimate, setEstimate] = useState<number | null>(initial?.estimatedMinutes ?? null)
  const [status, setStatus] = useState<AssignmentStatus>(initial?.status ?? 'not_started')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [instructions, setInstructions] = useState(initial?.submissionInstructions ?? '')
  const [rubric, setRubric] = useState(initial?.rubricNotes ?? '')
  const [points, setPoints] = useState(initial?.pointsPossible?.toString() ?? '')
  const [links, setLinks] = useState<ResourceLink[]>(initial?.links ?? [])
  const [more, setMore] = useState(!!initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fromCanvas = initial?.source === 'canvas'
  const tt = useT()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const t = trimOrError(title, msg('Title'))
    if (t) errs.title = t
    if (!courseId) errs.course = tt('Choose a course.')
    let dueAt: string | null = null
    if (day) {
      dueAt = combineLocalDateTime(day, time)
      if (!dueAt) errs.due = tt('Enter a valid date.')
      else if (Number(day.slice(0, 4)) < 2000 || Number(day.slice(0, 4)) > 2100) errs.due = tt('Enter a realistic year.')
    }
    const pts = points.trim() ? Number(points) : null
    if (pts != null && (!Number.isFinite(pts) || pts < 0)) errs.points = tt('Points must be a positive number.')
    const badLink = links.find((l) => l.url.trim() && !validUrl(l.url.trim()))
    if (badLink) errs.links = tt('“{url}” is not a valid http(s) link.', { url: badLink.url })
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`${formId}-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    const cleanLinks = links.filter((l) => l.url.trim()).map((l) => ({ ...l, url: l.url.trim(), label: l.label.trim() || l.url.trim() }))
    const now = new Date().toISOString()
    const fields = {
      title: title.trim(),
      courseId: courseId as string,
      dueAt,
      type,
      priority,
      estimatedMinutes: estimate,
      status,
      description: description.trim(),
      submissionInstructions: instructions.trim(),
      rubricNotes: rubric.trim(),
      pointsPossible: pts,
      links: cleanLinks,
    }
    if (initial) {
      const completedAt = status === 'completed' || status === 'submitted' ? (initial.completedAt ?? now) : null
      update(initial.id, { ...fields, completedAt })
      toast(tt('Assignment updated'))
      onDone({ ...initial, ...fields, completedAt })
    } else {
      const created = add({
        ...fields,
        personalNotes: '',
        gradeCategoryId: null,
        moduleId: null,
        canvasSubmission: null,
        source: 'manual',
        canvasId: null,
        htmlUrl: null,
        completedAt: status === 'completed' || status === 'submitted' ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      toast(tt('Assignment added'))
      onDone(created)
    }
  }

  if (!initial && visibleCourseCount === 0) {
    return <p className="text-sm text-fg-2">{tt('Add a course first — every assignment belongs to a course. Open the Course tab above or go to My Courses.')}</p>
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {fromCanvas && <p className="rounded-md bg-accent-soft px-3 py-2 text-xs text-accent-text">{tt('Synced from Canvas. Edits here stay in CampusFlow; title, description and due date are refreshed on the next sync.')}</p>}
      <Field id={`${formId}-title`} label="Title" error={errors.title}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lab Report 7" maxLength={200} data-autofocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${formId}-course`} label="Course" error={errors.course}>
          {(p) => <CourseSelect {...p} value={courseId} onChange={setCourseId} />}
        </Field>
        <Field label="Type">
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as AssignmentType)}>
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {tt(TYPE_LABEL[t])}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field id={`${formId}-due`} label="Due date" error={errors.due} optional>
          {(p) => <Input {...p} type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
        </Field>
        <Field label="Due time" hint="Your local time">
          {(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!day} />}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Priority">{(p) => <PrioritySelect {...p} value={priority} onChange={setPriority} />}</Field>
        <Field label="Estimated time">{(p) => <EstimateSelect {...p} value={estimate} onChange={setEstimate} />}</Field>
        <Field label="Your status" className="col-span-2 sm:col-span-1">
          {(p) => (
            <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus)}>
              {ASSIGNMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tt(STATUS_LABEL[s])}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {status === 'submitted' && <p className="-mt-2 text-xs text-fg-3">{tt('“Submitted” records that you turned it in. CampusFlow does not submit to Canvas or confirm submissions.')}</p>}

      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex items-center gap-1.5 self-start text-xs font-medium text-fg-2 hover:text-fg">
        <ChevronDown className={cn('size-3.5 transition-transform', !more && '-rotate-90')} aria-hidden />
        {tt('Instructions, rubric & links')}
      </button>
      {more && (
        <div className="flex flex-col gap-4">
          <Field label="Description" optional>
            {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tt('What the assignment asks for')} rows={3} />}
          </Field>
          <Field label="Submission instructions" optional>
            {(p) => <Textarea {...p} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={tt('Where and how to submit, file format…')} rows={2} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field label="Rubric or grading notes" optional>
              {(p) => <Textarea {...p} value={rubric} onChange={(e) => setRubric(e.target.value)} rows={2} />}
            </Field>
            <Field id={`${formId}-points`} label="Points possible" error={errors.points} optional>
              {(p) => <Input {...p} inputMode="decimal" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="100" />}
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-xs font-medium text-fg-2">{tt('Resource links')}</legend>
            {links.map((l, i) => (
              <div key={l.id} className="flex gap-2">
                <Input aria-label={tt('Link {n} label', { n: i + 1 })} value={l.label} placeholder={tt('Label')} className="w-2/5" onChange={(e) => setLinks(links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} />
                <Input id={i === 0 ? `${formId}-links` : undefined} aria-label={tt('Link {n} URL', { n: i + 1 })} value={l.url} placeholder="https://…" onChange={(e) => setLinks(links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} />
                <IconButton icon={X} label="Remove link" onClick={() => setLinks(links.filter((x) => x.id !== l.id))} />
              </div>
            ))}
            {errors.links && <p className="text-xs text-danger" role="alert">{errors.links}</p>}
            <Button size="sm" variant="ghost" icon={Plus} className="self-start" onClick={() => setLinks([...links, { id: newId('lnk'), label: '', url: '' }])}>
              {tt('Add link')}
            </Button>
          </fieldset>
        </div>
      )}
    </form>
  )
}
