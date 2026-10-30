import { useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import { Check, Gift, Trophy } from 'lucide-react'
import { goalProgress, visibleGoals, type GoalRule } from '@/domain/goals'
import { useNow } from '@/hooks/useNow'
import { fmtDate, tr, useT } from '@/i18n'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { cannons, sfx } from '@/game/fx'
import { ProgressBar } from '@/components/game/GameUI'
import { cn } from '@/components/ui/cn'

export function goalRuleText(rule: GoalRule): string {
  const date = (d: string) => fmtDate(new Date(`${d}T12:00`), 'EEE MMM d')
  if (rule.kind === 'streak') return rule.weekdaysOnly ? tr('Finish at least {n} a day, {days} school days in a row', { n: rule.perDay, days: rule.days }) : tr('Finish at least {n} a day, {days} days in a row', { n: rule.perDay, days: rule.days })
  if (rule.kind === 'total') return tr('Finish {n} things by {date}', { n: rule.count, date: date(rule.by) })
  return rule.by ? tr('Get {cls} to {pct}% or more by {date}', { cls: rule.courseName, pct: rule.percent, date: date(rule.by) }) : tr('Get {cls} to {pct}% or more', { cls: rule.courseName, pct: rule.percent })
}

/** Today: goals a parent set, with their real-life reward. Progress comes from what you finish. */
export function RewardGoals() {
  const t = useT()
  const now = useNow(60_000)
  const goals = useStore((s) => s.prefs.familyGoals)
  const celebrated = useStore((s) => s.prefs.goalsCelebrated)
  const completions = useStore((s) => s.xpEvents)
  const courses = useStore((s) => s.courses)
  const grades = useStore((s) => s.grades)
  const assignments = useStore((s) => s.assignments)
  const rows = useMemo(() => {
    const data = { completions: completions.filter((e) => e.kind === 'assignment' || e.kind === 'task').map((e) => e.at), courses, grades, assignments }
    return visibleGoals(goals ?? [], now).map((g) => ({ g, p: goalProgress(g, data, now) }))
  }, [goals, completions, courses, grades, assignments, now])

  // Celebrate each goal once, the moment it's reached.
  useEffect(() => {
    const fresh = rows.filter(({ g, p }) => g.status === 'active' && p.reached && !celebrated.includes(g.id))
    if (!fresh.length) return
    useStore.getState().updatePrefs({ goalsCelebrated: [...celebrated, ...fresh.map((r) => r.g.id)].slice(-100) })
    sfx.quest()
    setTimeout(cannons, 250)
    for (const { g } of fresh) toast(tr('You earned a reward from {parent}: {reward}!', { parent: g.parentName, reward: `${g.emoji} ${g.reward}` }), 'success')
  }, [rows, celebrated])

  if (!rows.length) return null
  return (
    <section aria-label={t('Family rewards')} className="card-3d mt-4 overflow-hidden" data-testid="reward-goals">
      <div className="flex items-center gap-3 px-4 pt-4 sm:px-5">
        <span className="btn-3d grid size-10 shrink-0 place-items-center rounded-2xl bg-gold text-white [--press:var(--gold-press)]">
          <Gift className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-black">{t('Family rewards')}</h2>
          <p className="text-sm font-bold text-fg-2">{t('Goals your family set. They fill up as you finish things.')}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2 p-3 sm:p-4">
        {rows.map(({ g, p }) => {
          const ready = g.status === 'active' && p.reached
          return (
            <motion.li key={g.id} layout className={cn('flex flex-col gap-2 rounded-2xl border-2 bg-surface px-3 py-3', ready ? 'border-gold bg-gold-soft/40' : 'border-line')} data-testid="reward-goal">
              <div className="flex items-start gap-3">
                <span className="text-3xl leading-none" aria-hidden>
                  {g.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black">{g.reward}</span>
                  <span className="block text-sm font-bold text-fg-2">{goalRuleText(g.rule)}</span>
                  <span className="block text-xs font-bold text-fg-3">{t('From {parent}', { parent: g.parentName })}</span>
                </span>
              </div>
              {g.status === 'given' ? (
                <p className="flex items-center gap-1.5 text-sm font-black text-success">
                  <Check className="size-4" aria-hidden /> {t('{parent} gave you this reward', { parent: g.parentName })}
                </p>
              ) : ready ? (
                <p className="flex items-center gap-1.5 text-sm font-black text-gold-text">
                  <Trophy className="size-4" aria-hidden /> {t('You earned it! {parent} will give you: {reward}', { parent: g.parentName, reward: g.reward })}
                </p>
              ) : (
                <div>
                  <ProgressBar value={p.target ? Math.min(1, p.value / p.target) : 0} tone="gold" height="h-2.5" label={t('Goal progress')} />
                  <p className="mt-1 text-xs font-black text-fg-2">
                    {p.unit === 'days' ? t('{n} of {total} days in a row', { n: p.value, total: p.target }) : p.unit === 'things' ? t('{n} of {total} things', { n: p.value, total: p.target }) : p.value ? t('Now {n}% · goal {total}%', { n: p.value, total: p.target }) : t('No grade yet')}
                    {p.unit === 'days' && !!p.best && p.best > p.value && <span className="text-fg-3"> · {t('Best so far: {n} days', { n: p.best })}</span>}
                  </p>
                  {p.missed && <p className="text-xs font-bold text-danger">{t('The date passed. Ask about a new goal!')}</p>}
                </div>
              )}
            </motion.li>
          )
        })}
      </ul>
    </section>
  )
}
