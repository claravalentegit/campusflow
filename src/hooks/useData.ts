import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { AppData, Course } from '@/domain/types'
import { selectData, useStore } from '@/store/appStore'

export function useAppData(): AppData {
  return useStore(useShallow(selectData))
}

export function useCourseMap(): Map<string, Course> {
  const courses = useStore((s) => s.courses)
  return useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])
}

/** Courses that appear in pickers and on the dashboard: active and not hidden. */
export function useVisibleCourses(): Course[] {
  const courses = useStore((s) => s.courses)
  return useMemo(() => courses.filter((c) => c.status === 'active' && !c.hidden), [courses])
}

export function useVisibleCourseIds(): Set<string> {
  const visible = useVisibleCourses()
  return useMemo(() => new Set(visible.map((c) => c.id)), [visible])
}
