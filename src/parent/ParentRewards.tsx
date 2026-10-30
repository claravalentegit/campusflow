import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { addDays, format } from 'date-fns'
import { Check, Gift, Plus, Trash2, Trophy } from 'lucide-react'
import { goalProgress, REWARD_EMOJIS, type GoalRule, type RewardGoal } from '@/domain/goals'
import { call, CanvasError } from '@/integrations/canvas/adapter'
import type { FamilySnapshot } from '@/integrations/family'
import { cannons, sfx } from '@/game/fx'
import { courseColor } from '@/components/course'
import { ProgressBar } from '@/components/game/GameUI'
import { Button } from '@/components/ui/Button'
import { confirm } from '@/components/ui/Dialog'
import { cn } from '@/components/ui/cn'
import { toast } from '@/store/ui'
import { DATE_LOCALE, fill, type Lang, type Strings } from './i18n'

const TEAL = '#0ea5a4'
const day = (d: Date) => format(d, 'yyyy-MM-dd')

/** "Finish at least 2 a day, 15 school days in a row", in the parent's language. */
export function ruleText(rule: GoalRule, t: Strings, lang: Lang): string {
  const date = (d: string) => format(new Date(`${d}T12:00`), 'EEE MMM d', { locale: DATE_LOCALE[lang] })
  if (rule.kind === 'streak') return fill(rule.weekdaysOnly ? t.rule_streak_school : t.rule_streak_any, { n: rule.perDay, days: rule.days })
  if (rule.kind === 'total') return fill(t.rule_total, { n: rule.count, date: date(rule.by) })
  return fill(rule.by ? t.rule_grade_by : t.rule_grade, { cls: rule.courseName, pct: rule.percent, date: rule.by ? date(rule.by) : '' })
}

