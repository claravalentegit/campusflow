import { BookOpen, Route, Swords, UserRound, type LucideIcon } from 'lucide-react'
import { msg } from '@/i18n/langs'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: msg('Today'), icon: Swords, end: true },
  { to: '/plan', label: msg('Plan'), icon: Route },
  { to: '/courses', label: msg('Courses'), icon: BookOpen },
  { to: '/me', label: msg('Me'), icon: UserRound },
]

export const DATA_MODE_LABEL = { demo: msg('Demo data'), manual: msg('Your data'), canvas: msg('Canvas (read-only)') } as const
