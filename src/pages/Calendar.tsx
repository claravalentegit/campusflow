import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { addDays, format, isToday, startOfDay } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { buildCalendarItems, itemsOnDay, type CalendarItem } from '@/domain/calendar'
import { parseLocalDay, toLocalDay, weekDays } from '@/domain/dates'
import { isGoldDay } from '@/domain/game'
import { computeWorkload } from '@/domain/workload'
import { useAppData, useCourseMap, useVisibleCourseIds } from '@/hooks/useData'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { useUi } from '@/store/ui'
import { ProgressBar } from '@/components/game/GameUI'
import { Page, usePageTitle } from '@/components/Page'
import { Button, IconButton } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'

export function Calendar() {
  usePageTitle('Calendar')
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const anchor = parseLocalDay(params.get('date')) ?? startOfDay(now)
  const data = useAppData()
  const prefs = useStore((s) => s.prefs)
  const courseIds = useVisibleCourseIds()
  const days = weekDays(anchor, prefs.weekStartsOn)
  const items = useMemo(() => buildCalendarItems(data, now, { courseIds }), [data, now, courseIds])
  const load = useMemo(() => computeWorkload({ assignments: data.assignments, tasks: data.tasks, sessions: data.sessions, prefs, courseIds }, days[0], 7), [data, prefs, courseIds, days[0].getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  const gold = days.filter((d) => d <= now && isGoldDay(data.xpEvents, d, prefs.dailyGoal)).length
  const go = (d: Date) => setParams({ date: toLocalDay(d) }, { replace: true })

  return (
    <Page className="max-w-[1240px]">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-black tracking-tight">
          {format(days[0], 'MMM d')} – {format(days[6], days[0].getMonth() === days[6].getMonth() ? 'd' : 'MMM d')}
        </h1>
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Previous week" variant="secondary" onClick={() => go(addDays(anchor, -7))} />
          <Button variant="secondary" onClick={() => go(now)}>
            This week
          </Button>
          <IconButton icon={ChevronRight} label="Next week" variant="secondary" onClick={() => go(addDays(anchor, 7))} />
        </div>
        <div className="card-3d flex w-full items-center gap-3 px-4 py-2 sm:ml-auto sm:w-auto">
          <span className="text-sm font-black text-gold-text">Weekly goal</span>
          <ProgressBar value={gold / 5} className="w-32 sm:w-40" label="Gold days this week" />
          <span className="tabular text-sm font-black">{gold} / 5 gold days</span>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold text-fg-2">
        <Legend className="bg-surface-2 shadow-[inset_3px_0_0_var(--fg)]">Due</Legend>
        <Legend className="bg-accent-soft">Study time</Legend>
        <Legend className="bg-danger-soft">Late</Legend>
        <Legend className="bg-success-soft">Done</Legend>
        <span className="inline-flex items-center gap-1.5">
          <span className="grid size-4 place-items-center rounded-full bg-gold text-white">
            <Check className="size-2.5" strokeWidth={4} aria-hidden />
          </span>
          Gold day: daily quest done
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((d, i) => (
          <Day key={d.toISOString()} day={d} index={i} now={now} items={itemsOnDay(items, d)} busy={load[i]?.overloaded ?? false} gold={d <= now && isGoldDay(data.xpEvents, d, prefs.dailyGoal)} />
        ))}
      </div>
    </Page>
  )
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-3.5 rounded-[4px]', className)} aria-hidden />
      {children}
    </span>
  )
}

function Day({ day, index, now, items, busy, gold }: { day: Date; index: number; now: Date; items: CalendarItem[]; busy: boolean; gold: boolean }) {
  const openQuickAdd = useUi((s) => s.openQuickAdd)
  const edit = useUi((s) => s.edit)
  const navigate = useNavigate()
  const courseMap = useCourseMap()
  const today = isToday(day)
  const past = day < startOfDay(now)
  const open = (it: CalendarItem) => (it.ref.type === 'assignment' ? navigate(`/assignments/${it.ref.id}`) : edit({ kind: it.ref.type, id: it.ref.id }))

  return (
    <motion.section
      aria-label={format(day, 'EEEE MMMM d')}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 300, damping: 26 }}
      className={cn('card-3d group flex flex-col gap-2 p-3 lg:min-h-[480px]', today && 'border-accent bg-accent-soft/30', past && !today && 'opacity-80')}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={cn('text-xs font-black tracking-wider uppercase', today ? 'text-accent-text' : 'text-fg-3')}>{format(day, 'EEE')}</p>
          <p className={cn('tabular text-2xl leading-none font-black', today && 'text-accent-text')}>{format(day, 'd')}</p>
        </div>
        {gold ? (
          <motion.span
            initial={{ rotateY: 180, scale: 0.4 }}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 + index * 0.06 }}
            className="btn-3d shine grid size-9 place-items-center rounded-full bg-gold text-white [--press:var(--gold-press)]"
            aria-label="Gold day"
          >
            <Check className="size-4" strokeWidth={4} aria-hidden />
          </motion.span>
        ) : (
          <span className={cn('size-9 rounded-full border-[3px] border-dashed', today ? 'border-gold' : 'border-line-strong')} aria-label={past ? 'Not a gold day' : 'Not yet'} />
        )}
      </div>
      {busy && <span className="self-start rounded-lg bg-fire-soft px-2 py-0.5 text-[11px] font-black text-fire">BUSY DAY</span>}
      <ul className="flex flex-col gap-1.5">
        {items.map((it) => {
          const course = it.courseId ? courseMap.get(it.courseId) : undefined
          const style = it.overdue ? 'bg-danger-soft text-danger' : it.done ? 'bg-success-soft text-success line-through' : it.kind === 'session' ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 shadow-[inset_3px_0_0_var(--fg)]'
          return (
            <li key={it.key}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} type="button" onClick={() => open(it)} className={cn('w-full rounded-xl px-2.5 py-2 text-left text-sm leading-tight font-extrabold', style)}>
                {it.title}
                <span className="mt-0.5 block text-[11px] font-bold no-underline opacity-75">
                  {it.overdue ? 'Late' : it.allDay ? 'All day' : format(it.start, 'h:mm a')}
                  {course ? ` · ${course.name}` : ''}
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={() => openQuickAdd({ kind: 'session', day: toLocalDay(day) })} className="mt-auto flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-black text-fg-3 opacity-60 hover:bg-surface-2 hover:text-fg hover:opacity-100 focus-visible:opacity-100" aria-label={`Add to ${format(day, 'EEEE')}`}>
        <Plus className="size-3.5" aria-hidden /> Add
      </button>
    </motion.section>
  )
}

