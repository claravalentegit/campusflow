import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { addDays, format, isSameDay, isTomorrow } from 'date-fns'
import { BookOpen, Check, Clock, ExternalLink, GraduationCap, Mail, PartyPopper, Send, Timer, Undo2 } from 'lucide-react'
import { reopenEmail } from '@/domain/guide'
import { buildPlan, helpEmail, type PlanCard } from '@/domain/plan'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { toast, useUi } from '@/store/ui'
import { completeAssignment } from '@/game/actions'
import { cannons, celebrateCompletion, sfx } from '@/game/fx'
import { courseColor } from '@/components/course'
import { CheckButton, ProgressBar } from '@/components/game/GameUI'
import { EmailComposer, HelpButton } from '@/components/GradeGuide'
import { Page, usePageTitle } from '@/components/Page'
import { Button } from '@/components/ui/Button'
import { cn } from '@/components/ui/cn'

const PLAN_XP = 15

const KIND: Record<PlanCard['kind'], { label: string; icon: typeof Send; color: string }> = {
  'turn-in': { label: 'Turn in', icon: Send, color: '#6d4aff' },
  email: { label: 'Send an email', icon: Mail, color: '#0ea5a4' },
  learn: { label: 'Learn what you missed', icon: BookOpen, color: '#2f7fdc' },
  study: { label: 'Study for a test', icon: GraduationCap, color: '#d99500' },
  'ask-help': { label: 'Ask for help', icon: Mail, color: '#e0559a' },
}

/** The study plan: one card at a time. Do it, tap Done, get the next one. */
export function Plan() {
  usePageTitle('Plan')
  const now = useNow(60_000)
  const courses = useStore((s) => s.courses)
  const assignments = useStore((s) => s.assignments)
  const grades = useStore((s) => s.grades)
  const modules = useStore((s) => s.modules)
  const planDone = useStore((s) => s.prefs.planDone)
  const [later, setLater] = useState<string[]>([])
  const [finished, setFinished] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)

  const cards = useMemo(() => buildPlan({ courses, assignments, grades, modules, done: new Set(planDone.map((d) => d.id)) }, now), [courses, assignments, grades, modules, planDone, now])
  const ordered = useMemo(() => [...cards.filter((c) => !later.includes(c.id)), ...later.map((id) => cards.find((c) => c.id === id)).filter((c): c is PlanCard => !!c)], [cards, later])
  const current = ordered[0]
  const total = finished + cards.length

  const markDone = (card: PlanCard, el: Element | null) => {
    setDir(1)
    setFinished((n) => n + 1)
    setLater((l) => l.filter((id) => id !== card.id))
    if (card.kind === 'turn-in') {
      completeAssignment(card.t.a, el)
    } else {
      const st = useStore.getState()
      const xpId = `plan_${card.id}`
      st.updatePrefs({ planDone: [...st.prefs.planDone.filter((d) => d.id !== card.id), { id: card.id, at: new Date().toISOString() }].slice(-300) })
      st.addXpEvent({ id: xpId, at: new Date().toISOString(), amount: PLAN_XP, kind: 'task', refId: `plan:${card.id}` })
      celebrateCompletion(el, PLAN_XP)
      toast('Step done!', 'success', {
        label: 'Undo',
        run: () => {
          const s = useStore.getState()
          s.updatePrefs({ planDone: s.prefs.planDone.filter((d) => d.id !== card.id) })
          s.removeXpEvent(xpId)
          setFinished((n) => Math.max(0, n - 1))
        },
      })
    }
    if (cards.length === 1) setTimeout(cannons, 300)
  }

  const notNow = (card: PlanCard) => {
    setDir(-1)
    sfx.swish()
    setLater((l) => [...l.filter((id) => id !== card.id), card.id])
  }

  return (
    <Page className="max-w-2xl">
      <div className="mb-4">
        <h1 className="text-3xl font-black tracking-tight">Your plan</h1>
        <p className="font-bold text-fg-2">One step at a time. Do it, tap Done, and the next one appears.</p>
        <HelpButton />
      </div>

      {cards.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="tabular shrink-0 text-sm font-black text-fg-2">
            Step {Math.min(finished + 1, total)} of {total}
          </span>
          <ProgressBar value={total ? finished / total : 0} tone="green" height="h-3" className="flex-1" label="Plan progress" />
        </div>
      )}

      <div className="relative">
        {/* The rest of the deck peeks out from behind. */}
        {ordered.length > 1 && <div aria-hidden className="absolute inset-x-4 top-3 -bottom-3 rounded-[28px] border-2 border-line bg-surface opacity-70" />}
        {ordered.length > 2 && <div aria-hidden className="absolute inset-x-8 top-6 -bottom-6 rounded-[28px] border-2 border-line bg-surface opacity-40" />}
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          {current ? (
            <PlanCardView key={current.id} card={current} now={now} dir={dir} onDone={(el) => markDone(current, el)} onLater={() => notNow(current)} canSkip={ordered.length > 1} />
          ) : (
            <motion.section key="all-done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card-3d relative flex flex-col items-center gap-3 p-8 text-center" data-testid="plan-empty">
              <motion.span initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }} className="btn-3d grid size-20 place-items-center rounded-3xl bg-success-bright text-white [--press:var(--success-press)]">
                <PartyPopper className="size-10" aria-hidden />
              </motion.span>
              <p className="text-2xl font-black">{finished ? 'Plan complete!' : 'Nothing to fix right now'}</p>
              <p className="max-w-sm text-sm font-semibold text-fg-2">
                {finished ? `You finished ${finished} step${finished === 1 ? '' : 's'}. Your grades thank you.` : 'Your plan fills up when work is late or closed, or a test is coming up. Keep checking things off on Today.'}
              </p>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {ordered.length > 1 && (
        <section className="mt-10" aria-label="Coming up in your plan">
          <h2 className="mb-2 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">After this</h2>
          <ol className="flex flex-col gap-1.5">
            {ordered.slice(1, 4).map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm font-bold text-fg-3">
                <span className="size-2 shrink-0 rounded-full" style={{ background: KIND[c.kind].color }} aria-hidden />
                <span className="truncate">
                  {KIND[c.kind].label}: {titleOf(c)}
                </span>
              </li>
            ))}
            {ordered.length > 4 && <li className="text-xs font-bold text-fg-3">+ {ordered.length - 4} more</li>}
          </ol>
        </section>
      )}
    </Page>
  )
}

