import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Archive, ArchiveRestore, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { isAssignmentDone, isAssignmentOverdue } from '@/domain/assignments'
import { formatDueDay } from '@/domain/dates'
import { courseMastery } from '@/domain/game'
import type { Course, CourseStatus } from '@/domain/types'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { toast, useUi } from '@/store/ui'
import { COURSE_ICON, courseColor } from '@/components/course'
import { CourseForm } from '@/components/forms/CourseForm'
import { Ring } from '@/components/game/GameUI'
import { Page, PageHeader, usePageTitle } from '@/components/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { confirm, Dialog } from '@/components/ui/Dialog'
import { Menu } from '@/components/ui/Menu'
import { Segmented } from '@/components/ui/Segmented'

export function useCourseActions() {
  const update = useStore((s) => s.updateCourse)
  const remove = useStore((s) => s.deleteCourse)
  const assignments = useStore((s) => s.assignments)
  const edit = useUi((s) => s.edit)
  return (c: Course, onDeleted?: () => void) => [
    { label: 'Edit class', icon: Pencil, onSelect: () => edit({ kind: 'course', id: c.id }) },
    c.hidden
      ? { label: 'Show on Today', icon: Eye, onSelect: () => { update(c.id, { hidden: false }); toast(`${c.name} is visible again`) } }
      : { label: 'Hide from Today', icon: EyeOff, onSelect: () => { update(c.id, { hidden: true }); toast(`${c.name} hidden`, 'info', { label: 'Undo', run: () => update(c.id, { hidden: false }) }) } },
    c.status === 'archived'
      ? { label: 'Restore', icon: ArchiveRestore, onSelect: () => { update(c.id, { status: 'active' }); toast(`${c.name} restored`) } }
      : { label: 'Archive', icon: Archive, onSelect: () => { const prev = c.status; update(c.id, { status: 'archived' }); toast(`${c.name} archived`, 'info', { label: 'Undo', run: () => update(c.id, { status: prev }) }) } },
    'separator' as const,
    {
      label: 'Delete class',
      icon: Trash2,
      tone: 'danger' as const,
      onSelect: async () => {
        const n = assignments.filter((a) => a.courseId === c.id).length
        if (await confirm({ title: `Delete ${c.name}?`, message: `This removes the class and its ${n} assignment${n === 1 ? '' : 's'} from CampusFlow. XP you already earned stays.${c.source === 'canvas' ? ' Nothing is deleted from Canvas.' : ''}`, confirmLabel: 'Delete class' })) {
          remove(c.id)
          toast(`${c.name} deleted`)
          onDeleted?.()
        }
      },
    },
  ]
}

export function Courses() {
  usePageTitle('Courses')
  const now = useNow()
  const courses = useStore((s) => s.courses)
  const assignments = useStore((s) => s.assignments)
  const tasks = useStore((s) => s.tasks)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<CourseStatus>('active')
  const [adding, setAdding] = useState(false)
  const actions = useCourseActions()

  useEffect(() => {
    if (params.get('new') === '1') {
      setAdding(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const list = courses.filter((c) => c.status === filter)

  return (
    <Page className="max-w-5xl">
      <PageHeader
        title="Courses"
        description="Every class, the same simple layout."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Add class
          </Button>
        }
      />
      {courses.some((c) => c.status !== 'active') && (
        <Segmented className="mb-4" label="Show" value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Current' }, { value: 'completed', label: 'Finished' }, { value: 'archived', label: 'Archived' }]} />
      )}
      {list.length === 0 ? (
        <div className="card-3d px-6 py-12 text-center">
          <p className="text-lg font-black">{filter === 'active' ? 'No classes yet' : `No ${filter === 'completed' ? 'finished' : 'archived'} classes`}</p>
          {filter === 'active' && (
            <Button variant="primary" icon={Plus} className="mt-4" onClick={() => setAdding(true)}>
              Add class
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((c, i) => {
            const mine = assignments.filter((a) => a.courseId === c.id)
            const open = mine.filter((a) => !isAssignmentDone(a))
            const late = open.filter((a) => isAssignmentOverdue(a, now)).length
            const next = open.filter((a) => a.dueAt && !isAssignmentOverdue(a, now)).sort((x, y) => x.dueAt!.localeCompare(y.dueAt!))[0]
            const mastery = courseMastery(mine, tasks)
            const Icon = COURSE_ICON[c.icon]
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
                whileHover={{ y: -4 }}
                className="card-3d group relative flex min-w-0 items-center gap-4 p-4"
              >
                <span className="btn-3d grid size-16 shrink-0 place-items-center rounded-[20px] text-white transition-transform group-hover:rotate-[-6deg]" style={{ background: courseColor(c.color), ['--press' as string]: 'rgb(0 0 0 / 0.2)' }}>
                  <Icon className="size-8" strokeWidth={2.4} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <Link to={`/courses/${c.id}`} className="block truncate text-lg font-black outline-none after:absolute after:inset-0 after:rounded-[18px] focus-visible:underline">
                    {c.name}
                  </Link>
                  <span className="block truncate text-sm font-bold text-fg-3">{[c.code, c.instructor].filter(Boolean).join(' · ')}</span>
                  <span className="mt-1 block truncate text-sm font-bold text-fg-2">
                    {late ? <span className="text-danger">{late} to catch up · </span> : null}
                    {next ? `Next: ${next.title}, ${formatDueDay(next.dueAt, now)}` : open.length ? `${open.length} open` : 'All clear'}
                  </span>
                </span>
                <Ring value={mastery} size={58} stroke={11} track="var(--surface-3)" color={courseColor(c.color)}>
                  <span className="tabular text-xs font-black">{Math.round(mastery * 100)}%</span>
                </Ring>
                <Menu className="relative self-start" items={actions(c)} trigger={(p) => <IconButton icon={MoreHorizontal} label={`Actions for ${c.name}`} size="sm" tooltip={false} {...p} />} />
              </motion.li>
            )
          })}
        </ul>
      )}
      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add class"
        footer={
          <>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="add-course">
              Add class
            </Button>
          </>
        }
      >
        <CourseForm
          formId="add-course"
          onDone={(c) => {
            setAdding(false)
            navigate(`/courses/${c.id}`)
          }}
        />
      </Dialog>
    </Page>
  )
}
