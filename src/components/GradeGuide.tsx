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

export function useGuide(): ClassGuide[] {
  const courses = useStore((s) => s.courses)
  const assignments = useStore((s) => s.assignments)
  const grades = useStore((s) => s.grades)
  const now = useNow(60_000)
  return useMemo(() => buildGuide(courses, assignments, grades, now), [courses, assignments, grades, now])
}

const one = (g: ClassGuide) => (g.turnIn.length === 1 ? 'one' : 'ones')
const pct = (n: number | null) => (n == null ? '–' : `${Math.round(n)}%`)

function closesLabel(t: TurnIn, now: Date): string {
  if (!t.closesAt) return t.late ? 'Late, still open on Canvas' : ''
  const when = isSameDay(t.closesAt, now) ? `today ${format(t.closesAt, 'h:mm a')}` : isTomorrow(t.closesAt) ? `tomorrow ${format(t.closesAt, 'h:mm a')}` : format(t.closesAt, 'EEE MMM d')
  return t.closesSoon ? `Closes ${when}!` : `Still open until ${when}`
}

/** Today: the Grade guide. One row per class that needs something; each opens into clear steps. */
export function GradeGuideCard() {
  const guide = useGuide()
  const needy = guide.filter((g) => g.needsHelp)
  const [open, setOpen] = useState<string | null>(() => needy[0]?.course.id ?? null)
  const [help, setHelp] = useState(false)
  if (!needy.length) return null
  return (
    <section aria-label="Grade guide" className="card-3d overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4 sm:px-5">
        <span className="btn-3d grid size-11 shrink-0 place-items-center rounded-2xl bg-[#0ea5a4] text-white [--press:#0b7f7e]">
          <TrendingUp className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-black">Grade guide</h2>
          <p className="text-sm font-bold text-fg-2">What to do in each class to protect your grade. Only things you can still change.</p>
        </div>
        <Button size="sm" variant="secondary" icon={HelpCircle} onClick={() => setHelp(true)} className="shrink-0 max-sm:px-2.5" aria-label="How to raise your grade">
          <span className="max-sm:hidden">How to raise your grade</span>
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
                    {[g.turnIn.length && `${g.turnIn.length} to turn in`, g.closed.length && `${g.closed.length} closed`, !g.turnIn.length && !g.closed.length && g.focus && `focus on ${g.focus.name}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {soon && <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-black text-danger">Closing soon</span>}
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
  const steps: React.ReactNode[] = []
  const shown = showAll ? g.turnIn : g.turnIn.slice(0, 3)

  if (g.turnIn.length)
    steps.push(
      <div key="turn-in">
        <p className="font-black">Turn {g.turnIn.length === 1 ? 'this' : 'these'} in while you still can</p>
        <p className="mb-2 text-xs font-semibold text-fg-3">Late is almost always better than a zero. Most important first.</p>
        <ul className="flex flex-col gap-1.5">
          {shown.map((t) => (
            <li key={t.a.id} className="flex items-center gap-2.5 rounded-xl bg-surface-2 px-2.5 py-2">
              <CheckButton checked={false} label={`Complete ${t.a.title}`} onToggle={(el) => completeAssignment(t.a, el)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{t.a.title}</span>
                <span className={cn('block truncate text-xs font-bold', t.closesSoon ? 'text-danger' : 'text-fg-3')}>
                  {closesLabel(t, now)}
                  {t.worth != null && t.worth >= 0.5 && <span className="text-fg-3"> · about {t.worth >= 10 ? Math.round(t.worth) : t.worth.toFixed(1)}% of your grade</span>}
                </span>
              </span>
              {t.a.htmlUrl && (
                <a href={t.a.htmlUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${t.a.title} in Canvas`} className="grid size-8 shrink-0 place-items-center rounded-lg text-fg-3 hover:bg-surface hover:text-fg">
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              )}
            </li>
          ))}
        </ul>
        {g.turnIn.length > 3 && (
          <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-1.5 text-xs font-black text-accent-text hover:underline">
            {showAll ? 'Show less' : `+ ${g.turnIn.length - 3} more`}
          </button>
        )}
      </div>,
    )

  if (g.closed.length)
    steps.push(
      <div key="ask">
        <p className="font-black">Ask {g.course.instructor ?? 'your teacher'} to reopen what’s closed</p>
        <p className="mb-2 text-xs font-semibold text-fg-2">
          {g.closed.length === 1 ? `“${g.closed[0].title}” is` : `${g.closed.length} assignments are`} closed on Canvas and may count as zero. Teachers often say yes when you ask politely and give a date.
        </p>
        <Button size="sm" variant="primary" icon={Mail} onClick={() => setEmail(g.closed)}>
          Write the email
        </Button>
      </div>,
    )

  if (g.focus)
    steps.push(
      <div key="focus">
        <p className="flex items-center gap-1.5 font-black">
          <Target className="size-4 text-accent-text" aria-hidden /> Focus on {g.focus.name}
        </p>
        <p className="text-xs font-semibold text-fg-2">
          {g.focus.name} {g.focus.weight >= 50 ? 'is most of' : 'is'} {g.focus.weight}% of this grade, and you’re at {pct(g.focus.percent)}. Ask about corrections, retakes or extra credit, and give the next one extra study time.
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
          Estimate: about <b>{pct(g.percent)}</b> now.
          {g.ifZeros != null && Math.round(g.ifZeros) < Math.round(g.percent) && (
            <>
              {' '}
              If the missing work counts as zero, it could drop to about <b>{pct(g.ifZeros)}</b>.
            </>
          )}
          {g.ifTurnedIn != null &&
            (Math.round(g.ifTurnedIn) > Math.round(g.percent) ? (
              <>
                {' '}
                Turn in the open {one(g)} with full credit: up to about <b>{pct(g.ifTurnedIn)}</b>.
              </>
            ) : (
              <>
                {' '}
                Turning in the open {one(g)} keeps you near <b>{pct(Math.max(g.ifTurnedIn, g.percent))}</b>.
              </>
            ))}
        </p>
      )}
      {!steps.length && <p className="text-sm font-bold text-success">You’re on track in this class. Keep it up!</p>}
      {email && <EmailDialog course={g.course.name} teacher={g.course.instructor} courseCanvasId={g.course.canvasId} items={email} onClose={() => setEmail(null)} />}
    </div>
  )
}

