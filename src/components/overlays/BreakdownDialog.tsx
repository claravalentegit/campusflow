import { useEffect, useState } from 'react'
import { AlertCircle, GripVertical, Plus, Sparkles, X } from 'lucide-react'
import { tasksForAssignment } from '@/domain/assignments'
import type { SuggestedStep } from '@/domain/breakdown'
import { formatDue, formatMinutes, toLocalDay } from '@/domain/dates'
import { TYPE_LABEL } from '@/domain/labels'
import { ruleBasedAssistant } from '@/integrations/ai/assistant'
import { useCourseMap } from '@/hooks/useData'
import { useStore } from '@/store/appStore'
import { toast, useUi } from '@/store/ui'
import { CourseTag } from '../course'
import { Button, IconButton } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, Input } from '../ui/Field'
import { EstimateSelect } from '../forms/shared'

interface Row extends SuggestedStep {
  key: number
}

/**
 * Turn an assignment into scheduled steps. Suggestions come from a transparent template;
 * nothing is saved until the student reviews and confirms.
 */
export function BreakdownDialog() {
  const assignmentId = useUi((s) => s.breakdownFor)
  const close = () => useUi.getState().openBreakdown(null)
  const assignment = useStore((s) => s.assignments.find((a) => a.id === assignmentId))
  const allTasks = useStore((s) => s.tasks)
  const addTasks = useStore((s) => s.addTasks)
  const updateAssignment = useStore((s) => s.updateAssignment)
  const courses = useCourseMap()
  const [total, setTotal] = useState<number | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [missing, setMissing] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const existing = assignment ? tasksForAssignment(allTasks, assignment.id) : []

  const regenerate = async (minutes: number | null) => {
    if (!assignment) return
    const res = await ruleBasedAssistant.breakDown(assignment, new Date(), minutes)
    setRows(res.steps.map((s, i) => ({ ...s, key: i })))
    setMissing(res.missingInfo.filter((m) => !(minutes && m.startsWith('No time estimate'))))
  }

  useEffect(() => {
    if (!assignment) return
    setTotal(assignment.estimatedMinutes)
    setError(null)
    void regenerate(assignment.estimatedMinutes)
    // Only when a new assignment is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId])

  if (!assignment) return <Dialog open={false} onClose={close} title="">{null}</Dialog>
  const sum = rows.reduce((s, r) => s + (r.estimatedMinutes ?? 0), 0)
  const due = assignment.dueAt ? new Date(assignment.dueAt) : null
  const lateRows = due ? rows.filter((r) => r.plannedFor && r.plannedFor > toLocalDay(due)) : []

  const save = () => {
    const clean = rows.filter((r) => r.title.trim())
    if (!clean.length) {
      setError('Add at least one step.')
      return
    }
    const start = Math.max(0, ...existing.map((t) => t.position + 1))
    const now = new Date().toISOString()
    addTasks(
      clean.map((r, i) => ({
        title: r.title.trim(),
        courseId: assignment.courseId,
        assignmentId: assignment.id,
        plannedFor: r.plannedFor || null,
        dueAt: null,
        estimatedMinutes: r.estimatedMinutes,
        priority: assignment.priority,
        done: false,
        position: start + i,
        createdAt: now,
        completedAt: null,
      })),
    )
    if (total && total !== assignment.estimatedMinutes) updateAssignment(assignment.id, { estimatedMinutes: total })
    toast(`Added ${clean.length} steps to “${assignment.title}”`)
    close()
  }

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  return (
    <Dialog
      open
      onClose={close}
      size="lg"
      title="Break into steps"
      description={
        <span className="inline-flex flex-wrap items-center gap-x-2">
          <span className="font-medium text-fg-2">{assignment.title}</span>
          <CourseTag course={courses.get(assignment.courseId)} />
          <span>· {formatDue(assignment.dueAt, new Date())}</span>
        </span>
      }
      footer={
        <>
          <span className="tabular mr-auto text-xs text-fg-3">
            {rows.length} steps · {formatMinutes(sum)} planned
          </span>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save steps
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-md border border-line bg-surface-2/60 px-3 py-2.5 text-xs text-fg-2">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
          <p>
            Suggested from a standard <strong className="font-medium">{TYPE_LABEL[assignment.type].toLowerCase()}</strong> template and spread across the days before the deadline. This is a rule-based starting point, not AI — rename, re-time, reschedule or remove anything before saving.
          </p>
        </div>
        {existing.length > 0 && <p className="text-xs text-fg-3">This assignment already has {existing.length} step{existing.length === 1 ? '' : 's'}. New steps are added after them.</p>}
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Total time you expect it to take" className="w-56">
            {(p) => (
              <EstimateSelect
                {...p}
                value={total}
                onChange={(v) => {
                  setTotal(v)
                  void regenerate(v)
                }}
              />
            )}
          </Field>
          <Button size="sm" variant="ghost" onClick={() => void regenerate(total)}>
            Reset suggestions
          </Button>
        </div>
        {missing.length > 0 && (
          <div className="rounded-md border border-line px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fg-2">
              <AlertCircle className="size-3.5 text-warn" aria-hidden />
              Missing information
            </p>
            <ul className="list-disc pl-5 text-xs text-fg-3">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        <ol className="flex flex-col divide-y divide-line rounded-md border border-line">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-wrap items-center gap-2 px-2 py-2 sm:flex-nowrap">
              <GripVertical className="hidden size-4 shrink-0 text-fg-3/50 sm:block" aria-hidden />
              <span className="tabular w-5 shrink-0 text-center text-xs text-fg-3">{i + 1}</span>
              <Input aria-label={`Step ${i + 1} title`} value={r.title} onChange={(e) => setRow(r.key, { title: e.target.value })} className="min-w-0 flex-1 basis-full sm:basis-auto" />
              <div className="w-28 shrink-0">
                <EstimateSelect value={r.estimatedMinutes} onChange={(v) => setRow(r.key, { estimatedMinutes: v })} />
              </div>
              <Input type="date" aria-label={`Step ${i + 1} planned day`} value={r.plannedFor ?? ''} onChange={(e) => setRow(r.key, { plannedFor: e.target.value || null })} className="w-38 shrink-0" />
              <IconButton icon={X} label={`Remove step ${i + 1}`} size="sm" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
            </li>
          ))}
        </ol>
        {lateRows.length > 0 && <p className="text-xs text-warn">{lateRows.length} step(s) are planned after the due date.</p>}
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
        <Button size="sm" variant="ghost" icon={Plus} className="self-start" onClick={() => setRows((rs) => [...rs, { key: Date.now(), title: '', estimatedMinutes: null, plannedFor: null }])}>
          Add step
        </Button>
      </div>
    </Dialog>
  )
}
