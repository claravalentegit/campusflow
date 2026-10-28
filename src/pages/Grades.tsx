import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { AlertCircle, GraduationCap, Hourglass, Info, MoreHorizontal, Pencil, Plus, Scale, Target, Trash2, X } from 'lucide-react'
import { gradeTrend, letterGrade, missingAndUngraded, requiredForTarget, summarizeCourseGrades } from '@/domain/grades'
import { newId } from '@/domain/ids'
import { GRADE_SOURCE_LABEL } from '@/domain/labels'
import type { Course, GradeCategory, GradeRecord } from '@/domain/types'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { toast } from '@/store/ui'
import { CourseAvatar, CourseDot, courseColor } from '@/components/course'
import { Page, PageHeader, usePageTitle } from '@/components/Page'
import { Badge } from '@/components/ui/Badge'
import { Button, IconButton } from '@/components/ui/Button'
import { confirm, Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field, Input, Select } from '@/components/ui/Field'
import { Menu } from '@/components/ui/Menu'
import { Panel } from '@/components/ui/Panel'
import { cn } from '@/components/ui/cn'

const pct = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)}%`)

export function Grades() {
  usePageTitle('Grades & Progress')
  const courses = useStore((s) => s.courses)
  const grades = useStore((s) => s.grades)
  const assignments = useStore((s) => s.assignments)
  const mode = useStore((s) => s.prefs.dataMode)
  const [params, setParams] = useSearchParams()
  const list = courses.filter((c) => c.status !== 'archived')
  const selectedId = params.get('course') ?? list.find((c) => c.status === 'active')?.id ?? list[0]?.id
  const selected = courses.find((c) => c.id === selectedId)
  const summaries = useMemo(() => new Map(list.map((c) => [c.id, summarizeCourseGrades(c, grades, assignments)])), [list, grades, assignments])

  return (
    <Page wide>
      <PageHeader title="Grades & Progress" description="Your own calculations from the grades you have. Always check Canvas or your instructor for official grades." />
      <div className="mb-5 flex items-start gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-xs text-fg-2">
        <Info className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden />
        <p>
          Each grade is labeled by where it came from: <Badge tone="accent">Canvas</Badge> synced, <Badge tone="outline">Entered by you</Badge> manual, or <Badge tone="outline">Demo</Badge> sample data.
          {mode !== 'canvas' && ' CampusFlow is not connected to Canvas, so no grades here are official.'} Percentages are estimates calculated by CampusFlow.
        </p>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No courses yet" description="Add courses to track grades." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Courses" className="flex flex-col gap-1">
            <Select aria-label="Choose course" className="lg:hidden" value={selectedId} onChange={(e) => setParams({ course: e.target.value })}>
              {list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </Select>
            <div className="hidden flex-col gap-1 lg:flex">
              {list.map((c) => {
                const s = summaries.get(c.id)!
                return (
                  <button key={c.id} type="button" aria-current={c.id === selectedId} onClick={() => setParams({ course: c.id })} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors', c.id === selectedId ? 'border-line bg-surface shadow-sm' : 'border-transparent hover:bg-surface-2')}>
                    <CourseDot color={c.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.code}</span>
                      <span className="block truncate text-xs text-fg-3">{c.status === 'completed' ? 'Completed' : c.name}</span>
                    </span>
                    <span className="tabular text-sm font-semibold">{s.currentPercent != null ? `${s.currentPercent.toFixed(1)}%` : <span className="text-xs font-normal text-fg-3">No grades</span>}</span>
                  </button>
                )
              })}
            </div>
          </nav>
          {selected && <CourseGrades key={selected.id} course={selected} />}
        </div>
      )}
    </Page>
  )
}

function CourseGrades({ course }: { course: Course }) {
  const now = useNow()
  const grades = useStore((s) => s.grades)
  const assignments = useStore((s) => s.assignments)
  const updateCourse = useStore((s) => s.updateCourse)
  const summary = summarizeCourseGrades(course, grades, assignments)
  const records = grades.filter((g) => g.courseId === course.id).sort((a, b) => b.gradedAt.localeCompare(a.gradedAt))
  const trend = gradeTrend(course.id, grades)
  const { missing, awaitingGrade } = missingAndUngraded(course.id, assignments, grades, now)
  const [target, setTarget] = useState(course.targetGrade?.toString() ?? '')
  const targetNum = Number(target)
  const targetResult = target && Number.isFinite(targetNum) && targetNum > 0 && targetNum <= 100 ? requiredForTarget(summary, targetNum) : null
  const [gradeDialog, setGradeDialog] = useState<{ initial?: GradeRecord; assignmentId?: string } | null>(null)
  const [weights, setWeights] = useState(false)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
        <CourseAvatar course={course} size="lg" />
        <div className="min-w-0 flex-1">
          <Link to={`/courses/${course.id}`} className="text-lg font-semibold hover:underline">
            {course.name}
          </Link>
          <p className="text-xs text-fg-3">
            {course.code} · {summary.gradedCount} grade{summary.gradedCount === 1 ? '' : 's'} recorded
            {summary.sources.length > 0 && ` · ${summary.sources.map((s) => GRADE_SOURCE_LABEL[s]).join(' + ')}`}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-2xs font-semibold tracking-wide text-fg-3 uppercase">Estimated current grade</p>
          <p className="tabular text-3xl font-semibold tracking-tight" data-testid="current-grade">
            {summary.currentPercent != null ? (
              <>
                {summary.currentPercent.toFixed(1)}%<span className="ml-2 text-lg text-fg-3">{letterGrade(summary.currentPercent)}</span>
              </>
            ) : (
              <span className="text-lg text-fg-3">Not enough data</span>
            )}
          </p>
          {summary.gradedFraction != null && <p className="tabular text-xs text-fg-3">{Math.round(summary.gradedFraction * 100)}% of the course graded so far</p>}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="How this is calculated" actions={<Button size="sm" variant="ghost" icon={Scale} onClick={() => setWeights(true)}>Category weights</Button>}>
          <div className="px-4 py-3">
            <ul className="list-disc space-y-1 pl-4 text-xs text-fg-2">
              {summary.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              <li>Letter grades use a common 93/90/87… scale; your syllabus may differ.</li>
            </ul>
            {summary.categories.length > 0 && (
              <table className="tabular mt-3 w-full text-left text-xs">
                <thead className="text-fg-3">
                  <tr className="border-b border-line">
                    <th className="py-1.5 font-medium">Category</th>
                    <th className="py-1.5 font-medium">Weight</th>
                    <th className="py-1.5 font-medium">Points</th>
                    <th className="py-1.5 text-right font-medium">Average</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.categories.map((c) => (
                    <tr key={c.id} className="border-b border-line/60">
                      <td className="py-1.5">{c.name}</td>
                      <td className="py-1.5 text-fg-3">{c.weight}%</td>
                      <td className="py-1.5 text-fg-3">{c.possible ? `${c.earned}/${c.possible}` : '—'}</td>
                      <td className="py-1.5 text-right font-medium">{pct(c.percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel title="Target grade" description="What you need on the rest of the course">
          <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex items-end gap-2">
              <Field label="Target %" className="w-28">
                {(p) => <Input {...p} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="90" />}
              </Field>
              <Button
                size="md"
                disabled={!targetResult}
                onClick={() => {
                  updateCourse(course.id, { targetGrade: targetNum })
                  toast('Target saved')
                }}
              >
                Save target
              </Button>
            </div>
            {targetResult ? (
              <p className={cn('flex items-start gap-2 text-sm', targetResult.requiredPercent != null && targetResult.requiredPercent > 100 ? 'text-danger' : 'text-fg-2')}>
                <Target className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                {targetResult.explanation}
              </p>
            ) : (
              <p className="text-xs text-fg-3">Enter a percentage between 1 and 100.</p>
            )}
            <p className="text-2xs text-fg-3">Assumes the remaining assignments in CampusFlow are everything left, with the point values listed. Projection, not a guarantee.</p>
          </div>
        </Panel>
      </div>

      {trend.length >= 3 && (
        <Panel title="Trend" description="Score on each graded item, oldest to newest">
          <Sparkline points={trend} color={courseColor(course.color)} />
        </Panel>
      )}

      {(missing.length > 0 || awaitingGrade.length > 0) && (
        <div className="grid gap-5 xl:grid-cols-2">
          {missing.length > 0 && (
            <Panel title={<span className="flex items-center gap-1.5 text-danger"><AlertCircle className="size-4" aria-hidden />Missing work</span>} description="Past due and not marked done">
              <ul className="py-1">
                {missing.map((a) => (
                  <li key={a.id}>
                    <Link to={`/assignments/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-1.5 text-sm hover:bg-surface-2/60">
                      <span className="truncate">{a.title}</span>
                      <span className="shrink-0 text-xs text-fg-3">{a.pointsPossible != null ? `${a.pointsPossible} pts` : ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {awaitingGrade.length > 0 && (
            <Panel title={<span className="flex items-center gap-1.5"><Hourglass className="size-4 text-fg-3" aria-hidden />Awaiting a grade</span>} description="Done, no grade recorded yet">
              <ul className="py-1">
                {awaitingGrade.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-1.5 text-sm">
                    <Link to={`/assignments/${a.id}`} className="truncate hover:underline">
                      {a.title}
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => setGradeDialog({ assignmentId: a.id })}>
                      Enter grade
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <Panel title="Grades" actions={<Button size="sm" icon={Plus} onClick={() => setGradeDialog({})}>Add grade</Button>}>
        {records.length === 0 ? (
          <EmptyState compact icon={GraduationCap} title="No grades recorded" description="Enter grades from returned work or Canvas to estimate your standing." actions={<Button size="sm" icon={Plus} onClick={() => setGradeDialog({})}>Add grade</Button>} />
        ) : (
          <>
          <ul className="divide-y divide-line sm:hidden">
            {records.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{g.title}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-2xs text-fg-3">
                    {format(new Date(g.gradedAt), 'MMM d')}
                    {g.categoryId && <span>{course.gradeCategories.find((c) => c.id === g.categoryId)?.name}</span>}
                    <Badge tone={g.source === 'canvas' ? 'accent' : 'outline'}>{GRADE_SOURCE_LABEL[g.source]}</Badge>
                  </span>
                </span>
                <span className="tabular text-right text-sm">
                  <span className="block font-medium">{((g.score / g.outOf) * 100).toFixed(1)}%</span>
                  <span className="text-2xs text-fg-3">
                    {g.score}/{g.outOf}
                  </span>
                </span>
                <GradeMenu grade={g} onEdit={() => setGradeDialog({ initial: g })} />
              </li>
            ))}
          </ul>
          <div className="relative hidden sm:block">
            <table className="tabular w-full text-left text-sm">
              <thead className="text-xs text-fg-3">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-2 py-2 font-medium">Category</th>
                  <th className="px-2 py-2 font-medium">Score</th>
                  <th className="px-2 py-2 font-medium">%</th>
                  <th className="px-2 py-2 font-medium">Source</th>
                  <th className="w-10 px-2 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {records.map((g) => (
                  <tr key={g.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-2">
                      <span className="block font-medium">{g.title}</span>
                      <span className="text-2xs text-fg-3">{format(new Date(g.gradedAt), 'MMM d')}</span>
                    </td>
                    <td className="px-2 py-2 text-xs text-fg-2">{course.gradeCategories.find((c) => c.id === g.categoryId)?.name ?? '—'}</td>
                    <td className="px-2 py-2">
                      {g.score}/{g.outOf}
                    </td>
                    <td className="px-2 py-2 font-medium">{((g.score / g.outOf) * 100).toFixed(1)}%</td>
                    <td className="px-2 py-2">
                      <Badge tone={g.source === 'canvas' ? 'accent' : 'outline'}>{GRADE_SOURCE_LABEL[g.source]}</Badge>
                    </td>
                    <td className="px-2 py-2">
                      <GradeMenu grade={g} onEdit={() => setGradeDialog({ initial: g })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Panel>
      <GradeDialog course={course} state={gradeDialog} onClose={() => setGradeDialog(null)} />
      <WeightsDialog course={course} open={weights} onClose={() => setWeights(false)} />
    </div>
  )
}

function GradeMenu({ grade: g, onEdit }: { grade: GradeRecord; onEdit: () => void }) {
  const deleteGrade = useStore((s) => s.deleteGrade)
  return (
    <Menu
      items={[
        { label: g.source === 'canvas' ? 'Edit (synced from Canvas)' : 'Edit', icon: Pencil, onSelect: onEdit, disabled: g.source === 'canvas' },
        {
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          onSelect: async () => {
            if (await confirm({ title: 'Delete grade?', message: `Remove “${g.title}” (${g.score}/${g.outOf}) from your calculations?` })) {
              deleteGrade(g.id)
              toast('Grade deleted')
            }
          },
        },
      ]}
      trigger={(p) => <IconButton icon={MoreHorizontal} label={`Actions for ${g.title}`} size="sm" tooltip={false} {...p} />}
    />
  )
}

function Sparkline({ points, color }: { points: Array<{ date: Date; percent: number; title: string }>; color: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 600
  const H = 120
  const pad = 16
  const min = Math.max(0, Math.min(...points.map((p) => p.percent)) - 10)
  const max = 100
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1)
  const y = (v: number) => pad + ((max - v) / (max - min)) * (H - pad * 2)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.percent)}`).join(' ')
  return (
    <div className="relative px-4 py-3" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none" role="img" aria-label={`Scores from ${points[0].percent.toFixed(0)}% to ${points[points.length - 1].percent.toFixed(0)}%`}>
        {[min, (min + max) / 2, max].map((v) => (
          <line key={v} x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.percent)} r={hover === i ? 5 : 3.5} fill={color} stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <rect x={x(i) - 18} y={0} width={36} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-2xs text-fg-3">
        <span>{format(points[0].date, 'MMM d')}</span>
        <span>{format(points[points.length - 1].date, 'MMM d')}</span>
      </div>
      {hover != null && (
        <div className="pointer-events-none absolute top-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md" style={{ left: `clamp(8px, calc(${(x(hover) / W) * 100}% - 70px), calc(100% - 150px))` }}>
          <p className="tabular font-semibold">{points[hover].percent.toFixed(1)}%</p>
          <p className="text-fg-3">{points[hover].title}</p>
        </div>
      )}
      <ul className="sr-only">
        {points.map((p, i) => (
          <li key={i}>
            {p.title}: {p.percent.toFixed(1)}%
          </li>
        ))}
      </ul>
    </div>
  )
}

function GradeDialog({ course, state, onClose }: { course: Course; state: { initial?: GradeRecord; assignmentId?: string } | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!state}
      onClose={onClose}
      title={state?.initial ? 'Edit grade' : 'Add grade'}
      description="Manually entered grades are labeled “Entered by you”."
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="grade-form">
            Save
          </Button>
        </>
      }
    >
      {state && <GradeForm course={course} initial={state.initial} assignmentId={state.assignmentId} onDone={onClose} />}
    </Dialog>
  )
}

function GradeForm({ course, initial, assignmentId: presetAssignment, onDone }: { course: Course; initial?: GradeRecord; assignmentId?: string; onDone: () => void }) {
  const assignments = useStore((s) => s.assignments)
  const add = useStore((s) => s.addGrade)
  const update = useStore((s) => s.updateGrade)
  const mine = assignments.filter((a) => a.courseId === course.id)
  const preset = mine.find((a) => a.id === (initial?.assignmentId ?? presetAssignment))
  const [assignmentId, setAssignmentId] = useState(preset?.id ?? '')
  const [title, setTitle] = useState(initial?.title ?? preset?.title ?? '')
  const [score, setScore] = useState(initial?.score.toString() ?? '')
  const [outOf, setOutOf] = useState(initial?.outOf.toString() ?? preset?.pointsPossible?.toString() ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? preset?.gradeCategoryId ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const s = Number(score)
    const o = Number(outOf)
    if (!title.trim()) errs.title = 'Name the graded item.'
    if (!score.trim() || !Number.isFinite(s) || s < 0) errs.score = 'Enter a score of 0 or more.'
    if (!outOf.trim() || !Number.isFinite(o) || o <= 0) errs.outOf = 'Points possible must be above 0.'
    else if (Number.isFinite(s) && s > o * 1.5) errs.score = 'That is far above the points possible — check for a typo.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    const fields = { title: title.trim(), score: s, outOf: o, categoryId: categoryId || null, assignmentId: assignmentId || null }
    if (initial) update(initial.id, fields)
    else add({ ...fields, courseId: course.id, source: 'manual', gradedAt: new Date().toISOString() })
    toast(initial ? 'Grade updated' : 'Grade added')
    onDone()
  }

  return (
    <form id="grade-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Assignment" optional>
        {(p) => (
          <Select
            {...p}
            value={assignmentId}
            onChange={(e) => {
              const a = mine.find((x) => x.id === e.target.value)
              setAssignmentId(e.target.value)
              if (a) {
                setTitle(a.title)
                if (a.pointsPossible != null) setOutOf(String(a.pointsPossible))
                if (a.gradeCategoryId) setCategoryId(a.gradeCategoryId)
              }
            }}
          >
            <option value="">Not linked (e.g. a past quiz)</option>
            {mine.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Item name" error={errors.title}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} data-autofocus />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Score" error={errors.score}>
          {(p) => <Input {...p} inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} />}
        </Field>
        <Field label="Out of" error={errors.outOf}>
          {(p) => <Input {...p} inputMode="decimal" value={outOf} onChange={(e) => setOutOf(e.target.value)} />}
        </Field>
      </div>
      {course.gradeCategories.length > 0 && (
        <Field label="Category">
          {(p) => (
            <Select {...p} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category (not counted in weighted grade)</option>
              {course.gradeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.weight}%)
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
    </form>
  )
}

function WeightsDialog({ course, open, onClose }: { course: Course; open: boolean; onClose: () => void }) {
  const update = useStore((s) => s.updateCourse)
  const [rows, setRows] = useState<GradeCategory[]>(course.gradeCategories)
  const [error, setError] = useState<string | null>(null)
  const total = rows.reduce((s, r) => s + (Number.isFinite(r.weight) ? r.weight : 0), 0)
  const save = () => {
    if (rows.some((r) => !r.name.trim() || !(r.weight > 0))) return setError('Every category needs a name and a weight above 0.')
    update(course.id, { gradeCategories: rows.map((r) => ({ ...r, name: r.name.trim() })) })
    toast('Weights saved')
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Category weights"
      description="Copy these from your syllabus. Leave empty to use total points."
      footer={
        <>
          <span className={cn('tabular mr-auto text-xs', total === 100 || rows.length === 0 ? 'text-fg-3' : 'text-warn')}>Total {total}%</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={r.id} className="flex gap-2">
            <Input aria-label={`Category ${i + 1} name`} value={r.name} onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Homework" />
            <Input aria-label={`Category ${i + 1} weight`} inputMode="decimal" className="w-24" value={Number.isNaN(r.weight) ? '' : r.weight} onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, weight: Number(e.target.value) } : x)))} />
            <IconButton icon={X} label="Remove category" onClick={() => setRows(rows.filter((x) => x.id !== r.id))} />
          </div>
        ))}
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
        <Button size="sm" variant="ghost" icon={Plus} className="self-start" onClick={() => setRows([...rows, { id: newId('gc'), name: '', weight: 0 }])}>
          Add category
        </Button>
      </div>
    </Dialog>
  )
}
