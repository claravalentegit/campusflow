import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { differenceInCalendarDays, format, isSameDay } from 'date-fns'
import { ChevronDown, Crown, Flame, Plug, Plus, RefreshCw, Trophy } from 'lucide-react'
import { checklistProgress, isAssignmentDone, isAssignmentOverdue } from '@/domain/assignments'
import { dueBucket, formatDueDay, greeting, parseInstant, toLocalDay } from '@/domain/dates'
import { completionsOn, isBoss, xpForAssignmentNow, xpForTaskNow } from '@/domain/game'
import type { Assignment, Course, StudyTask } from '@/domain/types'
import { useCourseMap, useVisibleCourseIds } from '@/hooks/useData'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { useUi } from '@/store/ui'
import { syncCanvas, useCanvasSync } from '@/integrations/canvas/sync'
import { completeAssignment, completeTask, useLinger } from '@/game/actions'
import { CourseDot } from '@/components/course'
import { CheckButton, LevelBadge, ProgressBar, Ring, XpChip, useStreak, useXp } from '@/components/game/GameUI'
import { Page, usePageTitle } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'

type Item = { kind: 'assignment'; a: Assignment } | { kind: 'task'; t: StudyTask }
const keyOf = (i: Item) => (i.kind === 'assignment' ? `a:${i.a.id}` : `t:${i.t.id}`)

