import { useEffect, type ReactNode } from 'react'
import { cn } from './ui/cn'

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · CampusFlow` : 'CampusFlow'
  }, [title])
}

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 py-5 sm:px-6 sm:py-6', wide ? 'max-w-[1400px]' : 'max-w-6xl', className)}>{children}</div>
}

export function PageHeader({ title, description, actions, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm font-bold text-fg-3">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
