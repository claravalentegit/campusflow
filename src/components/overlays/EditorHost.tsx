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
import { tr } from '@/i18n/core'
import { msg } from '@/i18n/langs'

const TITLES = { assignment: msg('Edit assignment'), course: msg('Edit course'), task: msg('Edit task'), session: msg('Edit study session'), event: msg('Edit event'), reminder: msg('Edit reminder') }

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
          if (await confirm({ title: tr('Delete task?'), message: tr('“{title}” will be removed.', { title: t.title }) })) {
            s.deleteTask(t.id)
            toast(tr('Task deleted'))
            close()
          }
        }
      }
    } else if (kind === 'session') {
      const x = s.sessions.find((v) => v.id === id)
      if (x) {
        body = <SessionForm formId={formId} initial={x} onDone={close} />
        onDelete = async () => {
          if (await confirm({ title: tr('Delete study session?'), message: tr('“{title}” will be removed from your calendar.', { title: x.title }) })) {
            s.deleteSession(x.id)
            toast(tr('Study session deleted'))
            close()
          }
        }
      }
    } else if (kind === 'event') {
      const e = s.events.find((v) => v.id === id)
      if (e) {
        body = <EventForm formId={formId} initial={e} onDone={close} />
        onDelete = async () => {
          if (await confirm({ title: tr('Delete event?'), message: `${tr('“{title}” will be removed.', { title: e.title })}${e.source === 'canvas' ? ` ${tr('It may return on the next Canvas sync.')}` : ''}` })) {
            s.deleteEvent(e.id)
            toast(tr('Event deleted'))
            close()
          }
        }
      }
    } else if (kind === 'reminder') {
      const r = s.reminders.find((v) => v.id === id)
      if (r) {
        body = <ReminderForm formId={formId} initial={r} onDone={close} />
        onDelete = async () => {
          if (await confirm({ title: tr('Delete reminder?'), message: tr('“{title}” will be removed.', { title: r.title }) })) {
            s.deleteReminder(r.id)
            toast(tr('Reminder deleted'))
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
              {tr('Delete')}
            </Button>
          )}
          <Button onClick={close}>{tr('Cancel')}</Button>
          <Button variant="primary" type="submit" form={formId}>
            {tr('Save changes')}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  )
}
