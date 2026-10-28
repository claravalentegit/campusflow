import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/appStore'
import { useUi, type QuickAddKind } from '@/store/ui'
import { AssignmentForm } from '../forms/AssignmentForm'
import { EventForm } from '../forms/EventForm'
import { ReminderForm } from '../forms/ReminderForm'
import { SessionForm } from '../forms/SessionForm'
import { TaskForm } from '../forms/TaskForm'
import { CourseForm } from '../forms/CourseForm'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Segmented } from '../ui/Segmented'

const KINDS: Array<{ value: QuickAddKind | 'course'; label: string }> = [
  { value: 'assignment', label: 'Assignment' },
  { value: 'task', label: 'Task' },
  { value: 'session', label: 'Study time' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'event', label: 'Event' },
]

export function QuickAddDialog() {
  const preset = useUi((s) => s.quickAdd)
  const open = useUi((s) => s.openQuickAdd)
  const close = useUi((s) => s.closeQuickAdd)
  const hasCourses = useStore((s) => s.courses.some((c) => c.status === 'active' && !c.hidden))
  const navigate = useNavigate()
  const kind = preset?.kind ?? 'assignment'
  const formId = `quick-${kind}`
  const showCourseForm = kind === 'assignment' && !hasCourses

  return (
    <Dialog
      open={!!preset}
      onClose={close}
      title="Add"
      description="Everything you add earns XP when you finish it."
      footer={
        <>
          <span className="mr-auto hidden text-2xs text-fg-3 sm:inline">
            <kbd className="rounded border border-line px-1 font-sans">Enter</kbd> to save · <kbd className="rounded border border-line px-1 font-sans">Esc</kbd> to cancel
          </span>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form={showCourseForm ? 'quick-course' : formId}>
            {showCourseForm ? 'Add course' : 'Save'}
          </Button>
        </>
      }
    >
      {preset && (
        <div className="flex flex-col gap-5">
          <div className="scrollbar-thin relative -mx-1 overflow-x-auto px-1">
            <Segmented label="What to add" value={kind} onChange={(k) => open({ ...preset, kind: k as QuickAddKind })} options={KINDS as Array<{ value: QuickAddKind; label: string }>} />
          </div>
          {kind === 'assignment' &&
            (showCourseForm ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-fg-2">Assignments belong to a course. Add your first course to continue.</p>
                <CourseForm formId="quick-course" onDone={(c) => open({ kind: 'assignment', courseId: c.id })} />
              </div>
            ) : (
              <AssignmentForm key={formId} formId={formId} preset={preset} onDone={(a) => { close(); if (window.location.pathname === `/assignments/${a.id}`) return; useUi.getState().toast(`Added “${a.title}”`, 'success', { label: 'Open', run: () => navigate(`/assignments/${a.id}`) }) }} />
            ))}
          {kind === 'task' && <TaskForm formId={formId} preset={preset} onDone={close} />}
          {kind === 'session' && <SessionForm formId={formId} preset={preset} onDone={close} />}
          {kind === 'reminder' && <ReminderForm formId={formId} preset={preset} onDone={close} />}
          {kind === 'event' && <EventForm formId={formId} preset={preset} onDone={close} />}
        </div>
      )}
    </Dialog>
  )
}
