import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isSameDay } from 'date-fns'
import { ChevronDown, Flame, Globe, Lightbulb, LogOut, Megaphone, UserPlus } from 'lucide-react'
import { isAssignmentDone, isAssignmentOverdue } from '@/domain/assignments'
import { parseInstant } from '@/domain/dates'
import { letterGrade, summarizeCourseGrades } from '@/domain/grades'
import type { Course, GradeRecord } from '@/domain/types'
import { call, CanvasError } from '@/integrations/canvas/adapter'
import type { FamilySnapshot } from '@/integrations/family'
import { courseColor } from '@/components/course'
import { Ring } from '@/components/game/GameUI'
import { BrandMark } from '@/components/layout/Brand'
import { Button } from '@/components/ui/Button'
import { confirm, ConfirmHost } from '@/components/ui/Dialog'
import { Toaster } from '@/components/ui/Toaster'
import { cn } from '@/components/ui/cn'
import { DATE_LOCALE, fill, STRINGS, type Lang, type Strings } from './i18n'

/**
 * CampusFlow Family: what a linked parent sees. Read-only, in plain words, in English or Spanish.
 * Everything comes from the snapshot the student's own CampusFlow shares.
 */

interface Me {
  name: string
  students: Array<{ id: string; name: string; active: boolean; removedAt: string | null; updatedAt: string | null }>
}
interface View {
  studentName: string
  updatedAt: string | null
  data: FamilySnapshot | null
}
type Item = FamilySnapshot['assignments'][number]

const TEAL = '#0ea5a4'

function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('campusflow:parent-lang')
      if (saved === 'en' || saved === 'es') return saved
    } catch {
      /* ignore */
    }
    return navigator.language?.startsWith('es') ? 'es' : 'en'
  })
  return [
    lang,
    (l) => {
      setLang(l)
      try {
        localStorage.setItem('campusflow:parent-lang', l)
      } catch {
        /* ignore */
      }
    },
  ]
}

export function ParentApp() {
  const [lang, setLang] = useLang()
  const t = STRINGS[lang]
  const [params, setParams] = useSearchParams()
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [joining, setJoining] = useState(!!params.get('code'))
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    document.title = t.brand
  }, [t.brand])

  const loadMe = useCallback(async () => {
    try {
      const m = await call<Me>('/api/parent/me')
      setMe(m)
      setSelected((s) => (s && m.students.some((x) => x.id === s) ? s : (m.students.find((x) => x.active)?.id ?? m.students[0]?.id ?? null)))
      return m
    } catch {
      setMe(null)
      return null
    }
  }, [])

  useEffect(() => {
    void loadMe()
  }, [loadMe])

  const showJoin = me === null || joining
  return (
    <div className="min-h-dvh bg-[linear-gradient(#e6f7f7,var(--bg)_320px)] pb-12" style={{ ['--accent' as string]: TEAL }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-5 pb-2">
        <span className="flex items-center gap-2 text-lg font-black">
          <BrandMark className="size-8" /> CampusFlow <span style={{ color: TEAL }}>{lang === 'es' ? 'Familia' : 'Family'}</span>
        </span>
        <button type="button" onClick={() => setLang(lang === 'en' ? 'es' : 'en')} className="flex items-center gap-1.5 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-sm font-black" aria-label={lang === 'en' ? 'Cambiar a español' : 'Switch to English'}>
          <Globe className="size-4" aria-hidden /> {lang === 'en' ? 'Español' : 'English'}
        </button>
      </header>
      <main className="mx-auto max-w-3xl px-4">
        {me === undefined ? null : showJoin ? (
          <Join
            t={t}
            initialCode={params.get('code') ?? ''}
            canCancel={!!me}
            onCancel={() => setJoining(false)}
            onLinked={async () => {
              setParams({}, { replace: true })
              setJoining(false)
              const m = await loadMe()
              if (m) setSelected(m.students[m.students.length - 1]?.id ?? null)
            }}
          />
        ) : (
          me && (
            <Dashboard
              t={t}
              lang={lang}
              me={me}
              selected={selected}
              onSelect={setSelected}
              onAdd={() => setJoining(true)}
              onUnlinked={() => {
                setMe(null)
                setSelected(null)
              }}
            />
          )
        )}
      </main>
      <ConfirmHost />
      <Toaster />
    </div>
  )
}