export function Today() {
  usePageTitle('Today')
  const now = useNow(30_000)
  const assignments = useStore((s) => s.assignments)
  const tasks = useStore((s) => s.tasks)
  const events = useStore((s) => s.xpEvents)
  const prefs = useStore((s) => s.prefs)
  const courses = useStore((s) => s.courses)
  const visible = useVisibleCourseIds()
  const courseMap = useCourseMap()
  const openQuickAdd = useUi((s) => s.openQuickAdd)
  const navigate = useNavigate()
  const { lingering, linger } = useLinger(950)
  const [showLater, setShowLater] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const today = toLocalDay(now)

  const groups = useMemo(() => {
    const inScope = (c: string | null) => !c || visible.has(c)
    const showA = (a: Assignment) => inScope(a.courseId) && (!isAssignmentDone(a) || lingering.has(`a:${a.id}`))
    const showT = (t: StudyTask) => inScope(t.courseId) && (!t.done || lingering.has(`t:${t.id}`))
    const byDue = (x: Assignment, y: Assignment) => (parseInstant(x.dueAt)?.getTime() ?? Infinity) - (parseInstant(y.dueAt)?.getTime() ?? Infinity)
    const open = assignments.filter(showA).sort(byDue)
    const bucket = (a: Assignment) => (lingering.has(`a:${a.id}`) && a.dueAt && new Date(a.dueAt) < now && isAssignmentDone(a) ? 'overdue' : dueBucket(a.dueAt, now))
    const late: Item[] = open.filter((a) => bucket(a) === 'overdue').map((a) => ({ kind: 'assignment', a }))
    const dueToday: Item[] = open.filter((a) => bucket(a) === 'today').map((a) => ({ kind: 'assignment', a }))
    const lateTasks = tasks.filter((t) => showT(t) && !t.assignmentId && t.dueAt && new Date(t.dueAt) < now)
    const todayTasks = tasks.filter((t) => showT(t) && !lateTasks.includes(t) && ((t.plannedFor && t.plannedFor <= today) || (!t.assignmentId && t.dueAt && dueBucket(t.dueAt, now) === 'today')))
    const week: Item[] = open.filter((a) => ['tomorrow', 'this_week', 'next_week'].includes(bucket(a)) && new Date(a.dueAt!).getTime() - now.getTime() < 7 * 86400000).map((a) => ({ kind: 'assignment', a }))
    const weekIds = new Set(week.map(keyOf))
    const later: Item[] = open.filter((a) => !['overdue', 'today'].includes(bucket(a)) && !weekIds.has(`a:${a.id}`)).map((a) => ({ kind: 'assignment', a }))
    const doneToday: Item[] = [
      ...assignments.filter((a) => inScope(a.courseId) && isAssignmentDone(a) && a.completedAt && isSameDay(new Date(a.completedAt), now) && !lingering.has(`a:${a.id}`)).map((a) => ({ kind: 'assignment' as const, a })),
      ...tasks.filter((t) => inScope(t.courseId) && t.done && t.completedAt && isSameDay(new Date(t.completedAt), now) && !lingering.has(`t:${t.id}`)).map((t) => ({ kind: 'task' as const, t })),
    ]
    return {
      late: [...late, ...lateTasks.map((t) => ({ kind: 'task' as const, t }))],
      today: [...dueToday, ...todayTasks.map((t) => ({ kind: 'task' as const, t }))],
      week,
      later,
      doneToday,
    }
  }, [assignments, tasks, visible, lingering, now, today])

  if (courses.length === 0) return <FirstRun />

  const done = completionsOn(events, now)
  const openToday = groups.late.length + groups.today.length
  const summary =
    openToday === 0
      ? groups.week.length
        ? `You’re clear for today. ${groups.week.length} coming up this week.`
        : 'You’re all clear. Nice work.'
      : `${groups.today.length ? `${groups.today.length} thing${groups.today.length === 1 ? '' : 's'} for today` : 'Nothing due today'}${groups.late.length ? `, ${groups.late.length} to catch up on` : ''}.`

  const row = (i: Item, opts: { late?: boolean } = {}) => (
    <QuestRow
      key={keyOf(i)}
      item={i}
      now={now}
      late={opts.late}
      course={courseMap.get(i.kind === 'assignment' ? i.a.courseId : (i.t.courseId ?? ''))}
      parent={i.kind === 'task' && i.t.assignmentId ? assignments.find((a) => a.id === i.t.assignmentId) : undefined}
      tasks={tasks}
      onDone={(k) => linger(k)}
      onOpen={() => (i.kind === 'assignment' ? navigate(`/assignments/${i.a.id}`) : i.t.assignmentId ? navigate(`/assignments/${i.t.assignmentId}`) : useUi.getState().edit({ kind: 'task', id: i.t.id }))}
    />
  )

  return (
    <Page className="max-w-4xl">
      <div className="mb-5">
        <p className="text-sm font-bold text-fg-3">{format(now, 'EEEE, MMMM d')}</p>
        <h1 className="text-3xl font-black tracking-tight">
          {greeting(now)}
          {prefs.displayName ? `, ${prefs.displayName}` : ''}
        </h1>
        <p className="mt-1 text-base font-bold text-fg-2" data-testid="day-summary">
          {summary}
        </p>
        <CanvasLine />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_250px]">
        <QuestCard done={done} goal={prefs.dailyGoal} />
        <LevelCard />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        <Group id="late" label="Late · catch up for half XP" tone="late" items={groups.late}>
          {groups.late.map((i) => row(i, { late: true }))}
        </Group>
        <Group id="today" label="Today" items={groups.today}>
          {groups.today.map((i) => row(i))}
        </Group>
        <Group id="week" label="This week" items={groups.week}>
          {groups.week.map((i) => row(i))}
        </Group>
        {groups.later.length > 0 && (
          <Group id="later" label="Later" items={groups.later}>
            {(showLater ? groups.later : groups.later.slice(0, 3)).map((i) => row(i))}
            {groups.later.length > 3 && (
              <button type="button" onClick={() => setShowLater((s) => !s)} className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-sm font-extrabold text-fg-3 hover:text-fg">
                <ChevronDown className={cn('size-4 transition-transform', showLater && 'rotate-180')} aria-hidden />
                {showLater ? 'Show less' : `Show ${groups.later.length - 3} more`}
              </button>
            )}
          </Group>
        )}

        {openToday + groups.week.length + groups.later.length === 0 && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-3d flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Trophy className="bob size-12 text-gold" aria-hidden />
            <p className="text-lg font-black">Nothing left on your list</p>
            <p className="text-sm font-semibold text-fg-3">Add new assignments as they’re announced to keep earning XP.</p>
          </motion.div>
        )}

        <Button variant="secondary" icon={Plus} className="self-start" onClick={() => openQuickAdd({ kind: 'assignment' })}>
          Add assignment or task
        </Button>

        {groups.doneToday.length > 0 && (
          <section aria-label="Done today">
            <button type="button" aria-expanded={showDone} onClick={() => setShowDone((s) => !s)} className="flex items-center gap-2 text-sm font-black text-success">
              <Trophy className="size-4" aria-hidden />
              {groups.doneToday.length} done today
              <ChevronDown className={cn('size-4 transition-transform', showDone && 'rotate-180')} aria-hidden />
            </button>
            <AnimatePresence initial={false}>
              {showDone && (
                <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 flex flex-col gap-2 overflow-hidden">
                  {groups.doneToday.map((i) => row(i))}
                </motion.ul>
              )}
            </AnimatePresence>
          </section>
        )}
      </div>
    </Page>
  )
}

