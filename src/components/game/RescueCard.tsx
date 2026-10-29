import { motion } from 'motion/react'
import { format } from 'date-fns'
import { LifeBuoy, Play, SkipForward } from 'lucide-react'
import { formatMinutes, parseLocalDay, toLocalDay } from '@/domain/dates'
import { xpForAssignmentNow } from '@/domain/game'
import { RESCUE_BONUS, RESCUE_DAILY_MINUTES, rescueSteps } from '@/domain/rescue'
import { useCourseMap } from '@/hooks/useData'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { useUi } from '@/store/ui'
import { completeAssignment, skipAssignment } from '@/game/actions'
import { CourseDot } from '@/components/course'
import { LockTag } from '@/components/LockTag'
import { CheckButton, ProgressBar, XpChip } from '@/components/game/GameUI'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'

function dayLabel(day: string, now: Date): string {
  const today = toLocalDay(now)
  const tomorrow = toLocalDay(new Date(now.getTime() + 86_400_000))
  if (day === today) return 'today'
  if (day === tomorrow) return 'tomorrow'
  return format(parseLocalDay(day)!, 'EEE')
}

/** The catch-up plan for late work, in its fixed order. Shown on Today while a plan is active. */
export function RescueCard() {
  const rescue = useStore((s) => s.prefs.rescue)
  const assignments = useStore((s) => s.assignments)
  const tasks = useStore((s) => s.tasks)
  const startFocus = useStore((s) => s.startFocus)
  const setFocusDialogOpen = useUi((s) => s.setFocusDialogOpen)
  const courseMap = useCourseMap()
  const now = useNow(60_000)
  if (!rescue) return null
  const steps = rescueSteps(rescue.ids, assignments, now)
  if (!steps.length) return null
  const open = steps.filter((s) => !s.done)
  const next = open[0]
  const lastDay = open.flatMap((s) => s.days).at(-1)
  const doneCount = steps.length - open.length

  return (
    <section aria-label="Late · Rescue plan" className="card-3d overflow-hidden border-danger/40 bg-danger-soft/40">
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <span className="btn-3d grid size-11 shrink-0 place-items-center rounded-2xl bg-danger text-white [--press:#b52f33]">
          <LifeBuoy className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-black text-danger">Rescue plan</h2>
          <p className="text-sm font-bold text-fg-2">
            {open.length ? `${open.length} late ${open.length === 1 ? 'thing' : 'things'} → done by ${lastDay ? dayLabel(lastDay, now) : 'soon'}. Smallest first, so you get wins fast.` : 'All caught up!'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 px-4 sm:px-5">
        <ProgressBar value={doneCount / steps.length} tone="green" height="h-2.5" className="flex-1" label="Rescue progress" />
        <span className="tabular text-xs font-black text-fg-2">
          {doneCount}/{steps.length}
        </span>
      </div>
      <ol className="mt-3 flex flex-col gap-1.5 px-3 sm:px-4">
        {steps.map((s, i) => {
          const a = assignments.find((x) => x.id === s.assignmentId)!
          const course = courseMap.get(s.courseId)
          return (
            <motion.li key={s.assignmentId} layout className={cn('flex items-center gap-2.5 rounded-2xl border-2 bg-surface px-2.5 py-2', s === next ? 'border-danger/50' : 'border-transparent', s.done && 'opacity-60')}>
              <CheckButton checked={s.done} label={s.done ? `Undo ${s.title}` : `Complete ${s.title}`} onToggle={(el) => completeAssignment(a, el)} />
              <span className={cn('tabular grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-white', s.done ? 'bg-success-bright' : 'bg-danger')}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm font-extrabold', s.done && 'line-through')}>{s.title}</span>
                <span className="flex items-center gap-1.5 truncate text-xs font-bold text-fg-3">
                  {course && <CourseDot color={course.color} className="size-2" />}
                  {course?.code || course?.name} · {formatMinutes(s.minutes)}
                  {s.days.length > 0 && ` · ${s.days.map((d) => dayLabel(d, now)).join(' + ')}`}
                </span>
                <LockTag a={a} now={now} className="mt-0.5" />
              </span>
              {!s.done && <XpChip amount={xpForAssignmentNow(a, tasks, now)} />}
              {!s.done && (
                <button type="button" onClick={() => skipAssignment(a)} aria-label={`Skip ${s.title}`} title="Skip: remove from CampusFlow" data-sfx="none" className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-fg">
                  <SkipForward className="size-4" strokeWidth={2.5} aria-hidden />
                </button>
              )}
            </motion.li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 pb-4 sm:px-5">
        {next && (
          <Button
            variant="danger"
            icon={Play}
            onClick={() => {
              startFocus({ title: next.title, courseId: next.courseId, assignmentId: next.assignmentId, taskId: null })
              setFocusDialogOpen(true)
            }}
          >
            Start step {steps.indexOf(next) + 1}
          </Button>
        )}
        <span className="text-xs font-black text-gold-text">+{RESCUE_BONUS} XP bonus when the plan is done</span>
        <p className="w-full text-[11px] font-semibold text-fg-3">Made by simple rules, not AI: smallest first, about {formatMinutes(RESCUE_DAILY_MINUTES)} a day. Late work earns half XP.</p>
      </div>
    </section>
  )
}
