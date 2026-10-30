import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { addDays, format, isSameDay, isTomorrow } from 'date-fns'
import { ChevronDown, Copy, ExternalLink, HelpCircle, Mail, Target, TrendingUp } from 'lucide-react'
import { buildGuide, reopenEmail, type ClassGuide, type TurnIn } from '@/domain/guide'
import type { Assignment } from '@/domain/types'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { completeAssignment } from '@/game/actions'
import { courseColor } from '@/components/course'
import { CheckButton } from '@/components/game/GameUI'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Field'
import { cn } from '@/components/ui/cn'
import { fmtDate, tr, useT } from '@/i18n'
import { useLang } from '@/i18n'
import { msg } from '@/i18n/langs'

export function useGuide(): ClassGuide[] {
  const courses = useStore((s) => s.courses)
  const assignments = useStore((s) => s.assignments)
  const grades = useStore((s) => s.grades)
  const now = useNow(60_000)
  return useMemo(() => buildGuide(courses, assignments, grades, now), [courses, assignments, grades, now])
}

const pct = (n: number | null) => (n == null ? '–' : `${Math.round(n)}%`)

function closesLabel(t: TurnIn, now: Date): string {
  if (!t.closesAt) return t.late ? tr('Late, still open on Canvas') : ''
  const when = isSameDay(t.closesAt, now) ? tr('today at {time}', { time: fmtDate(t.closesAt, 'h:mm a') }) : isTomorrow(t.closesAt) ? tr('tomorrow at {time}', { time: fmtDate(t.closesAt, 'h:mm a') }) : fmtDate(t.closesAt, 'EEE MMM d')
  return t.closesSoon ? tr('Closes {when}!', { when }) : tr('Still open until {when}', { when })
}