function Group({ id, label, tone, items, children }: { id: string; label: string; tone?: 'late'; items: Item[]; children: React.ReactNode }) {
  if (!items.length) return null
  return (
    <section aria-labelledby={`g-${id}`}>
      <h2 id={`g-${id}`} className={cn('mb-2.5 text-xs font-black tracking-[0.12em] uppercase', tone === 'late' ? 'text-danger' : 'text-fg-3')}>
        {label}
      </h2>
      <motion.ul layout className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </motion.ul>
    </section>
  )
}

function QuestRow({ item, now, course, parent, tasks, late, onDone, onOpen }: { item: Item; now: Date; course: Course | undefined; parent?: Assignment; tasks: StudyTask[]; late?: boolean; onDone: (key: string) => void; onOpen: () => void }) {
  const isA = item.kind === 'assignment'
  const done = isA ? isAssignmentDone(item.a) : item.t.done
  const title = isA ? item.a.title : item.t.title
  const boss = isA && isBoss(item.a, tasks)
  const xp = isA ? xpForAssignmentNow(item.a, tasks, now) : xpForTaskNow(item.t, parent, now)
  const progress = isA ? checklistProgress(tasks, item.a.id) : null
  const dueAt = isA ? item.a.dueAt : (item.t.dueAt ?? null)
  const overdue = isA ? isAssignmentOverdue(item.a, now) : !!dueAt && !done && new Date(dueAt) < now
  const bucket = dueBucket(dueAt, now)
  const when = isA ? (overdue ? lateLabel(dueAt!, now) : bucket === 'today' ? format(new Date(dueAt!), 'h:mm a') : dueAt ? formatDueDay(dueAt, now) : 'No date') : item.t.plannedFor && item.t.plannedFor < toLocalDay(now) ? 'From earlier' : item.t.estimatedMinutes ? `${item.t.estimatedMinutes} min` : ''

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.3 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      whileHover={{ y: -2 }}
      className={cn(
        'card-3d group relative flex items-center gap-3.5 px-4 py-3 transition-colors duration-300 sm:gap-4 sm:px-5',
        late && !done && 'border-danger/30 bg-danger-soft/40',
        done && 'border-success-bright/50 bg-success-soft',
        boss && !done && 'border-accent/30',
      )}
    >
      <CheckButton
        checked={done}
        label={done ? `Undo ${title}` : `Complete ${title}`}
        onToggle={(el) => {
          if (!done) onDone(item.kind === 'assignment' ? `a:${item.a.id}` : `t:${item.t.id}`)
          if (isA) completeAssignment(item.a, el)
          else completeTask(item.t, el)
        }}
      />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-[18px] focus-visible:underline">
        <span className={cn('block truncate text-base font-extrabold sm:text-[17px]', done && 'text-fg-3 line-through decoration-2')}>{title}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm font-bold text-fg-2">
          {course && <CourseDot color={course.color} className="size-2.5" />}
          <span className="truncate">
            {course?.name ?? 'Personal'}
            {boss && progress && progress.total > 0 && ` · Boss, ${progress.done} of ${progress.total} stages`}
            {boss && (!progress || progress.total === 0) && ' · Boss level'}
            {!isA && parent && ` · step of ${parent.title}`}
          </span>
          <span className={cn('shrink-0 sm:hidden', overdue && !done ? 'text-danger' : 'text-fg-3')}>· {when}</span>
        </span>
      </button>
      {boss && !done && <Crown className="relative hidden size-5 shrink-0 fill-accent/20 text-accent sm:block" aria-label="Boss level" />}
      <XpChip amount={xp} tone={boss ? 'purple' : done ? 'muted' : 'gold'} className="relative max-sm:hidden" />
      <span className={cn('relative hidden w-28 shrink-0 text-right text-sm font-extrabold sm:block', overdue && !done ? 'text-danger' : 'text-fg-2')}>{done ? 'Done!' : when}</span>
    </motion.li>
  )
}

