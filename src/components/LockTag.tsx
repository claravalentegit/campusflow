import { format, isSameDay } from 'date-fns'
import { Lock } from 'lucide-react'
import { isAssignmentDone, lockState } from '@/domain/assignments'
import type { Assignment } from '@/domain/types'
import { cn } from '@/components/ui/cn'

/** Canvas availability: "Opens Mon Nov 3" (not open yet) or "Closed" (can't turn it in anymore). */
export function lockText(a: Assignment, now: Date): { text: string; detail: string; closed: boolean } | null {
  const l = lockState(a, now)
  if (!l || isAssignmentDone(a)) return null
  if (l.kind === 'opens') {
    const when = isSameDay(l.at, now) ? format(l.at, 'h:mm a') : format(l.at, 'EEE MMM d')
    return { text: `Opens ${when}`, detail: `Locked on Canvas until ${format(l.at, 'EEE MMM d, h:mm a')}. You can look at it, but you can’t turn it in yet.`, closed: false }
  }
  return {
    text: 'Closed',
    detail: `Locked on Canvas${l.at ? ` since ${format(l.at, 'EEE MMM d, h:mm a')}` : ''}: it can’t be turned in anymore.${l.why ? ` ${l.why}` : ''} Ask your teacher if you still need to.`,
    closed: true,
  }
}

export function LockTag({ a, now, className }: { a: Assignment; now: Date; className?: string }) {
  const l = lockText(a, now)
  if (!l) return null
  return (
    <span title={l.detail} className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black', l.closed ? 'bg-surface-3 text-fg-2' : 'bg-[#e7f0ff] text-[#2f5fcf]', className)}>
      <Lock className="size-3" strokeWidth={3} aria-hidden />
      {l.text}
    </span>
  )
}
