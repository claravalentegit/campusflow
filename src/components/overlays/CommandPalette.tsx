import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Plus,
  Search,
  Settings,
  Trophy,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import { searchAll, type SearchCategory } from '@/domain/search'
import { useAppData, useCourseMap } from '@/hooks/useData'
import { useUi } from '@/store/ui'
import { CourseDot } from '../course'
import { cn } from '../ui/cn'

interface Command {
  id: string
  label: string
  icon: LucideIcon
  hint?: string
  keywords?: string
  run: () => void
}

const CATEGORY_LABEL: Record<SearchCategory, string> = { assignment: 'Assignments', course: 'Courses', task: 'Tasks' }
const CATEGORY_ICON: Record<SearchCategory, LucideIcon> = { assignment: CheckSquare, course: BookOpen, task: ListTodo }

/** Ctrl/⌘+K: search everything and run commands from the keyboard. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const setOpen = useUi((s) => s.setPaletteOpen)
  const openQuickAdd = useUi((s) => s.openQuickAdd)
  const setFocusDialogOpen = useUi((s) => s.setFocusDialogOpen)
  const navigate = useNavigate()
  const data = useAppData()
  const courses = useCourseMap()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      setQuery('')
      setActive(0)
      el.showModal()
    } else if (!open && el.open) el.close()
  }, [open])

  const go = (path: string) => () => navigate(path)
  const commands: Command[] = useMemo(
    () => [
      { id: 'add-assignment', label: 'Add assignment', icon: Plus, hint: 'C', keywords: 'new create homework', run: () => openQuickAdd({ kind: 'assignment' }) },
      { id: 'add-task', label: 'Add task', icon: ListTodo, keywords: 'new todo', run: () => openQuickAdd({ kind: 'task' }) },
      { id: 'add-session', label: 'Schedule study time', icon: CalendarPlus, keywords: 'new block plan session', run: () => openQuickAdd({ kind: 'session' }) },
      { id: 'focus', label: 'Start a focus session', icon: Timer, hint: 'F', keywords: 'pomodoro timer xp', run: () => setFocusDialogOpen(true) },
      { id: 'nav-today', label: 'Go to Today', icon: LayoutDashboard, keywords: 'home quest', run: go('/') },
      { id: 'nav-courses', label: 'Go to Courses', icon: BookOpen, keywords: 'classes', run: go('/courses') },
      { id: 'nav-calendar', label: 'Open calendar', icon: CalendarDays, keywords: 'week', run: go('/calendar') },
      { id: 'nav-me', label: 'My level & badges', icon: Trophy, keywords: 'xp profile streak', run: go('/me') },
      { id: 'nav-grades', label: 'Grades', icon: GraduationCap, run: go('/grades') },
      { id: 'nav-settings', label: 'Settings & Canvas connection', icon: Settings, run: go('/settings') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const q = query.trim().toLowerCase()
  const matchedCommands = q ? commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q)) : commands.slice(0, 7)
  const results = useMemo(() => searchAll(data, query), [data, query])
  const flat = [
    ...results.map((r) => ({ key: `r-${r.category}-${r.id}`, run: () => (r.href.startsWith('#task:') ? useUi.getState().edit({ kind: 'task', id: r.id }) : navigate(r.href)) })),
    ...matchedCommands.map((c) => ({ key: `c-${c.id}`, run: c.run })),
  ]
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1))

  const runAt = (i: number) => {
    const item = flat[i]
    if (!item) return
    setOpen(false)
    item.run()
  }

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((activeIndex + 1) % Math.max(1, flat.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((activeIndex - 1 + flat.length) % Math.max(1, flat.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      runAt(activeIndex)
    }
  }

  let index = -1
  const grouped = new Map<SearchCategory, typeof results>()
  for (const r of results) grouped.set(r.category, [...(grouped.get(r.category) ?? []), r])

  return (
    <dialog
      ref={ref}
      aria-label="Search and commands"
      onCancel={(e) => {
        e.preventDefault()
        setOpen(false)
      }}
      onMouseDown={(e) => e.target === ref.current && setOpen(false)}
      className="mx-auto mt-[12vh] w-[calc(100%-24px)] max-w-xl overflow-hidden rounded-xl border border-line bg-surface p-0 text-fg shadow-lg open:animate-pop-in"
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <div className="flex items-center gap-2.5 border-b border-line px-4">
            <Search className="size-4 shrink-0 text-fg-3" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              placeholder="Search assignments and classes, or type a command"
              aria-label="Search"
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-activedescendant={flat[activeIndex] ? `palette-${flat[activeIndex].key}` : undefined}
              className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-3"
            />
            <kbd className="hidden rounded border border-line px-1.5 text-2xs text-fg-3 sm:inline">Esc</kbd>
          </div>
          <div id="palette-list" ref={listRef} role="listbox" className="scrollbar-thin max-h-[min(60vh,440px)] overflow-y-auto p-1.5">
            {q && results.length === 0 && matchedCommands.length === 0 && <p className="px-3 py-8 text-center text-sm text-fg-3">No results for “{query}”.</p>}
            {[...grouped.entries()].map(([cat, items]) => (
              <div key={cat} role="group" aria-label={CATEGORY_LABEL[cat]} className="mb-1">
                <p className="px-2.5 pt-2 pb-1 text-2xs font-semibold tracking-wide text-fg-3 uppercase">{CATEGORY_LABEL[cat]}</p>
                {items.map((r) => {
                  index++
                  const i = index
                  const Icon = CATEGORY_ICON[cat]
                  const course = r.courseId ? courses.get(r.courseId) : undefined
                  return (
                    <div
                      key={r.id}
                      id={`palette-r-${r.category}-${r.id}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => runAt(i)}
                      className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm', i === activeIndex && 'bg-surface-2')}
                    >
                      <Icon className="size-4 shrink-0 text-fg-3" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      {course && <CourseDot color={course.color} />}
                      <span className="max-w-[40%] shrink-0 truncate text-xs text-fg-3">{r.subtitle}</span>
                    </div>
                  )
                })}
              </div>
            ))}
            {matchedCommands.length > 0 && (
              <div role="group" aria-label="Commands">
                <p className="px-2.5 pt-2 pb-1 text-2xs font-semibold tracking-wide text-fg-3 uppercase">{q ? 'Commands' : 'Quick actions'}</p>
                {matchedCommands.map((c) => {
                  index++
                  const i = index
                  return (
                    <div
                      key={c.id}
                      id={`palette-c-${c.id}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => runAt(i)}
                      className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm', i === activeIndex && 'bg-surface-2')}
                    >
                      <c.icon className="size-4 shrink-0 text-fg-3" aria-hidden />
                      <span className="flex-1">{c.label}</span>
                      {c.hint ? <kbd className="rounded border border-line px-1.5 text-2xs text-fg-3">{c.hint}</kbd> : i === activeIndex && <ArrowRight className="size-3.5 text-fg-3" aria-hidden />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
