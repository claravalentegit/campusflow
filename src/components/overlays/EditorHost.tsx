import { Trash2 } from 'lucide-react'
import { useStore } from '@/store/appStore'
import { toast, useUi } from '@/store/ui'
import { AssignmentForm } from '../forms/AssignmentForm'
import { CourseForm } from '../forms/CourseForm'
import { EventForm } from '../forms/EventForm'
import { ReminderForm } from '../forms/ReminderForm'
import { SessionForm } from '../forms/SessionForm'
import { TaskForm } from '../forms/TaskForm'
import { Button } from '../ui/Button'
import { confirm, Dialog } from '../ui/Dialog'
import { useDeleteAssignment } from '../work'

const TITLES = { assignment: 'Edit assignment', course: 'Edit course', task: 'Edit task', session: 'Edit study session', event: 'Edit event', reminder: 'Edit reminder' }

/** Renders the edit dialog for whatever record `useUi().editing` points at. */
export function EditorHost() {
  const editing = useUi((s) => s.editing)
  const close = () => useUi.getState().edit(null)
  const s = useStore()
  const deleteAssignment = useDeleteAssignment()
  const formId = editing ? `edit-${editing.kind}` : 'edit'

  let body: React.ReactNode = null
  let onDelete: (() => Promise<void>) | null = null
  if (editing) {
    const { kind, id } = editing
    if (kind === 'assignment') {
      const a = s.assignments.find((x) => x.id === id)
      if (a) {
        body = <AssignmentForm formId={formId} initial={a} onDone={close} />
        onDelete = async () => {
          if (await deleteAssignment(a)) close()
        }
      }
    } else if (kind === 'course') {
      const c = s.courses.find((x) => x.id === id)
      if (c) body = <CourseForm formId={formId} initial={c} onDone={close} />
    } else if (kind === 'task') {
      const t = s.tasks.find((x) => x.id === id)
      if (t) {
        body = <TaskForm formId={formId} initial={t} onDone={close} />
        onDelete = async () => {
          if (await confirm({ title: 'Delete task?', message: `“${t.title}” will be removed.` })) {
            s.deleteTask(t.id)
            toast('Task deleted')
            close()
          }
        }
      }
    } else if (kind === 'session') {
      const x = s.sessions.find((v) => v.id === id)
      if (x) {
        body = <SessionForm formId={formId} initial={x} onDone={close} />
        onDelete = async () => {
          if (await confirm({ title: 'Delete study session?', message: `“${x.title}” will be removed from your calendar.` })) {
            s.deleteSession(x.id)
            toast('Study session deleted')
            close()
          }
        }
      }
    } else if (kind === 'event') {
      const e = s.events.find((v) => v.id === id)
      if (e) {
        body = <EventForm formId={formId} initial={e} onDone={close} />
        onDelete = async () => {
          if (await confirm({ title: 'Delete event?', message: `“${e.title}” will be removed.${e.source === 'canvas' ? ' It may return on the next Canvas sync.' : ''}` })) {
            s.deleteEvent(e.id)
            toast('Event deleted')
            close()
          }
        }
      }
    } else if (kind === 'reminder') {
      const r = s.reminders.find((v) => v.id === id)
      if (r) {
        body = <ReminderForm formId={formId} initial={r} onDone={close} />
        onDelete = async () => {
          if (await confirm({ title: 'Delete reminder?', message: `“${r.title}” will be removed.` })) {
            s.deleteReminder(r.id)
            toast('Reminder deleted')
            close()
          }
        }
      }
    }
  }

  return (
    <Dialog
      open={!!editing && !!body}
      onClose={close}
      title={editing ? TITLES[editing.kind] : ''}
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" icon={Trash2} className="mr-auto text-danger hover:text-danger" onClick={() => void onDelete?.()}>
              Delete
            </Button>
          )}
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form={formId}>
            Save changes
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  )
}
