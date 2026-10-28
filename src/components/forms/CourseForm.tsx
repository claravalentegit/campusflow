import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Course, CourseColor, CourseIcon, CourseStatus } from '@/domain/types'
import { COURSE_COLORS, COURSE_ICONS } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { COURSE_ICON, courseColor, courseSoft } from '../course'
import { Field, Input, Select, Textarea } from '../ui/Field'
import { cn } from '../ui/cn'
import { trimOrError } from './shared'

export function ColorPicker({ value, onChange }: { value: CourseColor; onChange: (c: CourseColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Course color" className="flex flex-wrap gap-2">
      {COURSE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn('flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition', value === c && 'ring-2 ring-fg/60')}
          style={{ background: courseColor(c) }}
        >
          {value === c && <Check className="size-3.5 text-white" strokeWidth={3} aria-hidden />}
        </button>
      ))}
    </div>
  )
}

export function IconPicker({ value, onChange, color }: { value: CourseIcon; onChange: (c: CourseIcon) => void; color: CourseColor }) {
  return (
    <div role="radiogroup" aria-label="Course icon" className="flex flex-wrap gap-1.5">
      {COURSE_ICONS.map((i) => {
        const Icon = COURSE_ICON[i]
        const active = value === i
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={i}
            onClick={() => onChange(i)}
            className={cn('flex size-8 items-center justify-center rounded-md border transition-colors', active ? 'border-transparent' : 'border-line text-fg-3 hover:text-fg')}
            style={active ? { background: courseSoft(color, 16), color: courseColor(color) } : undefined}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

export function CourseForm({ formId, initial, onDone }: { formId: string; initial?: Course; onDone: (c: Course) => void }) {
  const add = useStore((s) => s.addCourse)
  const update = useStore((s) => s.updateCourse)
  const count = useStore((s) => s.courses.length)
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [instructor, setInstructor] = useState(initial?.instructor ?? '')
  const [term, setTerm] = useState(initial?.term ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [meetingInfo, setMeetingInfo] = useState(initial?.meetingInfo ?? '')
  const [color, setColor] = useState<CourseColor>(initial?.color ?? COURSE_COLORS[count % COURSE_COLORS.length])
  const [icon, setIcon] = useState<CourseIcon>(initial?.icon ?? 'book')
  const [status, setStatus] = useState<CourseStatus>(initial?.status ?? 'active')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const n = trimOrError(name, 'Course name', 120)
    if (n) errs.name = n
    const c = trimOrError(code, 'Course code', 30)
    if (c) errs.code = c
    setErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(`${formId}-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    const fields = {
      name: name.trim(),
      code: code.trim(),
      instructor: instructor.trim() || null,
      term: term.trim(),
      description: description.trim(),
      meetingInfo: meetingInfo.trim() || null,
      color,
      icon,
      status,
    }
    if (initial) {
      update(initial.id, fields)
      toast('Course updated')
      onDone({ ...initial, ...fields })
    } else {
      const created = add({ ...fields, hidden: false, gradeCategories: [], targetGrade: null, source: 'manual', canvasId: null, createdAt: new Date().toISOString() })
      toast(`Added ${created.code}`)
      onDone(created)
    }
  }

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
        <Field id={`${formId}-name`} label="Course name" error={errors.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Organic Chemistry" data-autofocus />}
        </Field>
        <Field id={`${formId}-code`} label="Code" error={errors.code}>
          {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} placeholder="CHEM 232" />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Instructor" optional>
          {(p) => <Input {...p} value={instructor} onChange={(e) => setInstructor(e.target.value)} />}
        </Field>
        <Field label="Term" optional>
          {(p) => <Input {...p} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Fall 2026" />}
        </Field>
      </div>
      <Field label="Meeting times & location" optional>
        {(p) => <Input {...p} value={meetingInfo} onChange={(e) => setMeetingInfo(e.target.value)} placeholder="Tue/Thu 11:00 · Noyes 100" />}
      </Field>
      <Field label="Description" optional>
        {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Where things live in this course, policies worth remembering…" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-2">Color</span>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        {initial && (
          <Field label="Status">
            {(p) => (
              <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as CourseStatus)}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </Select>
            )}
          </Field>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-fg-2">Icon</span>
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </div>
    </form>
  )
}
