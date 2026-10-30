import { formatMinutes } from '@/domain/dates'
import { PRIORITY_LABEL } from '@/domain/labels'
import type { Priority } from '@/domain/types'
import { useVisibleCourses } from '@/hooks/useData'
import { useStore } from '@/store/appStore'
import { Select } from '../ui/Field'
import { tr, useT } from '@/i18n'
import { msg } from '@/i18n/langs'

const ESTIMATES = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 900, 1200]

export function EstimateSelect({ value, onChange, ...aria }: { value: number | null; onChange: (v: number | null) => void; id?: string }) {
  const options = value != null && !ESTIMATES.includes(value) ? [...ESTIMATES, value].sort((a, b) => a - b) : ESTIMATES
  const t = useT()
  return (
    <Select {...aria} value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{t('No estimate')}</option>
      {options.map((m) => (
        <option key={m} value={m}>
          {formatMinutes(m)}
        </option>
      ))}
    </Select>
  )
}

export function PrioritySelect({ value, onChange, ...aria }: { value: Priority; onChange: (v: Priority) => void; id?: string }) {
  const t = useT()
  return (
    <Select {...aria} value={value} onChange={(e) => onChange(e.target.value as Priority)}>
      {(['high', 'medium', 'low'] as Priority[]).map((p) => (
        <option key={p} value={p}>
          {t(PRIORITY_LABEL[p])}
        </option>
      ))}
    </Select>
  )
}

/** Course picker listing visible courses, plus the current one if it is hidden or archived. */
export function CourseSelect({ value, onChange, allowNone, noneLabel = msg('No course'), ...aria }: { value: string | null; onChange: (v: string | null) => void; allowNone?: boolean; noneLabel?: string; id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  const visible = useVisibleCourses()
  const all = useStore((s) => s.courses)
  const current = value ? all.find((c) => c.id === value) : undefined
  const list = current && !visible.includes(current) ? [...visible, current] : visible
  const t = useT()
  return (
    <Select {...aria} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {(allowNone || !value) && <option value="">{allowNone ? t(noneLabel) : t('Choose a course…')}</option>}
      {list.map((c) => (
        <option key={c.id} value={c.id}>
          {c.code} · {c.name}
        </option>
      ))}
    </Select>
  )
}

export function AssignmentSelect({ value, onChange, courseId, ...aria }: { value: string | null; onChange: (v: string | null) => void; courseId: string | null; id?: string }) {
  const assignments = useStore((s) => s.assignments)
  const list = assignments.filter((a) => (!courseId || a.courseId === courseId) && (a.status !== 'completed' || a.id === value))
  const t = useT()
  return (
    <Select {...aria} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{t('Not linked to an assignment')}</option>
      {list.map((a) => (
        <option key={a.id} value={a.id}>
          {a.title}
        </option>
      ))}
    </Select>
  )
}

export function trimOrError(v: string, label: string, max = 200): string | null {
  if (!v.trim()) return tr('{label} is required.', { label: tr(label) })
  if (v.trim().length > max) return tr('{label} must be {max} characters or fewer.', { label: tr(label), max })
  return null
}

export function validUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
