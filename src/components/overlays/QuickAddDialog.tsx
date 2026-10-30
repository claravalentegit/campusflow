import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/appStore'
import { useUi, type QuickAddKind } from '@/store/ui'
import { AssignmentForm } from '../forms/AssignmentForm'
import { TaskForm } from '../forms/TaskForm'
import { CourseForm } from '../forms/CourseForm'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Segmented } from '../ui/Segmented'
import { useT } from '@/i18n'
import { msg } from '@/i18n/langs'

const KINDS: Array<{ value: QuickAddKind | 'course'; label: string }> = [
  { value: 'assignment', label: msg('Assignment') },
  { value: 'task', label: msg('To-do') },
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
  const t = useT()

  return (
    <Dialog
      open={!!preset}
      onClose={close}
      title={t('Add')}
      description={t('Everything you add earns XP when you finish it.')}
      footer={
        <>
          <span className="mr-auto hidden text-2xs text-fg-3 sm:inline">
            <kbd className="rounded border border-line px-1 font-sans">Enter</kbd> {t('to save')} · <kbd className="rounded border border-line px-1 font-sans">Esc</kbd> {t('to cancel')}
          </span>
          <Button onClick={close}>{t('Cancel')}</Button>
          <Button variant="primary" type="submit" form={showCourseForm ? 'quick-course' : formId}>
            {showCourseForm ? t('Add course') : t('Save')}
          </Button>
        </>
      }
    >
      {preset && (
        <div className="flex flex-col gap-5">
          <div className="scrollbar-thin relative -mx-1 overflow-x-auto px-1">
            <Segmented label={t('What to add')} value={kind} onChange={(k) => open({ ...preset, kind: k as QuickAddKind })} options={KINDS as Array<{ value: QuickAddKind; label: string }>} />
          </div>
          {kind === 'assignment' &&
            (showCourseForm ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-fg-2">{t('Assignments belong to a course. Add your first course to continue.')}</p>
                <CourseForm formId="quick-course" onDone={(c) => open({ kind: 'assignment', courseId: c.id })} />
              </div>
            ) : (
              <AssignmentForm key={formId} formId={formId} preset={preset} onDone={(a) => { close(); useUi.getState().toast(t('Added “{title}”', { title: a.title }), 'success', { label: t('Open'), run: () => navigate(`/?open=${a.id}`) }) }} />
            ))}
          {kind === 'task' && <TaskForm formId={formId} preset={preset} onDone={close} />}
        </div>
      )}
    </Dialog>
  )
}
