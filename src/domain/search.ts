import type { AppData } from './types'

export type SearchCategory = 'course' | 'assignment' | 'task'

export interface SearchResult {
  category: SearchCategory
  id: string
  title: string
  subtitle: string
  courseId: string | null
  href: string
  score: number
}

function scoreMatch(query: string, title: string, extra: string[]): number {
  const t = title.toLowerCase()
  if (t === query) return 100
  if (t.startsWith(query)) return 80
  if (t.split(/\s+/).some((w) => w.startsWith(query))) return 60
  if (t.includes(query)) return 50
  if (extra.some((e) => e.toLowerCase().includes(query))) return 20
  return 0
}

export function searchAll(data: AppData, rawQuery: string, limitPerCategory = 6): SearchResult[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []
  const courseName = new Map(data.courses.map((c) => [c.id, c.code]))
  const results: SearchResult[] = []
  const push = (r: Omit<SearchResult, 'score'>, extra: string[]) => {
    const score = scoreMatch(query, r.title, extra)
    if (score > 0) results.push({ ...r, score })
  }
  for (const c of data.courses)
    push({ category: 'course', id: c.id, title: c.name, subtitle: [c.code, c.instructor].filter(Boolean).join(' · '), courseId: c.id, href: '/courses' }, [c.code, c.instructor ?? '', c.description])
  for (const a of data.assignments)
    push({ category: 'assignment', id: a.id, title: a.title, subtitle: courseName.get(a.courseId) ?? '', courseId: a.courseId, href: `/?open=${a.id}` }, [a.description, a.personalNotes])
  for (const t of data.tasks)
    push(
      {
        category: 'task',
        id: t.id,
        title: t.title,
        subtitle: t.courseId ? (courseName.get(t.courseId) ?? '') : 'Study task',
        courseId: t.courseId,
        href: t.assignmentId ? `/?open=${t.assignmentId}` : `#task:${t.id}`,
      },
      [],
    )

  const byCat = new Map<SearchCategory, SearchResult[]>()
  for (const r of results.sort((a, b) => b.score - a.score)) {
    const list = byCat.get(r.category) ?? []
    if (list.length < limitPerCategory) list.push(r)
    byCat.set(r.category, list)
  }
  const order: SearchCategory[] = ['assignment', 'course', 'task']
  return order.flatMap((c) => byCat.get(c) ?? [])
}
