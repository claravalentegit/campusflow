import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { format } from 'date-fns'
import { AlertTriangle, ArrowLeft, ChevronDown, Crown, ExternalLink, Lock, MapPin, Megaphone, MoreHorizontal, Plus, Star } from 'lucide-react'
import { isAssignmentDone, isAssignmentOverdue } from '@/domain/assignments'
import { formatDueDay } from '@/domain/dates'
import { courseMastery, isBoss, xpForAssignmentNow } from '@/domain/game'
import { MODULE_ITEM_LABEL } from '@/domain/labels'
import type { Assignment } from '@/domain/types'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { useUi } from '@/store/ui'
import { completeAssignment } from '@/game/actions'
import { sfx } from '@/game/fx'
import { COURSE_ICON, courseColor } from '@/components/course'
import { AddResourceDialog } from '@/components/forms/ResourceForm'
import { CheckButton, XpChip } from '@/components/game/GameUI'
import { Page, usePageTitle } from '@/components/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { cn } from '@/components/ui/cn'
import { useCourseActions } from './Courses'
import { NotFound } from './NotFound'

export function CourseDetail() {
  const { courseId } = useParams()
  const now = useNow()
  const navigate = useNavigate()
  const course = useStore((s) => s.courses.find((c) => c.id === courseId))
  const assignments = useStore((s) => s.assignments)
  const tasks = useStore((s) => s.tasks)
  const grades = useStore((s) => s.grades)
  const openQuickAdd = useUi((s) => s.openQuickAdd)
  const actions = useCourseActions()
  usePageTitle(course?.name ?? 'Not found')
  const mine = useMemo(() => assignments.filter((a) => a.courseId === courseId).sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')), [assignments, courseId])
  if (!course) return <NotFound what="class" />

  const Icon = COURSE_ICON[course.icon]
  const mastery = courseMastery(mine, tasks)
  const late = mine.filter((a) => isAssignmentOverdue(a, now))
  const hasGrades = grades.some((g) => g.courseId === course.id)

  return (
    <Page className="max-w-5xl">
      <Link to="/courses" className="mb-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-fg-3 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> All courses
      </Link>
      <header className="flex flex-wrap items-center gap-4">
        <motion.span initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 13 }} className="btn-3d grid size-18 place-items-center rounded-[22px] text-white" style={{ background: courseColor(course.color), ['--press' as string]: 'rgb(0 0 0 / 0.2)' }}>
          <Icon className="size-9" strokeWidth={2.4} aria-hidden />
        </motion.span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black tracking-tight">{course.name}</h1>
          <p className="text-sm font-bold text-fg-2">{[course.code, course.instructor].filter(Boolean).join(' · ')}</p>
          {course.meetingInfo && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-fg-3">
              <MapPin className="size-3.5" aria-hidden /> {course.meetingInfo}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="tabular text-3xl font-black" style={{ color: courseColor(course.color) }}>
              {Math.round(mastery * 100)}%
            </p>
            <p className="text-xs font-extrabold text-fg-3">course cleared</p>
          </div>
          <Menu items={actions(course, () => navigate('/courses'))} trigger={(p) => <IconButton icon={MoreHorizontal} label="Class actions" variant="secondary" {...p} />} />
        </div>
      </header>
      {hasGrades && (
        <Link to={`/grades?course=${course.id}`} className="mt-2 inline-block text-sm font-extrabold text-accent-text hover:underline">
          See grades (estimate) →
        </Link>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="path-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="path-title" className="text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
              Your path
            </h2>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => openQuickAdd({ kind: 'assignment', courseId: course.id })}>
              Add assignment
            </Button>
          </div>
          {mine.length === 0 ? (
            <div className="card-3d px-6 py-10 text-center font-bold text-fg-2">No assignments yet. Add the first one to start this path.</div>
          ) : (
            <Path assignments={mine} color={courseColor(course.color)} now={now} />
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6">
          {late.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-black tracking-[0.12em] text-danger uppercase">
                <AlertTriangle className="size-3.5" aria-hidden /> Catch up
              </h2>
              <ul className="flex flex-col gap-2">
                {late.map((a) => (
                  <li key={a.id} className="card-3d flex items-center gap-3 border-danger/30 bg-danger-soft/40 px-3 py-2.5">
                    <CheckButton checked={false} label={`Complete ${a.title}`} onToggle={(el) => completeAssignment(a, el)} />
                    <Link to={`/assignments/${a.id}`} className="min-w-0 flex-1 truncate font-extrabold hover:underline">
                      {a.title}
                    </Link>
                    <XpChip amount={xpForAssignmentNow(a, tasks, now)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Announcements courseId={course.id} />
          <Materials courseId={course.id} />
        </aside>
      </div>
    </Page>
  )
}

/** Zigzag level path: cleared stars, the current quest pulsing, bosses as crowns. */
function Path({ assignments, color, now }: { assignments: Assignment[]; color: string; now: Date }) {
  const tasks = useStore((s) => s.tasks)
  const navigate = useNavigate()
  const currentId = assignments.find((a) => !isAssignmentDone(a) && !isAssignmentOverdue(a, now))?.id
  const offsets = [0, 70, 100, 70, 0, -70, -100, -70]
  return (
    <ol className="relative flex flex-col items-center py-2">
      {assignments.map((a, i) => {
        const done = isAssignmentDone(a)
        const late = isAssignmentOverdue(a, now)
        const boss = isBoss(a, tasks)
        const current = a.id === currentId
        const x = offsets[i % offsets.length]
        const state = done ? 'done' : late ? 'late' : current ? 'current' : 'upcoming'
        return (
          <motion.li
            key={a.id}
            initial={{ opacity: 0, scale: 0.3, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 16, delay: Math.min(i * 0.06, 0.8) }}
            className="relative flex flex-col items-center pb-5"
          >
            <div style={{ translate: `${x}px 0` }} className="flex flex-col items-center max-sm:!translate-none">
              {current && (
                <motion.span initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bob mb-2 rounded-xl border-2 border-line bg-surface px-3 py-1 text-xs font-black text-accent-text shadow-md">
                  Up next
                </motion.span>
              )}
              <motion.button
                type="button"
                onClick={() => {
                  sfx.tap()
                  navigate(`/assignments/${a.id}`)
                }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`${a.title}: ${state === 'done' ? 'cleared' : state === 'late' ? 'late' : state === 'current' ? 'up next' : 'upcoming'}${boss ? ', boss level' : ''}`}
                className={cn(
                  'btn-3d relative grid place-items-center text-white',
                  boss ? 'size-22 rounded-[28px]' : 'size-18 rounded-full',
                  state === 'done' && 'bg-success-bright [--press:var(--success-press)]',
                  state === 'late' && 'bg-danger [--press:rgb(0_0_0/0.25)]',
                  state === 'current' && 'pulse-ring',
                  state === 'upcoming' && 'bg-surface-3 text-fg-3 [--press:var(--line-strong)]',
                )}
                style={state === 'current' ? { background: boss ? 'var(--accent)' : color, ['--press' as string]: 'rgb(0 0 0 / 0.22)', ['--pulse' as string]: boss ? 'var(--accent)' : color } : state === 'upcoming' && boss ? { background: 'color-mix(in srgb, var(--accent) 35%, var(--surface-3))', color: 'white' } : undefined}
              >
                {state === 'done' ? <Star className="size-8 fill-white" aria-hidden /> : state === 'late' ? <AlertTriangle className="size-8" aria-hidden /> : boss ? <Crown className="size-10 fill-white/25" aria-hidden /> : state === 'upcoming' ? <Lock className="size-6" aria-hidden /> : <Star className="size-8" aria-hidden />}
              </motion.button>
              <Link to={`/assignments/${a.id}`} className="mt-2 max-w-52 text-center text-sm leading-tight font-extrabold hover:underline">
                {a.title}
              </Link>
              <span className={cn('text-xs font-bold', state === 'late' ? 'text-danger' : 'text-fg-3')}>
                {state === 'done' ? 'Cleared' : state === 'late' ? 'Late, catch up' : boss ? `Boss · ${formatDueDay(a.dueAt, now)}` : formatDueDay(a.dueAt, now)}
              </span>
              {current && <XpChip amount={xpForAssignmentNow(a, tasks, now)} className="mt-1" tone={boss ? 'purple' : 'gold'} />}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

function Announcements({ courseId }: { courseId: string }) {
  const announcements = useStore((s) => s.announcements)
  const update = useStore((s) => s.updateAnnouncement)
  const list = announcements.filter((a) => a.courseId === courseId).sort((a, b) => b.postedAt.localeCompare(a.postedAt))
  if (!list.length) return null
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">
        <Megaphone className="size-3.5" aria-hidden /> Announcements
      </h2>
      <ul className="flex flex-col gap-2">
        {list.slice(0, 4).map((a) => (
          <li key={a.id} className={cn('card-3d px-4 py-3', !a.read && 'border-accent/40')}>
            <p className="flex items-start gap-2 font-extrabold">
              <span className="flex-1">{a.title}</span>
              {!a.read && (
                <button type="button" onClick={() => update(a.id, { read: true })} className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-white hover:brightness-110" aria-label={`Mark “${a.title}” as read`}>
                  NEW
                </button>
              )}
            </p>
            <p className="mt-1 text-sm font-semibold text-fg-2">{a.body}</p>
            <p className="mt-1 text-xs font-bold text-fg-3">{format(new Date(a.postedAt), 'MMM d')}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Materials({ courseId }: { courseId: string }) {
  const modules = useStore((s) => s.modules)
  const resources = useStore((s) => s.resources)
  const toggleItem = useStore((s) => s.toggleModuleItem)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const mods = modules.filter((m) => m.courseId === courseId).sort((a, b) => a.position - b.position)
  const links = resources.filter((r) => r.courseId === courseId && r.url)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-black tracking-[0.12em] text-fg-3 uppercase">Materials</h2>
        <Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>
          Add link
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {mods.map((m) => {
          const done = m.items.filter((i) => i.completed).length
          const isOpen = open === m.id
          return (
            <li key={m.id} className="card-3d overflow-hidden">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
                <ChevronDown className={cn('size-4 shrink-0 text-fg-3 transition-transform', !isOpen && '-rotate-90')} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{m.title}</span>
                <span className={cn('tabular shrink-0 text-xs font-black', done === m.items.length && m.items.length ? 'text-success' : 'text-fg-3')}>{done === m.items.length && m.items.length ? 'Done' : `${done}/${m.items.length}`}</span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t-2 border-line">
                    {m.items.map((it) => (
                      <li key={it.id} className="flex items-center gap-2.5 px-4 py-2">
                        <input
                          type="checkbox"
                          checked={it.completed}
                          onChange={() => {
                            if (!it.completed) sfx.pop()
                            toggleItem(m.id, it.id)
                          }}
                          aria-label={`Mark ${it.title} ${it.completed ? 'not done' : 'done'}`}
                          className="size-4.5 shrink-0 accent-[var(--success-bright)]"
                        />
                        <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', it.completed && 'text-fg-3 line-through')}>
                          {it.assignmentId ? (
                            <Link to={`/assignments/${it.assignmentId}`} className="hover:underline">
                              {it.title}
                            </Link>
                          ) : (
                            it.title
                          )}
                        </span>
                        <span className="shrink-0 text-[11px] font-bold text-fg-3">{MODULE_ITEM_LABEL[it.type]}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </li>
          )
        })}
        {links.map((r) => (
          <li key={r.id}>
            <a href={r.url!} target="_blank" rel="noopener noreferrer" className="card-3d flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-accent-text hover:bg-surface-2">
              <ExternalLink className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{r.title}</span>
            </a>
          </li>
        ))}
        {mods.length + links.length === 0 && <li className="text-sm font-semibold text-fg-3">No materials yet. Add links to slides, readings or tools.</li>}
      </ul>
      <AddResourceDialog open={adding} onClose={() => setAdding(false)} preset={{ courseId }} />
    </section>
  )
}