function Join({ t, initialCode, canCancel, onCancel, onLinked }: { t: Strings; initialCode: string; canCancel: boolean; onCancel: () => void; onLinked: () => void }) {
  const [code, setCode] = useState(initialCode.replace(/\D/g, '').slice(0, 6))
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('campusflow:parent-name') ?? ''
    } catch {
      return ''
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await call('/api/parent/link', { method: 'POST', body: JSON.stringify({ code, name }) })
      try {
        localStorage.setItem('campusflow:parent-name', name)
      } catch {
        /* ignore */
      }
      onLinked()
    } catch (err) {
      setError(err instanceof CanvasError && err.status ? err.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }
  return (
    <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="card-3d mx-auto mt-6 flex max-w-md flex-col gap-4 p-6 text-center">
      <span className="text-5xl" aria-hidden>
        👨‍👩‍👧
      </span>
      <h1 className="text-2xl font-black">{t.joinTitle}</h1>
      <p className="text-sm font-semibold text-fg-2">{t.joinHelp}</p>
      <label className="flex flex-col gap-1 text-left text-sm font-extrabold">
        {t.code}
        <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="h-14 rounded-2xl border-[3px] border-[#0ea5a4] bg-surface text-center text-3xl font-black tracking-[0.3em] outline-none" aria-label={t.code} />
      </label>
      <label className="flex flex-col gap-1 text-left text-sm font-extrabold">
        {t.yourName}
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl border-2 border-line bg-surface px-3 text-lg font-bold outline-none focus:border-[#0ea5a4]" aria-label={t.yourName} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={busy || code.length !== 6 || !name.trim()} className="bg-[#0ea5a4] [--press:#0b7f7e]">
        {busy ? t.linking : t.link}
      </Button>
      {canCancel && (
        <Button variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
      )}
      <p className="text-xs font-semibold text-fg-3">{t.privacy}</p>
      <p className="text-xs font-semibold text-fg-3">{t.homeTip}</p>
    </motion.form>
  )
}

function Dashboard({ t, lang, me, selected, onSelect, onAdd, onUnlinked }: { t: Strings; lang: Lang; me: Me; selected: string | null; onSelect: (id: string) => void; onAdd: () => void; onUnlinked: () => void }) {
  const [view, setView] = useState<View | null>(null)
  const [gone, setGone] = useState<string | null>(null)
  const [tab, setTab] = useState<'week' | 'classes' | 'all'>('week')
  const student = me.students.find((s) => s.id === selected)

  const load = useCallback(async () => {
    if (!selected) return
    try {
      setView(await call<View>(`/api/parent/students/${selected}`))
      setGone(null)
    } catch (e) {
      if (e instanceof CanvasError && e.status === 410) setGone(e.message)
    }
  }, [selected])

  useEffect(() => {
    setView(null)
    void load()
    const id = setInterval(() => document.visibilityState === 'visible' && void load(), 60_000)
    return () => clearInterval(id)
  }, [load])

  const unlink = async () => {
    if (!(await confirm({ title: t.unlink, message: fill(t.unlinkConfirm, { name: student?.name ?? '' }), confirmLabel: t.unlink }))) return
    await call('/api/parent/unlink', { method: 'POST', body: '{}' }).catch(() => {})
    onUnlinked()
  }

  return (
    <div className="flex flex-col gap-4">
      {me.students.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {me.students.map((s) => (
            <button key={s.id} type="button" onClick={() => onSelect(s.id)} className={cn('rounded-full border-2 px-4 py-1.5 text-sm font-black', s.id === selected ? 'border-[#0ea5a4] bg-[#e6f7f7] text-[#0b6b6a]' : 'border-line bg-surface text-fg-2')}>
              {s.name}
            </button>
          ))}
        </div>
      )}
      {!student ? null : !student.active || gone ? (
        <div className="card-3d p-6 text-center">
          <p className="text-xl font-black">{fill(t.stopped, { name: student.name })}</p>
          <p className="mt-1 text-sm font-semibold text-fg-2">{fill(t.stoppedHelp, { name: student.name })}</p>
        </div>
      ) : !view ? null : !view.data ? (
        <div className="card-3d p-6 text-center text-sm font-bold text-fg-2">{fill(t.waiting, { name: student.name })}</div>
      ) : (
        <StudentView t={t} lang={lang} name={student.name} view={view} data={view.data} tab={tab} setTab={setTab} />
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button variant="ghost" icon={UserPlus} onClick={onAdd}>
          {t.addStudent}
        </Button>
        <Button variant="ghost" icon={LogOut} onClick={() => void unlink()}>
          {t.unlink}
        </Button>
      </div>
    </div>
  )
}

// ——— What the student's work looks like, for a parent ———

type Tone = 'red' | 'gold' | 'green' | 'blue' | 'gray' | 'purple'
const TONE: Record<Tone, string> = {
  red: 'bg-danger-soft text-danger',
  gold: 'bg-gold-soft text-gold-text',
  green: 'bg-success-soft text-success',
  blue: 'bg-[#e7f0ff] text-[#2f5fcf]',
  gray: 'bg-surface-3 text-fg-2',
  purple: 'bg-accent-soft text-accent-text',
}

function status(a: Item, grades: GradeRecord[], now: Date, t: Strings, lang: Lang): { text: string; tone: Tone; late: boolean } {
  const due = parseInstant(a.dueAt)
  if (a.skipped) return { text: t.skipped, tone: 'gray', late: false }
  const g = grades.find((x) => x.assignmentId === a.id && x.outOf > 0)
  if (g) {
    const pct = (g.score / g.outOf) * 100
    return { text: `${Math.round(pct)}%`, tone: pct >= 90 ? 'green' : pct >= 80 ? 'purple' : pct >= 70 ? 'gold' : 'red', late: false }
  }
  const sub = a.canvasSubmission?.state
  if (sub === 'submitted' || sub === 'graded' || sub === 'pending_review') return { text: t.waitingGrade, tone: 'blue', late: false }
  if (sub === 'missing') return { text: t.missing, tone: 'red', late: true }
  if (isAssignmentDone(a)) return { text: t.markedDone, tone: 'green', late: false }
  if (isAssignmentOverdue(a, now)) return { text: t.late, tone: 'red', late: true }
  if (due && isSameDay(due, now)) return { text: t.dueToday, tone: 'gold', late: false }
  if (!due) return { text: t.noDate, tone: 'gray', late: false }
  return { text: format(due, 'EEE MMM d', { locale: DATE_LOCALE[lang] }), tone: 'gray', late: false }
}

function StudentView({ t, lang, name, view, data, tab, setTab }: { t: Strings; lang: Lang; name: string; view: View; data: FamilySnapshot; tab: 'week' | 'classes' | 'all'; setTab: (t: 'week' | 'classes' | 'all') => void }) {
  const now = useMemo(() => new Date(), [])
  const locale = DATE_LOCALE[lang]
  const courseOf = useMemo(() => new Map(data.courses.map((c) => [c.id, c])), [data.courses])
  const items = data.assignments
  const st = (a: Item) => status(a, data.grades, now, t, lang)
  const late = items.filter((a) => st(a).late)
  const soon = items
    .filter((a) => !a.skipped && !st(a).late && !isAssignmentDone(a) && a.dueAt)
    .filter((a) => {
      const d = differenceInCalendarDays(new Date(a.dueAt!), now)
      return d >= 0 && d <= 7
    })
    .sort((x, y) => x.dueAt!.localeCompare(y.dueAt!))
  const doneWeek = data.completions.filter((at) => now.getTime() - new Date(at).getTime() < 7 * 86_400_000).length
  const fmt = (iso: string | null) => (iso ? format(new Date(iso), 'EEE MMM d', { locale }) : '')

  const tip = late[0]
    ? fill(t.tipLate, { name, title: late[0].title })
    : soon.find((a) => (a.estimatedMinutes ?? 0) >= 180 || a.type === 'exam' || a.type === 'project')
      ? fill(t.tipBig, { title: soon.find((a) => (a.estimatedMinutes ?? 0) >= 180 || a.type === 'exam' || a.type === 'project')!.title, date: fmt(soon.find((a) => (a.estimatedMinutes ?? 0) >= 180 || a.type === 'exam' || a.type === 'project')!.dueAt) })
      : doneWeek >= 3
        ? fill(t.tipGood, { name, n: doneWeek })
        : fill(t.tipQuiet, { name })

  return (
    <div className="flex flex-col gap-4" data-testid="parent-view">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{lang === 'es' ? `Semana de ${name}` : `${name}’s week`}</h1>
        <p className="text-sm font-bold text-fg-3">
          {view.updatedAt ? fill(t.updated, { ago: formatDistanceToNowStrict(new Date(view.updatedAt), { addSuffix: true, locale }) }) : ''}
          {data.student.streak > 0 && (
            <>
              {' · '}
              <span className="inline-flex items-center gap-1">
                <Flame className="size-3.5 text-fire" aria-hidden />
                {fill(t.progress, { streak: data.student.streak, level: data.student.level })}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat n={soon.length} label={t.dueWeek} />
        <Stat n={late.length} label={t.lateCount} tone={late.length ? 'text-danger' : undefined} />
        <Stat n={doneWeek} label={t.doneWeek} tone="text-success" />
      </div>

      <div role="tablist" className="flex gap-1 rounded-2xl bg-surface-2 p-1">
        {(['week', 'classes', 'all'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={cn('flex-1 rounded-xl py-2 text-sm font-black', tab === k ? 'bg-surface text-[#0b6b6a] shadow-sm' : 'text-fg-3')}>
            {t[k]}
          </button>
        ))}
      </div>

      {tab === 'week' && (
        <>
          <Section title={t.needsAttention} tone="red">
            {late.length ? late.map((a) => <Row key={a.id} a={a} course={courseOf.get(a.courseId)} s={st(a)} sub={`${courseOf.get(a.courseId)?.name ?? ''} · ${fill(t.wasDue, { date: fmt(a.dueAt) })}`} />) : <Empty text={t.nothingLate} />}
          </Section>
          <Section title={t.comingUp}>
            {soon.length ? soon.map((a) => <Row key={a.id} a={a} course={courseOf.get(a.courseId)} s={st(a)} sub={`${courseOf.get(a.courseId)?.name ?? ''} · ${fill(t.dueOn, { date: fmt(a.dueAt) })}${a.stages ? ` · ${fill(t.stages, a.stages)}` : ''}`} />) : <Empty text={t.nothingDue} />}
          </Section>
          <div className="flex gap-3 rounded-2xl bg-[#e6f7f7] p-4 text-sm font-bold text-[#0b6b6a]">
            <Lightbulb className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              <b className="block font-black">{t.howToHelp}</b>
              {tip}
            </span>
          </div>
        </>
      )}

      {tab === 'classes' && (
        <ul className="flex flex-col gap-3">
          {data.courses
            .filter((c) => c.status !== 'archived')
            .map((c) => (
              <ClassCard key={c.id} t={t} lang={lang} course={c} data={data} st={st} />
            ))}
        </ul>
      )}

      {tab === 'all' && (
        <>
          <Section title={t.lateGroup} tone="red">
            {late.length ? late.map((a) => <Row key={a.id} a={a} course={courseOf.get(a.courseId)} s={st(a)} sub={courseOf.get(a.courseId)?.name ?? ''} />) : <Empty text={t.nothingLate} />}
          </Section>
          <Section title={t.upcomingGroup}>
            {items
              .filter((a) => !a.skipped && !st(a).late && !isAssignmentDone(a))
              .sort((x, y) => (x.dueAt ?? '9').localeCompare(y.dueAt ?? '9'))
              .map((a) => (
                <Row key={a.id} a={a} course={courseOf.get(a.courseId)} s={st(a)} sub={courseOf.get(a.courseId)?.name ?? ''} />
              ))}
          </Section>
          <Section title={t.doneGroup}>
            {items
              .filter((a) => !a.skipped && isAssignmentDone(a))
              .sort((x, y) => (y.dueAt ?? '').localeCompare(x.dueAt ?? ''))
              .map((a) => (
                <Row key={a.id} a={a} course={courseOf.get(a.courseId)} s={st(a)} sub={courseOf.get(a.courseId)?.name ?? ''} />
              ))}
          </Section>
          {items.some((a) => a.skipped) && (
            <Section title={t.skippedGroup} hint={fill(t.skippedHelp, { name })}>
              {items
                .filter((a) => a.skipped)
                .map((a) => (
                  <Row key={a.id} a={a} course={courseOf.get(a.courseId)} s={st(a)} sub={courseOf.get(a.courseId)?.name ?? ''} />
                ))}
            </Section>
          )}
        </>
      )}

      <p className="text-center text-xs font-semibold text-fg-3">{fill(t.canvasNote, { name })}</p>
    </div>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <div className="card-3d flex flex-col items-center px-2 py-3 text-center">
      <span className={cn('tabular text-2xl font-black', tone)}>{n}</span>
      <span className="text-[11px] leading-tight font-extrabold text-fg-3">{label}</span>
    </div>
  )
}

function Section({ title, tone, hint, children }: { title: string; tone?: 'red'; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className={cn('mb-2 text-xs font-black tracking-[0.12em] uppercase', tone === 'red' ? 'text-danger' : 'text-fg-3')}>{title}</h2>
      {hint && <p className="-mt-1 mb-2 text-xs font-semibold text-fg-3">{hint}</p>}
      <ul className="card-3d divide-y-2 divide-line overflow-hidden">{children}</ul>
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return <li className="px-4 py-3 text-sm font-bold text-fg-3">{text}</li>
}

function Row({ a, course, s, sub }: { a: Item; course: Course | undefined; s: { text: string; tone: Tone }; sub: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: courseColor(course?.color) }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm font-extrabold', a.skipped && 'text-fg-3 line-through')}>{a.title}</span>
        <span className="block truncate text-xs font-bold text-fg-3">{sub}</span>
      </span>
      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-black', TONE[s.tone])}>{s.text}</span>
    </li>
  )
}

function ClassCard({ t, lang, course, data, st }: { t: Strings; lang: Lang; course: Course; data: FamilySnapshot; st: (a: Item) => { text: string; tone: Tone } }) {
  const [open, setOpen] = useState(false)
  const items = data.assignments.filter((a) => a.courseId === course.id)
  const summary = summarizeCourseGrades(course, data.grades, items)
  const pct = summary.currentPercent
  const late = items.filter((a) => (st(a) as { late?: boolean }).late).length
  const news = data.announcements.filter((n) => n.courseId === course.id).slice(0, 2)
  const color = pct == null ? 'var(--surface-3)' : pct >= 90 ? 'var(--success-bright)' : pct >= 80 ? courseColor(course.color) : pct >= 70 ? 'var(--gold)' : 'var(--danger)'
  return (
    <li className={cn('card-3d overflow-hidden', open && 'border-[#0ea5a4]')}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <Ring value={pct == null ? 0 : Math.min(1, pct / 100)} size={54} stroke={9} track="var(--surface-3)" color={color}>
          <span className="text-sm font-black">{pct == null ? '–' : letterGrade(pct)}</span>
        </Ring>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-black">{course.name}</span>
          <span className="block truncate text-sm font-bold text-fg-3">
            {pct == null ? t.noGrades : `${pct.toFixed(1)}%`}
            {course.instructor ? ` · ${course.instructor}` : ''}
            {late ? <span className="text-danger"> · {late} {t.late.toLowerCase()}</span> : null}
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-fg-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="flex flex-col gap-4 border-t-2 border-dashed border-line p-4">
              <section>
                <h3 className="mb-1 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">{t.howGraded}</h3>
                {summary.method === 'weighted' ? (
                  <div className="flex flex-col gap-2">
                    {summary.categories.map((k) => (
                      <div key={k.id} className="text-sm font-bold">
                        <div className="flex justify-between">
                          <span>
                            {k.name} <span className="text-fg-3">· {k.weight}%</span>
                          </span>
                          <span>{k.percent == null ? '–' : `${Math.round(k.percent)}%`}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, k.percent ?? 0)}%`, background: (k.percent ?? 0) >= 80 ? 'var(--success-bright)' : (k.percent ?? 0) >= 70 ? 'var(--gold)' : 'var(--danger)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-fg-2">{t.pointsBased}</p>
                )}
              </section>
              <section>
                <h3 className="mb-1 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">{t.allAssignments}</h3>
                <ul className="divide-y-2 divide-line">
                  {[...items]
                    .sort((x, y) => (y.dueAt ?? '').localeCompare(x.dueAt ?? ''))
                    .map((a) => {
                      const s = st(a)
                      const g = data.grades.find((x) => x.assignmentId === a.id)
                      return (
                        <li key={a.id} className="flex items-center gap-3 py-2">
                          <span className="min-w-0 flex-1">
                            <span className={cn('block truncate text-sm font-extrabold', a.skipped && 'text-fg-3 line-through')}>{a.title}</span>
                            <span className="block truncate text-xs font-bold text-fg-3">
                              {a.dueAt ? format(new Date(a.dueAt), 'EEE MMM d', { locale: DATE_LOCALE[lang] }) : t.noDate}
                              {g ? ` · ${g.score} / ${g.outOf}` : a.pointsPossible != null ? ` · ${fill(t.points, { n: a.pointsPossible })}` : ''}
                            </span>
                          </span>
                          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-black', TONE[s.tone])}>{s.text}</span>
                        </li>
                      )
                    })}
                </ul>
              </section>
              {news.length > 0 && (
                <section>
                  <h3 className="mb-1 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">{t.fromTeacher}</h3>
                  {news.map((n) => (
                    <div key={n.id} className="mb-2 rounded-xl bg-surface-2 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-sm font-black">
                        <Megaphone className="size-4 shrink-0" style={{ color: TEAL }} aria-hidden />
                        {n.title}
                      </p>
                      {n.body && <p className="mt-0.5 line-clamp-3 text-sm font-semibold text-fg-2">{n.body}</p>}
                    </div>
                  ))}
                </section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
