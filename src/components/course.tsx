import {
  BookOpen,
  Brain,
  Calculator,
  ChartLine,
  Code2,
  FlaskConical,
  Globe,
  Landmark,
  Microscope,
  Music,
  Palette,
  PenLine,
  type LucideIcon,
} from 'lucide-react'
import type { Course, CourseColor, CourseIcon } from '@/domain/types'
import { cn } from './ui/cn'

export const COURSE_ICON: Record<CourseIcon, LucideIcon> = {
  book: BookOpen,
  flask: FlaskConical,
  calculator: Calculator,
  code: Code2,
  globe: Globe,
  palette: Palette,
  music: Music,
  brain: Brain,
  landmark: Landmark,
  microscope: Microscope,
  pen: PenLine,
  chart: ChartLine,
}

export const courseColor = (c: CourseColor | undefined) => `var(--course-${c ?? 'slate'})`
export const courseSoft = (c: CourseColor | undefined, pct = 12) => `color-mix(in srgb, var(--course-${c ?? 'slate'}) ${pct}%, transparent)`

export function CourseDot({ color, className }: { color?: CourseColor; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: courseColor(color) }} />
}

/** "● PSYC 210" label used next to every task so the course is always visible. */
export function CourseTag({ course, className, full }: { course: Course | undefined | null; className?: string; full?: boolean }) {
  if (!course) return <span className={cn('text-xs text-fg-3', className)}>No course</span>
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-xs text-fg-2', className)}>
      <CourseDot color={course.color} />
      <span className="truncate">{full ? `${course.code} · ${course.name}` : course.code}</span>
    </span>
  )
}

export function CourseAvatar({ course, size = 'md' }: { course: Pick<Course, 'color' | 'icon'>; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = COURSE_ICON[course.icon] ?? BookOpen
  const dims = size === 'sm' ? 'size-6 rounded-md' : size === 'lg' ? 'size-11 rounded-lg' : 'size-8 rounded-md'
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center', dims)} style={{ background: courseSoft(course.color, 14), color: courseColor(course.color) }}>
      <Icon className={size === 'lg' ? 'size-5' : size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2} />
    </span>
  )
}
