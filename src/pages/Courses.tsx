import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNowStrict } from 'date-fns'
import { AlertTriangle, Archive, ArchiveRestore, ChevronDown, ExternalLink, Eye, EyeOff, Megaphone, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { isAssignmentDone, isAssignmentOverdue } from '@/domain/assignments'
import { formatDueDay, parseInstant } from '@/domain/dates'
import { letterGrade, missingImpact, requiredForTarget, summarizeCourseGrades } from '@/domain/grades'
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
import { cn } from '@/components/ui/cn'

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
  const courses = useStore((s) => s.courses)
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<CourseStatus>('active')
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    if (params.get('new') === '1') {
      setAdding(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const list = courses.filter((c) => c.status === filter)

  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Courses"
        description="Tap a class to see how it’s going."
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
        <ul className="flex flex-col gap-3">
          {list.map((c, i) => (
            <CourseCard key={c.id} c={c} index={i} open={openId === c.id} onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))} />
          ))}
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
            setFilter('active')
            setOpenId(c.id)
          }}
        />
      </Dialog>
    </Page>
  )
}

function CourseCard({ c, index, open, onToggle }: { c: Course; index: number; open: boolean; onToggle: () => void }) {
  const now = useNow()
  const assignments = useStore((s) => s.assignments)
  const grades = useStore((s) => s.grades)
  const announcements = useStore((s) => s.announcements)
  const canvasHost = useStore((s) => s.prefs.canvasHost)
  const actions = useCourseActions()

  const mine = assignments.filter((a) => a.courseId === c.id)
  const openWork = mine.filter((a) => !isAssignmentDone(a))
  const late = openWork.filter((a) => isAssignmentOverdue(a, now))
  const upcoming = openWork.filter((a) => a.dueAt && !isAssignmentOverdue(a, now)).sort((x, y) => x.dueAt!.localeCompare(y.dueAt!))
  const summary = summarizeCourseGrades(c, grades, assignments)
  const pct = summary.currentPercent
  const impact = missingImpact(c, grades, assignments, now)
  const target = c.targetGrade != null && pct != null ? requiredForTarget(summary, c.targetGrade) : null
  const latest = announcements.filter((n) => n.courseId === c.id).sort((x, y) => y.postedAt.localeCompare(x.postedAt))[0]
  const source = summary.sources.includes('canvas') ? 'from Canvas' : summary.sources.includes('demo') ? 'demo grades' : summary.sources.length ? 'grades you entered' : null
  const canvasUrl = c.canvasId && canvasHost ? `https://${canvasHost}/courses/${c.canvasId}` : null
  const tone = pct == null ? 'var(--surface-3)' : pct >= 90 ? 'var(--success-bright)' : pct >= 80 ? courseColor(c.color) : pct >= 70 ? 'var(--gold)' : 'var(--danger)'
  const Icon = COURSE_ICON[c.icon]

  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 26 }}
      className={cn('card-3d overflow-hidden', open && 'border-accent')}
      data-testid="course-card"
    >
      <div className="relative flex items-center gap-3.5 p-3.5 sm:gap-4 sm:p-4">
        <span className="btn-3d grid size-12 shrink-0 place-items-center rounded-2xl text-white sm:size-14" style={{ background: courseColor(c.color), ['--press' as string]: 'rgb(0 0 0 / 0.2)' }}>
          <Icon className="size-6 sm:size-7" strokeWidth={2.4} aria-hidden />
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} data-sfx={open ? 'close' : 'open'} className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 focus-visible:underline">
          <span className="block truncate text-lg font-black">{c.name}</span>
          <span className="block truncate text-sm font-bold text-fg-2">
            {late.length > 0 && <span className="text-danger">{late.length} late · </span>}
            {upcoming[0] ? `Next: ${upcoming[0].title}, ${formatDueDay(upcoming[0].dueAt, now)}` : openWork.length ? `${openWork.length} open` : 'Nothing due 🎉'}
          </span>
        </button>
        <Ring value={pct == null ? 0 : Math.min(1, pct / 100)} size={54} stroke={9} track="var(--surface-3)" color={tone}>
          <span className="text-sm leading-none font-black">{pct == null ? '–' : letterGrade(pct)}</span>
        </Ring>
        <ChevronDown className={cn('relative size-5 shrink-0 text-fg-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
            <div className="flex flex-col gap-4 border-t-2 border-dashed border-line p-4 sm:px-5" data-testid="course-details">
              <section aria-label="Grade">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-2xl font-black">{pct == null ? 'No grades yet' : `${pct.toFixed(1)}% · ${letterGrade(pct)}`}</span>
                  {source && <span className="text-xs font-bold text-fg-3">{source}</span>}
                </p>
                {[c.code, c.instructor].some(Boolean) && <p className="text-sm font-bold text-fg-3">{[c.code, c.instructor].filter(Boolean).join(' · ')}</p>}
                {summary.method === 'weighted' && (
                  <p className="mt-1 text-sm font-bold text-fg-2">
                    {summary.categories
                      .filter((k) => k.percent != null)
                      .map((k) => `${k.name} ${Math.round(k.percent!)}%`)
                      .join(' · ')}
                  </p>
                )}
                {impact.count > 0 && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm font-extrabold text-danger">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      {impact.count} missing {impact.count === 1 ? 'assignment' : 'assignments'}
                      {impact.ifZero != null && impact.current != null && impact.ifZero < impact.current - 0.05 ? `. If graded as zero, your grade could drop to about ${impact.ifZero.toFixed(0)}%.` : '.'}
                    </span>
                  </p>
                )}
                {target?.requiredPercent != null && target.requiredPercent > 0 && <p className="mt-2 text-sm font-bold text-fg-2">Goal {c.targetGrade}%: {target.requiredPercent > 100 ? 'out of reach on the remaining work.' : `you need about ${Math.ceil(target.requiredPercent)}% on what’s left.`}</p>}
              </section>

              <section aria-label="Up next">
                <h3 className="mb-1.5 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">Up next</h3>
                {upcoming.length ? (
                  <ul className="flex flex-col gap-1 text-sm font-bold">
                    {upcoming.slice(0, 3).map((a) => (
                      <li key={a.id} className="flex justify-between gap-3">
                        <span className="truncate">{a.title}</span>
                        <span className="shrink-0 text-fg-3">{formatDueDay(a.dueAt, now)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm font-bold text-fg-3">Nothing coming up.</p>
                )}
              </section>

              {latest && (
                <section aria-label="Latest from your teacher">
                  <h3 className="mb-1.5 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">Latest from your teacher</h3>
                  <div className="rounded-xl border-2 border-line bg-surface-2 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-sm font-black">
                      <Megaphone className="size-4 shrink-0 text-accent-text" aria-hidden />
                      <span className="truncate">{latest.title}</span>
                    </p>
                    {latest.body && <p className="mt-0.5 line-clamp-3 text-sm font-semibold text-fg-2">{latest.body}</p>}
                    <p className="mt-0.5 text-xs font-bold text-fg-3">{formatDistanceToNowStrict(parseInstant(latest.postedAt) ?? now, { addSuffix: true })}</p>
                  </div>
                </section>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {canvasUrl && (
                  <a href={canvasUrl} target="_blank" rel="noopener noreferrer" className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-sm font-extrabold [--press:var(--line)]">
                    Open in Canvas <ExternalLink className="size-4" aria-hidden />
                  </a>
                )}
                <Menu items={actions(c)} trigger={(p) => <IconButton icon={MoreHorizontal} label={`Actions for ${c.name}`} {...p} />} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}