/** A ready-to-send email. CampusFlow never sends anything: the student copies it or opens their email app. */
export function EmailDialog({ course, teacher, courseCanvasId, items, onClose }: { course: string; teacher: string | null; courseCanvasId: string | null; items: Assignment[]; onClose: () => void }) {
  const student = useStore((s) => s.prefs.displayName) || 'your student'
  const host = useStore((s) => s.prefs.canvasHost)
  const draft = reopenEmail({ teacher, course, items, student, byDate: format(addDays(new Date(), 2), 'EEEE, MMM d') })
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`)
      toast('Email copied. Paste it into Canvas Inbox or your school email.')
    } catch {
      toast('Couldn’t copy. Select the text and copy it yourself.', 'error')
    }
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title="Ask to reopen"
      description="Read it, change anything you like, then send it yourself. CampusFlow never sends messages for you."
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={Copy} onClick={() => void copy()}>
            Copy email
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          Subject
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          Message
          <Textarea value={body} rows={11} onChange={(e) => setBody(e.target.value)} className="text-sm leading-relaxed" />
        </label>
        <div className="flex flex-wrap gap-2">
          {host && (
            <a href={`https://${host}/conversations${courseCanvasId ? `?context_id=course_${courseCanvasId}` : ''}#filter=type=inbox`} target="_blank" rel="noopener noreferrer" className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-sm font-extrabold [--press:var(--line)]">
              Open Canvas Inbox <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
          <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} className="btn-3d inline-flex h-10 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 text-sm font-extrabold [--press:var(--line)]">
            <Mail className="size-4" aria-hidden /> Open in email app
          </a>
        </div>
        <p className="text-xs font-semibold text-fg-3">Tip: in Canvas Inbox, choose the class, then {teacher ?? 'your teacher'} as the recipient, and paste.</p>
      </div>
    </Dialog>
  )
}

const TIPS: Array<{ title: string; text: string }> = [
  { title: 'Turn in late work that’s still open', text: 'Late is almost always better than a zero. The Grade guide only shows work Canvas still accepts, most important first.' },
  { title: 'Watch for “Closes soon”', text: 'Once Canvas locks an assignment, you can’t turn it in anymore. Do those first, even if it’s not your best work.' },
  { title: 'Ask to reopen closed work', text: 'Send a short, polite message: say what you missed, say sorry, ask if it can be reopened (even for partial credit), and promise a date. The Grade guide writes it for you.' },
  { title: 'Ask about corrections, retakes and extra credit', text: 'Especially for tests and other heavy categories. Many teachers offer them, but only to students who ask.' },
  { title: 'Focus where it counts', text: 'Some categories are worth more. Open a class in Courses to see how it’s weighted.' },
  { title: 'Talk to your teacher', text: 'A quick chat after class or during office hours goes a long way. Ask what would help your grade the most.' },
  { title: 'Check for mistakes', text: 'If a grade on Canvas looks wrong, or work you turned in shows as missing, politely ask your teacher to check.' },
]

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="How to raise your grade" description="Things that actually work. Start at the top." footer={<Button variant="primary" onClick={onClose}>Got it</Button>}>
      <ol className="flex flex-col gap-3">
        {TIPS.map((t, i) => (
          <li key={t.title} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#0ea5a4] text-sm font-black text-white">{i + 1}</span>
            <span className="text-sm">
              <b className="block font-black">{t.title}</b>
              <span className="font-semibold text-fg-2">{t.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs font-semibold text-fg-3">CampusFlow never contacts teachers for you. Grade numbers are estimates; Canvas is the official record.</p>
    </Dialog>
  )
}

/** "How to raise your grade" button for the top of Today. */
export function HelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-[#0ea5a4]/40 bg-[#e6f7f7] px-3 py-1 text-xs font-black text-[#0b6b6a] transition-transform hover:-translate-y-0.5">
        <HelpCircle className="size-3.5" aria-hidden /> How to raise your grade
      </button>
      <HelpDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