/** Today: the Grade guide. One row per class that needs something; each opens into clear steps. */
export function GradeGuideCard() {
  const guide = useGuide()
  const needy = guide.filter((g) => g.needsHelp)
  const [open, setOpen] = useState<string | null>(() => needy[0]?.course.id ?? null)
  const [help, setHelp] = useState(false)
  const t = useT()
  if (!needy.length) return null
  return (
    <section aria-label={t('Grade guide')} className="card-3d overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <span className="btn-3d grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0ea5a4] text-white [--press:#0b7f7e]">
          <TrendingUp className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-black">{t('Grade guide')}</h2>
          <p className="text-sm font-bold text-fg-2">{t('What to do in each class to protect your grade. Only things you can still change.')}</p>
        </div>
        <Button size="sm" variant="secondary" icon={HelpCircle} onClick={() => setHelp(true)} className="shrink-0 max-sm:px-2.5" aria-label={t('How to raise your grade')}>
          <span className="max-sm:hidden">{t('How to raise your grade')}</span>
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-2 px-3 pb-3 sm:px-4 sm:pb-4">
        {needy.map((g) => {
          const isOpen = open === g.course.id
          const soon = g.turnIn.some((t) => t.closesSoon)
          return (
            <li key={g.course.id} className={cn('overflow-hidden rounded-2xl border-2 bg-surface', isOpen ? 'border-[#0ea5a4]' : 'border-line')}>
              <button type="button" aria-expanded={isOpen} data-sfx={isOpen ? 'close' : 'open'} onClick={() => setOpen(isOpen ? null : g.course.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                <span className="size-3 shrink-0 rounded-full" style={{ background: courseColor(g.course.color) }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">{g.course.name}</span>
                  <span className="block truncate text-xs font-bold text-fg-3">
                    {g.percent != null && `${pct(g.percent)} · `}
                    {[g.turnIn.length && t('{n} to turn in', { n: g.turnIn.length }), g.closed.length && t('{n} closed', { n: g.closed.length }), !g.turnIn.length && !g.closed.length && g.focus && t('focus on {name}', { name: g.focus.name })].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {soon && <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-black text-danger">{t('Closing soon')}</span>}
                <ChevronDown className={cn('size-5 shrink-0 text-fg-3 transition-transform', isOpen && 'rotate-180')} aria-hidden />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="border-t-2 border-dashed border-line px-3 pt-3 pb-4">
                      <ClassGuideSteps g={g} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </section>
  )
}

/** The numbered steps for one class. Also used inside the class cards on Courses. */
export function ClassGuideSteps({ g }: { g: ClassGuide }) {
  const now = useNow(60_000)
  const [showAll, setShowAll] = useState(false)
  const [email, setEmail] = useState<Assignment[] | null>(null)
  const t = useT()
  const steps: React.ReactNode[] = []
  const shown = showAll ? g.turnIn : g.turnIn.slice(0, 3)

  if (g.turnIn.length)
    steps.push(
      <div key="turn-in">
        <p className="font-black">{g.turnIn.length === 1 ? t('Turn this in while you still can') : t('Turn these in while you still can')}</p>
        <p className="mb-2 text-xs font-semibold text-fg-3">{t('Late is almost always better than a zero. Most important first.')}</p>
        <ul className="flex flex-col gap-1.5">
          {shown.map((x) => (
            <li key={x.a.id} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-2.5 py-2">
              <CheckButton checked={false} label={t('Complete {title}', { title: x.a.title })} onToggle={(el) => completeAssignment(x.a, el)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{x.a.title}</span>
                <span className={cn('block truncate text-xs font-bold', x.closesSoon ? 'text-danger' : 'text-fg-3')}>
                  {closesLabel(x, now)}
                  {x.worth != null && x.worth >= 0.5 && <span className="text-fg-3"> · {t('about {n}% of your grade', { n: x.worth >= 10 ? Math.round(x.worth) : x.worth.toFixed(1) })}</span>}
                </span>
              </span>
              {x.a.htmlUrl && (
                <a href={x.a.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={t('Open {title} in Canvas', { title: x.a.title })} className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-3 hover:bg-surface hover:text-fg">
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
        {g.turnIn.length > 3 && (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-1.5 text-xs font-black text-accent-text hover:underline">
            {showAll ? t('Show less') : t('+ {n} more', { n: g.turnIn.length - 3 })}
          </button>
        )}
      </div>,
    )

  if (g.closed.length)
    steps.push(
      <div key="ask">
        <p className="font-black">{t('Ask {teacher} to reopen what’s closed', { teacher: g.course.instructor ?? t('your teacher') })}</p>
        <p className="mb-2 text-xs font-semibold text-fg-2">
          {g.closed.length === 1 ? t('“{title}” is closed on Canvas and may count as zero.', { title: g.closed[0].title }) : t('{n} assignments are closed on Canvas and may count as zero.', { n: g.closed.length })} {t('Teachers often say yes when you ask politely and give a date.')}
        </p>
        <Button size="sm" variant="primary" icon={Mail} onClick={() => setEmail(g.closed)}>
          {t('Write the email')}
        </Button>
      </div>,
    )

  if (g.focus)
    steps.push(
      <div key="focus">
        <p className="flex items-center gap-1.5 font-black">
          <Target className="size-4 text-accent-text" aria-hidden /> {t('Focus on {name}', { name: g.focus.name })}
        </p>
        <p className="text-xs font-semibold text-fg-2">
          {t('{name} is {weight}% of this grade, and you’re at {pct}. Ask about corrections, retakes or extra credit, and give the next one extra study time.', { name: g.focus.name, weight: g.focus.weight, pct: pct(g.focus.percent) })}
        </p>
      </div>,
    )

  return (
    <div className="flex flex-col gap-3" data-testid="class-guide">
      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#0ea5a4] text-xs font-black text-white">{i + 1}</span>
            <div className="min-w-0 flex-1 text-sm">{s}</div>
          </li>
        ))}
      </ol>
      {g.percent != null && (g.ifZeros != null || g.ifTurnedIn != null) && (
        <p className="rounded-xl bg-[#e6f7f7] px-3 py-2 text-xs font-bold text-[#0b6b6a]" data-testid="guide-estimate">
          {t('Estimate: about')} <b>{pct(g.percent)}</b> {t('now.')}
          {g.ifZeros != null && Math.round(g.ifZeros) < Math.round(g.percent) && (
            <>
              {' '}
              {t('If the missing work counts as zero, it could drop to about')} <b>{pct(g.ifZeros)}</b>.
            </>
          )}
          {g.ifTurnedIn != null &&
            (Math.round(g.ifTurnedIn) > Math.round(g.percent) ? (
              <>
                {' '}
                {g.turnIn.length === 1 ? t('Turn in the open one with full credit: up to about') : t('Turn in the open ones with full credit: up to about')} <b>{pct(g.ifTurnedIn)}</b>.
              </>
            ) : (
              <>
                {' '}
                {g.turnIn.length === 1 ? t('Turning in the open one keeps you near') : t('Turning in the open ones keeps you near')} <b>{pct(Math.max(g.ifTurnedIn, g.percent))}</b>.
              </>
            ))}
        </p>
      )}
      {!steps.length && <p className="text-sm font-bold text-success">{t('You’re on track in this class. Keep it up!')}</p>}
      {email && <EmailDialog course={g.course.name} teacher={g.course.instructor} courseCanvasId={g.course.canvasId} items={email} onClose={() => setEmail(null)} />}
    </div>
  )
}

/** An email the student edits and sends themselves: copy it, open Canvas Inbox, or open their email app. */
export function EmailComposer({ draft, teacher, courseCanvasId, rows = 11 }: { draft: { subject: string; body: string }; teacher: string | null; courseCanvasId: string | null; rows?: number }) {
  const host = useStore((s) => s.prefs.canvasHost)
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const t = useT()
  const lang = useLang()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`)
      toast(t('Email copied. Paste it into Canvas Inbox or your school email.'))
    } catch {
      toast(t('Couldn’t copy. Select the text and copy it yourself.'), 'error')
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        {t('Subject')}
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        {t('Message')}
        <Textarea value={body} rows={rows} onChange={(e) => setBody(e.target.value)} className="text-sm leading-relaxed" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={Copy} onClick={() => void copy()}>
          {t('Copy email')}
        </Button>
        {host && (
          <a href={`https://${host}/conversations${courseCanvasId ? `?context_id=course_${courseCanvasId}` : ''}#filter=type=inbox`} target="_blank" rel="noopener noreferrer" className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-sm font-extrabold [--press:var(--line)]">
            {t('Open Canvas Inbox')} <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
        <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-sm font-extrabold [--press:var(--line)]">
          <Mail className="size-4" aria-hidden /> {t('Open in email app')}
        </a>
      </div>
      <p className="text-xs font-semibold text-fg-3">
        {t('Tip: in Canvas Inbox, choose the class, then {teacher} as the recipient, and paste.', { teacher: teacher ?? t('your teacher') })}
        {lang !== 'en' && ` ${t('The email is in English because your teachers read it.')}`}
      </p>
    </div>
  )
}

/** Ready-to-send email asking to reopen closed work. */
export function EmailDialog({ course, teacher, courseCanvasId, items, onClose }: { course: string; teacher: string | null; courseCanvasId: string | null; items: Assignment[]; onClose: () => void }) {
  const student = useStore((s) => s.prefs.displayName) || 'your student'
  const draft = reopenEmail({ teacher, course, items, student, byDate: format(addDays(new Date(), 2), 'EEEE, MMM d') })
  const t = useT()
  return (
    <Dialog open onClose={onClose} title={t('Ask to reopen')} description={t('Read it, change anything you like, then send it yourself. CampusFlow never sends messages for you.')} footer={<Button onClick={onClose}>{t('Close')}</Button>}>
      <EmailComposer draft={draft} teacher={teacher} courseCanvasId={courseCanvasId} />
    </Dialog>
  )
}

const TIPS: Array<{ title: string; text: string }> = [
  { title: msg('Turn in late work that’s still open'), text: msg('Late is almost always better than a zero. The Grade guide only shows work Canvas still accepts, most important first.') },
  { title: msg('Watch for “Closes soon”'), text: msg('Once Canvas locks an assignment, you can’t turn it in anymore. Do those first, even if it’s not your best work.') },
  { title: msg('Ask to reopen closed work'), text: msg('Send a short, polite message: say what you missed, say sorry, ask if it can be reopened (even for partial credit), and promise a date. The Grade guide writes it for you.') },
  { title: msg('Ask about corrections, retakes and extra credit'), text: msg('Especially for tests and other heavy categories. Many teachers offer them, but only to students who ask.') },
  { title: msg('Focus where it counts'), text: msg('Some categories are worth more. Open a class in Courses to see how it’s weighted.') },
  { title: msg('Talk to your teacher'), text: msg('A quick chat after class or during office hours goes a long way. Ask what would help your grade the most.') },
  { title: msg('Check for mistakes'), text: msg('If a grade on Canvas looks wrong, or work you turned in shows as missing, politely ask your teacher to check.') },
]

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tt = useT()
  return (
    <Dialog open={open} onClose={onClose} title={tt('How to raise your grade')} description={tt('Things that actually work. Start at the top.')} footer={<Button variant="primary" onClick={onClose}>{tt('Got it')}</Button>}>
      <ol className="flex flex-col gap-3">
        {TIPS.map((t, i) => (
          <li key={t.title} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#0ea5a4] text-sm font-black text-white">{i + 1}</span>
            <span className="text-sm">
              <b className="block font-black">{tt(t.title)}</b>
              <span className="font-semibold text-fg-2">{tt(t.text)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs font-semibold text-fg-3">{tt('CampusFlow never contacts teachers for you. Grade numbers are estimates; Canvas is the official record.')}</p>
    </Dialog>
  )
}

/** "How to raise your grade" button for the top of Today. */
export function HelpButton() {
  const [open, setOpen] = useState(false)
  const t = useT()
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-[#0ea5a4]/40 bg-[#e6f7f7] px-3 py-1 text-xs font-black text-[#0b6b6a] transition-transform hover:-translate-y-0.5">
        <HelpCircle className="size-3.5" aria-hidden /> {t('How to raise your grade')}
      </button>
      <HelpDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
