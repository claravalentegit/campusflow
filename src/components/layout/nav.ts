import { BookOpen, Route, Swords, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: Swords, end: true },
  { to: '/plan', label: 'Plan', icon: Route },
  { to: '/courses', label: 'Courses', icon: BookOpen },
  { to: '/me', label: 'Me', icon: UserRound },
]

export const DATA_MODE_LABEL = { demo: 'Demo data', manual: 'Your data', canvas: 'Canvas (read-only)' } as const