/** Parent → Rewards: goals with a real-life reward, tracked from the student's real work. */
export function ParentRewards({ t, lang, name, studentId, parentId, data, goals, onGoals }: { t: Strings; lang: Lang; name: string; studentId: string; parentId: string | null; data: FamilySnapshot; goals: RewardGoal[]; onGoals: (g: RewardGoal[]) => void }) {
  const now = useMemo(() => new Date(), [])
  const [adding, setAdding] = useState(false)
  const goalData = useMemo(() => ({ completions: data.completions, courses: data.courses, grades: data.grades, assignments: data.assignments }), [data])
  const rows = goals
    .filter((g) => g.status !== 'cancelled')
    .map((g) => ({ g, p: goalProgress(g, goalData, now) }))
    .sort((a, b) => Number(b.g.status === 'active' && b.p.reached) - Number(a.g.status === 'active' && a.p.reached) || Number(a.g.status === 'given') - Number(b.g.status === 'given'))

  const post = async (path: string, body: unknown) => {
    try {
      const r = await call<{ goals: RewardGoal[] }>(`/api/parent/students/${studentId}/goals${path}`, { method: 'POST', body: JSON.stringify(body) })
      onGoals(r.goals)
      return true
    } catch (e) {
      toast(e instanceof CanvasError && e.status ? e.message : t.errorGeneric, 'error')
      return false
    }
  }
  const give = async (g: RewardGoal) => {
    if (await post(`/${g.id}`, { action: 'given' })) {
      sfx.quest()
      setTimeout(cannons, 200)
    }
  }
  const cancel = async (g: RewardGoal) => {
    if (await confirm({ title: t.cancelGoal, message: fill(t.cancelConfirm, { name }), confirmLabel: t.cancelGoal, cancelLabel: t.keepGoal })) await post(`/${g.id}`, { action: 'cancel' })
  }

  return (
    <section aria-label={t.rewards} className="flex flex-col gap-4" data-testid="parent-rewards">
      <div>
        <h2 className="text-2xl font-black">{t.rewardsTitle}</h2>
        <p className="text-sm font-bold text-fg-2">{fill(t.rewardsIntro, { name })}</p>
      </div>

      {rows.length === 0 && !adding && <p className="card-3d p-4 text-sm font-bold text-fg-3">{t.noGoals}</p>}

      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {rows.map(({ g, p }) => {
            const ready = g.status === 'active' && p.reached
            const mine = g.parentId === parentId
            return (
              <motion.li key={g.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn('card-3d flex flex-col gap-3 p-4', ready && 'border-gold bg-gold-soft/40')} data-testid="reward-goal">
                <div className="flex items-start gap-3">
                  <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl text-2xl', ready ? 'bg-gold' : 'bg-surface-2')} aria-hidden>
                    {g.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg leading-tight font-black">{g.reward}</span>
                    <span className="block text-sm font-bold text-fg-2">{ruleText(g.rule, t, lang)}</span>
                    <span className="block text-xs font-bold text-fg-3">{mine ? t.fromYou : fill(t.fromOther, { name: g.parentName })}</span>
                  </span>
                  {mine && g.status === 'active' && (
                    <button type="button" onClick={() => void cancel(g)} aria-label={t.cancelGoal} className="grid size-9 shrink-0 place-items-center rounded-xl text-fg-3 hover:bg-surface-2 hover:text-fg">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                {g.status === 'given' ? (
                  <p className="flex items-center gap-1.5 text-sm font-black text-success">
                    <Check className="size-4" aria-hidden /> {t.givenOn}
                  </p>
                ) : ready ? (
                  <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3 text-center">
                    <p className="flex items-center justify-center gap-2 text-lg font-black">
                      <Trophy className="size-5 text-gold" aria-hidden /> {fill(t.reached, { name })}
                    </p>
                    <p className="text-sm font-bold text-fg-2">{fill(t.giveNow, { reward: `${g.emoji} ${g.reward}` })}</p>
                    {mine && (
                      <Button variant="primary" icon={Gift} onClick={() => void give(g)} className="bg-[#0ea5a4] [--press:#0b7f7e]">
                        {t.gaveIt}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <ProgressBar value={p.target ? Math.min(1, p.value / p.target) : 0} tone="green" height="h-3" label={t.theGoal} />
                    <p className="text-xs font-black text-fg-2">
                      {p.unit === 'days' ? fill(t.prog_days, { n: p.value, total: p.target }) : p.unit === 'things' ? fill(t.prog_things, { n: p.value, total: p.target }) : p.value ? fill(t.prog_grade, { n: p.value, total: p.target }) : t.prog_grade_none}
                      {p.unit === 'days' && !!p.best && p.best > p.value && <span className="text-fg-3"> · {fill(t.prog_best, { n: p.best })}</span>}
                    </p>
                    {p.missed && <p className="text-xs font-bold text-danger">{t.missed}</p>}
                  </div>
                )}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>

      {adding ? (
        <GoalForm t={t} lang={lang} data={data} onCancel={() => setAdding(false)} onSave={async (goal) => (await post('', { goal, today: day(new Date()) })) && setAdding(false)} />
      ) : (
        <Button variant="primary" size="lg" icon={Plus} onClick={() => setAdding(true)} className="bg-[#0ea5a4] [--press:#0b7f7e]">
          {t.newGoal}
        </Button>
      )}
      <p className="text-center text-xs font-semibold text-fg-3">{t.rewardsNote}</p>
    </section>
  )
}

function Chips<T extends string | number>({ value, options, onChange, label, render }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string; render?: (v: T) => string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o)} type="button" role="radio" aria-checked={o === value} data-sfx="click" onClick={() => onChange(o)} className={cn('h-11 min-w-11 rounded-xl border-2 px-3 text-base font-black', o === value ? 'border-[#0ea5a4] bg-[#e6f7f7] text-[#0b6b6a]' : 'border-line bg-surface text-fg-2')}>
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  )
}

function GoalForm({ t, lang, data, onSave, onCancel }: { t: Strings; lang: Lang; data: FamilySnapshot; onSave: (g: { rule: GoalRule; reward: string; emoji: string; startDay: string }) => Promise<unknown>; onCancel: () => void }) {
  const courses = data.courses.filter((c) => c.status === 'active')
  const [kind, setKind] = useState<GoalRule['kind']>('streak')
  const [perDay, setPerDay] = useState(2)
  const [days, setDays] = useState(15)
  const [weekdaysOnly, setWeekdaysOnly] = useState(true)
  const [count, setCount] = useState(20)
  const [by, setBy] = useState(day(addDays(new Date(), 14)))
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [percent, setPercent] = useState(90)
  const [gradeBy, setGradeBy] = useState('')
  const [emoji, setEmoji] = useState<string>('💵')
  const [reward, setReward] = useState('')
  const [busy, setBusy] = useState(false)
  const course = courses.find((c) => c.id === courseId)
  const rule: GoalRule =
    kind === 'streak' ? { kind, perDay, days, weekdaysOnly } : kind === 'total' ? { kind, count, by } : { kind, courseId, courseName: course?.name ?? '', percent, by: gradeBy || null }
  const valid = reward.trim() && (kind !== 'grade' || course) && (kind !== 'total' || by >= day(new Date()))
  const field = 'h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base font-bold outline-none focus:border-[#0ea5a4]'

  return (
    <motion.form
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-3d flex flex-col gap-4 p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!valid || busy) return
        setBusy(true)
        await onSave({ rule, reward: reward.trim(), emoji, startDay: day(new Date()) })
        setBusy(false)
      }}
      data-testid="goal-form"
    >
      <div>
        <p className="mb-2 text-sm font-black">{t.goalKind}</p>
        <div role="radiogroup" aria-label={t.goalKind} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['streak', 'total', 'grade'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} data-sfx="click" onClick={() => setKind(k)} disabled={k === 'grade' && !courses.length} className={cn('rounded-2xl border-2 px-3 py-2.5 text-left disabled:opacity-50', kind === k ? 'border-[#0ea5a4] bg-[#e6f7f7]' : 'border-line bg-surface')}>
              <span className="block font-black">{k === 'streak' ? t.kindStreak : k === 'total' ? t.kindTotal : t.kindGrade}</span>
              <span className="block text-xs font-bold text-fg-3">{k === 'streak' ? t.kindStreakSub : k === 'total' ? t.kindTotalSub : t.kindGradeSub}</span>
            </button>
          ))}
        </div>
      </div>

      {kind === 'streak' && (
        <>
          <div>
            <p className="mb-2 text-sm font-black">{t.perDay}</p>
            <Chips label={t.perDay} value={perDay} options={[1, 2, 3, 4, 5]} onChange={setPerDay} />
          </div>
          <div>
            <p className="mb-2 text-sm font-black">{t.forDays}</p>
            <Chips label={t.forDays} value={days} options={[5, 10, 15, 20, 30, 40]} onChange={setDays} />
            <p className="mt-1 text-xs font-bold text-fg-3">{t.weeksHint}</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={weekdaysOnly} onChange={(e) => setWeekdaysOnly(e.target.checked)} className="size-5 accent-[#0ea5a4]" />
            {t.schoolDaysOnly}
          </label>
        </>
      )}

      {kind === 'total' && (
        <>
          <div>
            <p className="mb-2 text-sm font-black">{t.howMany}</p>
            <Chips label={t.howMany} value={count} options={[5, 10, 20, 30, 50]} onChange={setCount} />
          </div>
          <label className="flex flex-col gap-1 text-sm font-black">
            {t.byWhen}
            <input type="date" value={by} min={day(new Date())} onChange={(e) => setBy(e.target.value)} className={field} />
          </label>
        </>
      )}

      {kind === 'grade' && (
        <>
          <label className="flex flex-col gap-1 text-sm font-black">
            {t.whichClass}
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={field}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {course && <span className="-mt-2 h-1.5 w-16 rounded-full" style={{ background: courseColor(course.color) }} aria-hidden />}
          <div>
            <p className="mb-2 text-sm font-black">{t.whatGrade}</p>
            <Chips label={t.whatGrade} value={percent} options={[70, 80, 85, 90, 95]} onChange={setPercent} render={(v) => `${v}%`} />
          </div>
          <label className="flex flex-col gap-1 text-sm font-black">
            {t.byWhenOptional}
            <input type="date" value={gradeBy} min={day(new Date())} onChange={(e) => setGradeBy(e.target.value)} className={field} />
          </label>
        </>
      )}

      <div>
        <p className="mb-2 text-sm font-black">{t.theReward}</p>
        <Chips label={t.rewardEmoji} value={emoji} options={REWARD_EMOJIS} onChange={setEmoji} />
        <input value={reward} maxLength={60} onChange={(e) => setReward(e.target.value)} placeholder={t.rewardPlaceholder} aria-label={t.theReward} className={cn(field, 'mt-2')} />
      </div>

      <div className="rounded-2xl bg-[#e6f7f7] p-3 text-[#0b6b6a]">
        <p className="text-xs font-black tracking-[0.1em] uppercase">{t.theGoal}</p>
        <p className="font-black">{ruleText(rule, t, lang)}</p>
        <p className="font-bold">
          → {emoji} {reward.trim() || '…'}
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="lg" icon={Check} disabled={!valid || busy} className="flex-1 bg-[#0ea5a4] [--press:#0b7f7e]" style={{ ['--accent' as string]: TEAL }}>
          {t.setGoal}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </motion.form>
  )
}
