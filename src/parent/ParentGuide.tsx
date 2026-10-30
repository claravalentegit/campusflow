import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { format } from 'date-fns'
import { BookOpen, Check, HandHeart, Heart, MessageCircleHeart, RefreshCw, Sparkles, Star, ThumbsDown } from 'lucide-react'
import { call } from '@/integrations/canvas/adapter'
import type { FamilySnapshot } from '@/integrations/family'
import { courseColor } from '@/components/course'
import { ProgressBar } from '@/components/game/GameUI'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'
import { cannons, sfx } from '@/game/fx'
import { buildParentGuide, weekKey, type ParentCard } from './guide'
import { DATE_LOCALE, fill, type Lang, type Strings } from './i18n'

const KIND: Record<ParentCard['kind'], { icon: typeof Heart; color: string; label: (t: Strings) => string }> = {
  good: { icon: Star, color: '#16a34a', label: (t) => t.kindGood },
  term: { icon: BookOpen, color: '#2f7fdc', label: (t) => t.kindTerm },
  focus: { icon: MessageCircleHeart, color: '#6d4aff', label: (t) => t.kindFocus },
  help: { icon: HandHeart, color: '#0ea5a4', label: (t) => t.kindHelp },
}

interface Progress {
  week: string
  done: string[]
}

function loadProgress(studentId: string, week: string): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(`campusflow:parent-guide:${studentId}`) ?? 'null') as Progress | null
    if (p && p.week === week && Array.isArray(p.done)) return p
  } catch {
    /* ignore */
  }
  return { week, done: [] }
}