function titleOf(c: PlanCard): string {
  switch (c.kind) {
    case 'turn-in':
      return c.t.a.title
    case 'email':
      return c.items.length === 1 ? `ask ${c.course.instructor ?? 'your teacher'} to reopen “${c.items[0].title}”` : `ask ${c.course.instructor ?? 'your teacher'} to reopen ${c.items.length} assignments`
    case 'learn':
      return c.module.title
    case 'study':
      return c.exam.title
    case 'ask-help':
      return `${c.category.name} in ${c.course.name}`
  }
}

function closes(at: Date | null, now: Date): string | null {
  if (!at) return null
  if (isSameDay(at, now)) return `today at ${format(at, 'h:mm a')}`
  if (isTomorrow(at)) return `tomorrow at ${format(at, 'h:mm a')}`
  return format(at, 'EEEE, MMM d')
}

function PlanCardView({ card, now, dir, onDone, onLater, canSkip }: { card: PlanCard; now: Date; dir: 1 | -1; onDone: (el: Element | null) => void; onLater: () => void; canSkip: boolean }) {
  const reduce = useReducedMotion()
  const doneRef = useRef<HTMLButtonElement>(null)
  const student = useStore((s) => s.prefs.displayName) || 'your student'
  const toggleModuleItem = useStore((s) => s.toggleModuleItem)
  const modules = useStore((s) => s.modules)
  const startFocus = useStore((s) => s.startFocus)
  const setFocusDialogOpen = useUi((s) => s.setFocusDialogOpen)
  const k = KIND[card.kind]
  const isChecked = (moduleId: string, itemId: string) => !!modules.find((m) => m.id === moduleId)?.items.find((i) => i.id === itemId)?.completed

  const focus = (title: string, assignmentId: string | null) => {
    startFocus({ title, courseId: card.course.id, assignmentId, taskId: null })
    setFocusDialogOpen(true)
  }

  let body: React.ReactNode
  let doneLabel = 'Done'
  switch (card.kind) {
    case 'turn-in': {
      const when = closes(card.t.closesAt, now)
      body = (
        <>
          <p className={cn('font-bold', card.t.closesSoon ? 'text-danger' : 'text-fg-2')}>
            <Clock className="mr-1 inline size-4 align-[-3px]" aria-hidden />
            {when ? `Late, but Canvas still takes it until ${when}.` : 'Late, but Canvas still takes it.'}
            {card.t.worth != null && card.t.worth >= 0.5 && <span className="text-fg-3"> About {card.t.worth >= 10 ? Math.round(card.t.worth) : card.t.worth.toFixed(1)}% of your grade.</span>}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold text-fg-2">
            <li>Open it on Canvas and read what’s needed.</li>
            <li>Do what you can. Turning in something beats a zero.</li>
            <li>Submit it on Canvas, then tap Done here.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            {card.t.a.htmlUrl && (
              <a href={card.t.a.htmlUrl} target="_blank" rel="noopener noreferrer" className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-sm font-extrabold [--press:var(--line)]">
                Open in Canvas <ExternalLink className="size-4" aria-hidden />
              </a>
            )}
            <Button variant="secondary" icon={Timer} onClick={() => focus(card.t.a.title, card.t.a.id)}>
              Focus 25 min
            </Button>
          </div>
        </>
      )
      doneLabel = 'I turned it in'
      break
    }
    case 'email': {
      const draft = reopenEmail({ teacher: card.course.instructor, course: card.course.name, items: card.items, student, byDate: format(addDays(now, 2), 'EEEE, MMM d') })
      body = (
        <>
          <p className="font-bold text-fg-2">{card.items.length === 1 ? `“${card.items[0].title}” is closed on Canvas and may count as zero.` : `${card.items.length} assignments are closed on Canvas and may count as zero.`} A short, polite email is your best chance to get {card.items.length === 1 ? 'it' : 'them'} reopened.</p>
          <EmailComposer draft={draft} teacher={card.course.instructor} courseCanvasId={card.course.canvasId} rows={8} />
        </>
      )
      doneLabel = 'I sent it'
      break
    }
    case 'ask-help': {
      const draft = helpEmail({ teacher: card.course.instructor, course: card.course.name, category: card.category.name, student })
      body = (
        <>
          <p className="font-bold text-fg-2">
            {card.category.name} is {card.category.weight}% of this grade and you’re at {Math.round(card.category.percent)}%. Many teachers offer corrections, retakes or extra credit, but only to students who ask.
          </p>
          <EmailComposer draft={draft} teacher={card.course.instructor} courseCanvasId={card.course.canvasId} rows={8} />
        </>
      )
      doneLabel = 'I sent it'
      break
    }
    case 'learn':
      body = (
        <>
          <p className="font-bold text-fg-2">
            You missed {card.missed.map((a) => `“${a.title}”`).join(' and ')}, but this material can still be on tests. Go through it and check each one off.
          </p>
          <Lessons items={card.lessons.map((item) => ({ moduleId: card.module.id, item }))} isChecked={isChecked} toggle={toggleModuleItem} />
          <Button variant="secondary" icon={Timer} className="self-start" onClick={() => focus(`Learn: ${card.module.title}`, null)}>
            Focus 25 min
          </Button>
        </>
      )
      doneLabel = 'I learned it'
      break
    case 'study': {
      const due = new Date(card.exam.dueAt!)
      body = (
        <>
          <p className="font-bold text-fg-2">
            {card.exam.title} is {card.days === 0 ? 'today' : card.days === 1 ? 'tomorrow' : `in ${card.days} days`} ({format(due, 'EEE MMM d')}).{' '}
            {card.lessons.length ? 'Start with the lessons you haven’t finished:' : 'Review your notes and old quizzes, and do practice problems.'}
          </p>
          {card.lessons.length > 0 && <Lessons items={card.lessons.map((l) => ({ moduleId: l.module.id, item: l.item }))} isChecked={isChecked} toggle={toggleModuleItem} />}
          <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold text-fg-2">
            <li>Study in short sessions over several days, not all the night before.</li>
            <li>Test yourself: practice problems, flashcards, explaining it out loud.</li>
            <li>Write down what you don’t get and ask about it before the test.</li>
          </ol>
          <Button variant="secondary" icon={Timer} className="self-start" onClick={() => focus(`Study: ${card.exam.title}`, card.exam.id)}>
            Study 25 min
          </Button>
        </>
      )
      doneLabel = 'I’m ready'
      break
    }
  }

  return (
    <motion.section
      layout
      aria-label={`${k.label}: ${titleOf(card)}`}
      data-testid="plan-card"
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 120, rotate: dir * 4, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -dir * 260, rotate: -dir * 8, transition: { duration: 0.28 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="card-3d relative flex flex-col gap-4 p-5 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: k.color }}>
          <k.icon className="size-3.5" aria-hidden /> {k.label}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold text-fg-3">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: courseColor(card.course.color) }} aria-hidden />
          {card.course.name}
        </span>
      </div>
      <h2 className="text-2xl leading-tight font-black">{titleOf(card).replace(/^./, (c) => c.toUpperCase())}</h2>
      {body}
      <div className="mt-1 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-line pt-4">
        <Button ref={doneRef} variant="success" size="lg" icon={Check} onClick={() => onDone(doneRef.current)}>
          {doneLabel}
        </Button>
        {canSkip && (
          <Button variant="ghost" icon={Undo2} onClick={onLater} className="[&_svg]:-scale-x-100">
            Not now
          </Button>
        )}
      </div>
    </motion.section>
  )
}

function Lessons({ items, isChecked, toggle }: { items: Array<{ moduleId: string; item: { id: string; title: string; type: string } }>; isChecked: (m: string, i: string) => boolean; toggle: (m: string, i: string) => void }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map(({ moduleId, item }) => {
        const done = isChecked(moduleId, item.id)
        return (
          <li key={item.id} className={cn('flex items-center gap-2.5 rounded-xl bg-surface-2 px-2.5 py-2', done && 'opacity-70')}>
            <CheckButton
              checked={done}
              label={done ? `Undo ${item.title}` : `Learned ${item.title}`}
              onToggle={() => {
                if (!done) sfx.pop()
                toggle(moduleId, item.id)
              }}
            />
            <span className={cn('min-w-0 flex-1 truncate text-sm font-extrabold', done && 'line-through')}>{item.title}</span>
            <span className="shrink-0 text-xs font-bold text-fg-3 capitalize">{item.type}</span>
          </li>
        )
      })}
    </ul>
  )
}