function CanvasLine() {
  const prefs = useStore((s) => s.prefs)
  const { syncing, needsReconnect } = useCanvasSync()
  const now = useNow(30_000)
  if (prefs.dataMode === 'demo')
    return (
      <Link to="/connect" className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-line bg-surface px-3 py-1 text-xs font-black text-accent-text transition-transform hover:-translate-y-0.5">
        <Plug className="size-3.5" aria-hidden /> Demo data · Connect Canvas to load your real classes
      </Link>
    )
  if (prefs.dataMode !== 'canvas') return null
  const mins = prefs.lastCanvasSyncAt ? Math.round((now.getTime() - new Date(prefs.lastCanvasSyncAt).getTime()) / 60000) : null
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-fg-3">
      {needsReconnect ? (
        <Link to="/connect" className="font-black text-danger hover:underline">
          Canvas sign-in expired · Reconnect
        </Link>
      ) : (
        <span>
          Synced with Canvas{mins == null ? '' : mins < 1 ? ' just now' : ` ${mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`} ago`}
        </span>
      )}
      <button id="canvas-sync-button" type="button" onClick={() => void syncCanvas()} disabled={syncing} className="inline-flex items-center gap-1 rounded-full border-2 border-line bg-surface px-2.5 py-0.5 font-black text-fg-2 hover:text-fg disabled:opacity-60" aria-label="Sync with Canvas now">
        <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} aria-hidden /> {syncing ? 'Syncing…' : 'Sync'}
      </button>
    </p>
  )
}

export function lateLabel(dueAt: string, now: Date): string {
  const days = differenceInCalendarDays(now, new Date(dueAt))
  return days <= 0 ? 'Due earlier today' : days === 1 ? 'Due yesterday' : `${days} days late`
}

function QuestCard({ done, goal }: { done: number; goal: number }) {
  const { days, todayDone } = useStreak()
  const complete = done >= goal
  return (
    <motion.section
      aria-label="Today’s quest"
      className="btn-3d relative flex items-center gap-5 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#7c5cff] to-[#5a3bf0] p-5 text-white [--press:rgb(0_0_0/0.2)] sm:p-6"
      animate={complete ? { scale: [1, 1.03, 1] } : {}}
      transition={{ duration: 0.5 }}
    >
      <span aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-14 left-1/3 size-32 rounded-full bg-white/5" />
      <Ring value={Math.min(1, done / goal)} size={96} color={complete ? '#4ade80' : '#ffcf4d'}>
        <span className="text-2xl leading-none font-black">
          {Math.min(done, goal)}/{goal}
          <span className="block text-[11px] font-extrabold opacity-80">done</span>
        </span>
      </Ring>
      <div className="relative min-w-0">
        <p className="text-xs font-black tracking-[0.14em] opacity-80">TODAY’S QUEST</p>
        <p className="mt-1 text-xl leading-tight font-black sm:text-2xl">{complete ? 'Quest complete! Today is a gold day.' : `Finish ${goal} things to ${days ? `keep your ${days}-day streak` : 'start a streak'}`}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold opacity-90">
          <Flame className={cn('size-4', todayDone && 'flicker fill-current')} aria-hidden />
          {complete ? `${days}-day streak · +50 bonus XP earned` : 'Reward: +50 bonus XP and a gold day'}
        </p>
      </div>
    </motion.section>
  )
}

function LevelCard() {
  const { level, title, into, needed, progress } = useXp()
  return (
    <Link to="/me" className="card-3d flex flex-col justify-center gap-2.5 p-4 transition-transform hover:-translate-y-0.5">
      <span className="flex items-center gap-3">
        <motion.span key={level} initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}>
          <LevelBadge level={level} />
        </motion.span>
        <span>
          <span className="block text-lg leading-tight font-black">Level {level}</span>
          <span className="text-sm font-bold text-fg-3">{title}</span>
        </span>
      </span>
      <ProgressBar value={progress} label="Progress to next level" />
      <span className="tabular text-xs font-bold text-fg-3">
        {into} / {needed} XP to level {level + 1}
      </span>
    </Link>
  )
}

function FirstRun() {
  const resetDemo = useStore((s) => s.resetDemoData)
  const navigate = useNavigate()
  return (
    <Page className="max-w-lg">
      <div className="card-3d mt-10 flex flex-col items-center gap-3 px-6 py-10 text-center">
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
          <LevelBadge level={1} size="lg" />
        </motion.div>
        <h1 className="text-2xl font-black">Level 1. Let’s go!</h1>
        <p className="font-semibold text-fg-2">Connect Canvas to bring in all your classes and assignments, then every one you finish earns XP.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button variant="primary" size="lg" icon={Plug} onClick={() => navigate('/connect')}>
            Connect Canvas
          </Button>
          <Button variant="secondary" icon={Plus} onClick={() => navigate('/courses?new=1')}>
            Add classes yourself
          </Button>
          <Button variant="ghost" onClick={resetDemo}>
            Try the demo
          </Button>
        </div>
      </div>
    </Page>
  )
}