function saveProgress(studentId: string, p: Progress) {
  try {
    localStorage.setItem(`campusflow:parent-guide:${studentId}`, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/** The parent's weekly guide: one card at a time, like the student's plan. */
export function ParentGuide({ t, lang, name, studentId, data }: { t: Strings; lang: Lang; name: string; studentId: string; data: FamilySnapshot }) {
  const now = useMemo(() => new Date(), [])
  const week = weekKey(now)
  const cards = useMemo(() => buildParentGuide(data, now), [data, now])
  const [progress, setProgress] = useState(() => loadProgress(studentId, week))
  const [later, setLater] = useState<string[]>([])
  const reduce = useReducedMotion()

  useEffect(() => setProgress(loadProgress(studentId, week)), [studentId, week])

  const left = cards.filter((c) => !progress.done.includes(c.id))
  const ordered = [...left.filter((c) => !later.includes(c.id)), ...later.map((id) => left.find((c) => c.id === id)).filter((c): c is ParentCard => !!c)]
  const current = ordered[0]
  const doneCount = cards.length - left.length

  const next = (card: ParentCard) => {
    sfx.pop()
    const p = { week, done: [...progress.done, card.id] }
    setProgress(p)
    saveProgress(studentId, p)
    setLater((l) => l.filter((id) => id !== card.id))
    if (left.length === 1) {
      setTimeout(cannons, 250)
      void call(`/api/parent/students/${studentId}/guide-done`, { method: 'POST', body: '{}' }).catch(() => {})
    }
  }
  const again = () => {
    const p = { week, done: [] }
    setProgress(p)
    saveProgress(studentId, p)
  }

  return (
    <section aria-label={t.guide} className="flex flex-col gap-4" data-testid="parent-guide">
      <div>
        <h2 className="text-2xl font-black">{t.guideTitle}</h2>
        <p className="text-sm font-bold text-fg-2">{fill(t.guideIntro, { name })}</p>
      </div>
      {current && (
        <div className="flex items-center gap-3">
          <span className="tabular shrink-0 text-sm font-black text-fg-2">{fill(t.step, { n: doneCount + 1, total: cards.length })}</span>
          <ProgressBar value={doneCount / cards.length} tone="green" height="h-3" className="flex-1" label={t.guide} />
        </div>
      )}
      <div className="relative">
        {ordered.length > 1 && <div aria-hidden className="absolute inset-x-4 top-3 -bottom-3 rounded-[28px] border-2 border-line bg-surface opacity-70" />}
        {ordered.length > 2 && <div aria-hidden className="absolute inset-x-8 top-6 -bottom-6 rounded-[28px] border-2 border-line bg-surface opacity-40" />}
        <AnimatePresence mode="popLayout" initial={false}>
          {current ? (
            <motion.article
              key={current.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 260, rotate: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="card-3d relative flex flex-col gap-4 p-5"
              data-testid="parent-guide-card"
              aria-label={KIND[current.kind].label(t)}
            >
              <span className="flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: KIND[current.kind].color }}>
                {(() => {
                  const Icon = KIND[current.kind].icon
                  return <Icon className="size-3.5" aria-hidden />
                })()}
                {KIND[current.kind].label(t)}
              </span>
              <CardBody card={current} t={t} lang={lang} name={name} />
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="lg" icon={Check} onClick={() => next(current)} className="flex-1 bg-[#0ea5a4] [--press:#0b7f7e]">
                  {t.next}
                </Button>
                {ordered.length > 1 && (
                  <Button variant="ghost" onClick={() => setLater((l) => [...l.filter((id) => id !== current.id), current.id])}>
                    {t.notNow}
                  </Button>
                )}
              </div>
            </motion.article>
          ) : (
            <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-3d flex flex-col items-center gap-3 p-8 text-center" data-testid="parent-guide-done">
              <span className="grid size-20 place-items-center rounded-3xl bg-[#0ea5a4] text-white">
                <Heart className="size-10" aria-hidden />
              </span>
              <p className="text-2xl font-black">{t.finishTitle}</p>
              <p className="max-w-sm text-sm font-semibold text-fg-2">{fill(t.finishText, { name })}</p>
              <Button variant="ghost" icon={RefreshCw} onClick={again}>
                {t.again}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-center text-xs font-semibold text-fg-3">{fill(t.ruleNote, { name })}</p>
    </section>
  )
}

function CardBody({ card, t, lang, name }: { card: ParentCard; t: Strings; lang: Lang; name: string }) {
  const date = (d: Date) => format(d, 'EEE MMM d', { locale: DATE_LOCALE[lang] })
  switch (card.kind) {
    case 'good':
      return (
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-black">{card.done > 0 ? fill(t.goodDone, { name, n: card.done }) : fill(t.goodNoneDone, { name })}</h3>
          <ul className="flex flex-col gap-1.5 text-sm font-bold text-fg-2">
            {card.streak > 0 && <Li icon={Sparkles}>{fill(t.goodStreak, { n: card.streak })}</Li>}
            {card.best && <Li icon={Star}>{fill(t.goodBest, { cls: card.best.name, pct: Math.round(card.best.percent) })}</Li>}
            {card.calm && <Li icon={Check}>{t.goodCalm}</Li>}
          </ul>
          <Tip>{t.goodTip}</Tip>
        </div>
      )
    case 'term': {
      const key = `term_${card.term}` as const
      const text = card.term === 'weighted' ? fill(t.term_weighted_text, { cls: card.examples[0], a: card.examples[1] ?? '', b: card.examples[2] ?? '' }) : fill(t[`${key}_text`], { name })
      return (
        <div className="flex flex-col gap-2">
          <h3 className="text-2xl font-black">“{t[key]}”</h3>
          <p className="text-base font-semibold">{text}</p>
          {card.term !== 'weighted' && (
            <div className="rounded-xl bg-surface-2 px-3 py-2 text-sm font-bold text-fg-2">
              {fill(t.termIn, { name })}
              <ul className="mt-1 list-inside list-disc font-extrabold text-fg">
                {card.examples.map((x) => (
                  <li key={x} className="truncate">
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )
    }
    case 'focus':
      return <FocusBody card={card} t={t} name={name} date={date} />
    case 'help':
      return (
        <ul className="flex flex-col gap-2">
          {t.helpTips.map((tip) => (
            <Li key={tip} icon={HandHeart}>
              <span className="text-base font-bold text-fg">{tip}</span>
            </Li>
          ))}
        </ul>
      )
  }
}

function FocusBody({ card, t, name, date }: { card: Extract<ParentCard, { kind: 'focus' }>; t: Strings; name: string; date: (d: Date) => string }) {
  const [variant, setVariant] = useState(0)
  const says = t[`say_${card.situation}`]
  const avoids = t[`avoid_${card.situation}`]
  const vars = { title: card.a.title, date: card.date ? date(card.date) : '', name }
  const why = [
    card.situation === 'late' && t.why_late,
    card.situation === 'late' && card.date && fill(t.why_closes, { date: date(card.date) }),
    card.situation === 'closed' && fill(t.why_closed, { name }),
    card.situation === 'big' && card.date && fill(t.why_big, { date: date(card.date) }),
    card.worth != null && card.worth >= 0.5 && fill(t.why_worth, { n: card.worth >= 10 ? Math.round(card.worth) : card.worth.toFixed(1) }),
  ].filter((x): x is string => !!x)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-black" style={{ color: courseColor(card.course.color) }}>
          <span className="size-2.5 rounded-full" style={{ background: courseColor(card.course.color) }} aria-hidden />
          {card.course.name} · {t[`sit_${card.situation}`]}
        </p>
        <h3 className="text-2xl font-black">{card.a.title}</h3>
      </div>
      <ul className="flex flex-col gap-1 text-sm font-bold text-fg-2">
        {why.map((w) => (
          <Li key={w} icon={BookOpen}>
            {w}
          </Li>
        ))}
      </ul>
      <div className="rounded-2xl border-2 border-success/40 bg-success-soft p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-black tracking-[0.1em] text-success uppercase">
            <MessageCircleHeart className="size-4" aria-hidden /> {t.trySaying}
          </span>
          <button type="button" data-sfx="click" onClick={() => setVariant((v) => (v + 1) % says.length)} className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-black text-success">
            <RefreshCw className="size-3.5" aria-hidden /> {t.otherWords}
          </button>
        </div>
        <AnimatePresence mode="wait">
          <motion.p key={variant} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-lg font-black text-fg" data-testid="try-saying">
            “{fill(says[variant % says.length], vars)}”
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="rounded-2xl bg-danger-soft p-3">
        <span className="mb-1 flex items-center gap-1.5 text-xs font-black tracking-[0.1em] text-danger uppercase">
          <ThumbsDown className="size-4" aria-hidden /> {t.avoid}
        </span>
        <ul className="text-sm font-bold text-fg-2">
          {avoids.map((x) => (
            <li key={x} className="line-through decoration-danger/50">
              “{x}”
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Li({ icon: Icon, children }: { icon: typeof Heart; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
      <span>{children}</span>
    </li>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return <p className={cn('rounded-xl bg-[#e6f7f7] px-3 py-2 text-sm font-bold text-[#0b6b6a]')}>{children}</p>
}
