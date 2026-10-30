import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Route,
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
import { useT } from '@/i18n'
import { msg } from '@/i18n/langs'

interface Command {
  id: string
  label: string
  icon: LucideIcon
  hint?: string
  keywords?: string
  run: () => void
}

const CATEGORY_LABEL: Record<SearchCategory, string> = { assignment: msg('Assignments'), course: msg('Courses'), task: msg('Tasks') }
const CATEGORY_ICON: Record<SearchCategory, LucideIcon> = { assignment: CheckSquare, course: BookOpen, task: ListTodo }

/** Ctrl/⌘+K: search everything and run commands from the keyboard. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const setOpen = useUi((s) => s.setPaletteOpen)
  const openQuickAdd = useUi((s) => s.openQuickAdd)
  const setFocusDialogOpen = useUi((s) => s.setFocusDialogOpen)
  const t = useT()
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
      { id: 'add-assignment', label: t('Add assignment'), icon: Plus, hint: 'C', keywords: 'new create homework', run: () => openQuickAdd({ kind: 'assignment' }) },
      { id: 'add-task', label: t('Add task'), icon: ListTodo, keywords: 'new todo', run: () => openQuickAdd({ kind: 'task' }) },
      { id: 'focus', label: t('Start a focus session'), icon: Timer, hint: 'F', keywords: 'pomodoro timer xp', run: () => setFocusDialogOpen(true) },
      { id: 'nav-today', label: t('Go to Today'), icon: LayoutDashboard, keywords: 'home quest', run: go('/') },
      { id: 'nav-plan', label: t('Open my plan'), icon: Route, keywords: 'study plan steps grade help', run: go('/plan') },
      { id: 'nav-courses', label: t('Go to Courses'), icon: BookOpen, keywords: 'classes', run: go('/courses') },
      { id: 'nav-me', label: t('My level & badges'), icon: Trophy, keywords: 'xp profile streak', run: go('/me') },
      { id: 'nav-grades', label: t('Grades'), icon: GraduationCap, keywords: 'courses', run: go('/courses') },
      { id: 'nav-settings', label: t('Settings & Canvas connection'), icon: Settings, run: go('/me#settings') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
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
      aria-label={t('Search and commands')}
      onCancel={(e) => {
        e.preventDefault()
        setOpen(false)
      }}
      onMouseDown={(e) => e.target === ref.current && setOpen(false)}
      className="mx-auto mt-[12vh] w-[calc(100%-24px)] max-w-xl overflow-hidden rounded-[24px] border-2 border-b-[5px] border-line bg-surface p-0 text-fg shadow-lg open:animate-[dialog-in_280ms_cubic-bezier(.2,1.4,.4,1)]"
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <div className="flex items-center gap-3 border-b-2 border-line px-5">
            <Search className="size-4 shrink-0 text-fg-3" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              placeholder={t('Search assignments and classes, or type a command')}
              aria-label={t('Search')}
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-activedescendant={flat[activeIndex] ? `palette-${flat[activeIndex].key}` : undefined}
              className="h-14 min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:font-semibold placeholder:text-fg-3"
            />
            <kbd className="hidden rounded-md border-2 border-line px-1.5 text-xs font-bold text-fg-3 sm:inline">Esc</kbd>
          </div>
          <div id="palette-list" ref={listRef} role="listbox" className="scrollbar-thin max-h-[min(60vh,440px)] overflow-y-auto p-1.5">
            {q && results.length === 0 && matchedCommands.length === 0 && <p className="px-3 py-8 text-center text-sm text-fg-3">{t('No results for “{query}”.', { query })}</p>}
            {[...grouped.entries()].map(([cat, items]) => (
              <div key={cat} role="group" aria-label={t(CATEGORY_LABEL[cat])} className="mb-1">
                <p className="px-3 pt-2.5 pb-1 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">{t(CATEGORY_LABEL[cat])}</p>
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
                      className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors', i === activeIndex && 'bg-accent-soft text-accent-text')}
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
              <div role="group" aria-label={t('Commands')}>
                <p className="px-3 pt-2.5 pb-1 text-xs font-black tracking-[0.12em] text-fg-3 uppercase">{q ? t('Commands') : t('Quick actions')}</p>
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
                      className={cn('flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors', i === activeIndex && 'bg-accent-soft text-accent-text')}
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
