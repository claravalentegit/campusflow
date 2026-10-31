import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { create } from 'zustand'
import { PartyPopper, Sparkles } from 'lucide-react'
import { assignmentEvent } from '@/domain/game'
import { fmtDate, useT } from '@/i18n'
import { useStore } from '@/store/appStore'
import { cannons, celebrateCompletion, sfx } from '@/game/fx'
import { CourseDot } from '@/components/course'
import { CheckButton, XpChip } from '@/components/game/GameUI'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/components/ui/cn'

/** Open or close the "Good job!" list from anywhere (Today has a button for it). */
export const useTurnedIn = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }))

interface Row {
  id: string
  at: string
  title: string
  courseName: string
  courseColor: string | undefined
  xp: number
}

/**
 * "Good job!": work you turned in on Canvas, listed so you can cross each one off and collect its XP.
 * Opens by itself whenever a sync finds newly turned-in work.
 */
export function TurnedInDialog() {
  const t = useT()
  const open = useTurnedIn((s) => s.open)
  const setOpen = useTurnedIn((s) => s.setOpen)
  const toClaim = useStore((s) => s.prefs.toClaim)
  const mode = useStore((s) => s.prefs.dataMode)
  const [rows, setRows] = useState<Row[]>([])
  const [earned, setEarned] = useState(0)
  const seen = useRef(0)
  const pending = useMemo(() => new Set(toClaim.map((x) => x.id)), [toClaim])

  // Once: list Canvas work turned in lately that never earned XP.
  useEffect(() => {
    if (mode === 'canvas') useStore.getState().recoverTurnedIn()
  }, [mode])

  // New turned-in work opens the list (and adds to it if it's already open).
  useEffect(() => {
    const s = useStore.getState()
    const fresh = toClaim.filter((x) => !rows.some((r) => r.id === x.id))
    if (fresh.length) {
      const add = fresh.flatMap((x) => {
        const a = s.assignments.find((y) => y.id === x.id)
        if (!a) return []
        const c = s.courses.find((y) => y.id === a.courseId)
        return [{ id: a.id, at: x.at, title: a.title, courseName: c?.name ?? '', courseColor: c?.color, xp: assignmentEvent(a, s.tasks, new Date(x.at), 'preview').amount }]
      })
      setRows((r) => [...r, ...add].sort((a, b) => a.at.localeCompare(b.at)))
    }
    if (toClaim.length > seen.current && !open) {
      setEarned(0)
      setOpen(true)
    }
    seen.current = toClaim.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toClaim])

  const left = rows.filter((r) => pending.has(r.id))
  const allDone = rows.length > 0 && left.length === 0

  const crossOff = (row: Row, el: Element | null) => {
    const events = useStore.getState().claimTurnedIn([row.id])
    const xp = events.reduce((s, e) => s + e.amount, 0)
    if (!events.length) return
    setEarned((n) => n + xp)
    celebrateCompletion(el, xp)
    if (!useStore.getState().prefs.toClaim.length) setTimeout(cannons, 300)
  }

  const crossOffAll = async () => {
    for (const row of left) {
      crossOff(row, document.querySelector(`[data-turned-in="${row.id}"] [role=checkbox]`))
      await new Promise((r) => setTimeout(r, 140))
    }
  }

  const close = () => {
    setOpen(false)
    if (allDone) setRows([])
  }

  const total = left.reduce((s, r) => s + r.xp, 0)
  return (
    <Dialog
      open={open && rows.length > 0}
      onClose={close}
      title={allDone ? t('All crossed off!') : t('Good job! 🎉')}
      description={allDone ? undefined : left.length === 1 ? t('You turned in 1 thing on Canvas. Cross it off to collect your XP.') : t('You turned in {n} things on Canvas. Cross them off to collect your XP.', { n: left.length })}
      footer={
        allDone ? (
          <Button variant="primary" size="lg" className="w-full" onClick={close}>
            {t('Awesome!')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              {t('Not now')}
            </Button>
            <Button variant="success" icon={Sparkles} onClick={() => void crossOffAll()}>
              {t('Cross off all (+{n} XP)', { n: total })}
            </Button>
          </>
        )
      }
    >
      <div data-testid="turned-in">
        <AnimatePresence initial={false}>
          {allDone && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-4 flex flex-col items-center gap-2 text-center">
              <span className="btn-3d grid size-16 place-items-center rounded-3xl bg-success-bright text-white [--press:var(--success-press)]">
                <PartyPopper className="size-8" aria-hidden />
              </span>
              <p className="text-2xl font-black">{t('+{n} XP. Keep it going!', { n: earned })}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const done = !pending.has(r.id)
            return (
              <motion.li
                key={r.id}
                data-turned-in={r.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.04 }}
                className={cn('flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 transition-colors', done ? 'border-success-bright/40 bg-success-soft' : 'border-line bg-surface')}
              >
                <CheckButton checked={done} label={t('Cross off {title}', { title: r.title })} onToggle={(el) => (done ? false : crossOff(r, el))} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate font-extrabold', done && 'text-fg-3 line-through decoration-2')}>{r.title}</span>
                  <span className="flex items-center gap-1.5 truncate text-xs font-bold text-fg-3">
                    <CourseDot color={r.courseColor as never} className="size-2" />
                    <span className="truncate">{r.courseName}</span>
                    <span className="shrink-0">· {t('turned in {when}', { when: fmtDate(new Date(r.at), 'EEE h:mm a') })}</span>
                  </span>
                </span>
                <XpChip amount={r.xp} tone={done ? 'muted' : 'gold'} />
              </motion.li>
            )
          })}
        </ul>
      </div>
    </Dialog>
  )
}

/** On Today: reopen the list when there's turned-in work left to cross off. */
export function TurnedInBanner() {
  const t = useT()
  const n = useStore((s) => s.prefs.toClaim.length)
  const setOpen = useTurnedIn((s) => s.setOpen)
  if (!n) return null
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => {
        sfx.pop()
        setOpen(true)
      }}
      className="btn-3d mb-4 flex w-full items-center gap-3 rounded-2xl bg-success-bright px-4 py-3 text-left font-black text-white [--press:var(--success-press)]"
      data-testid="turned-in-banner"
    >
      <PartyPopper className="size-6 shrink-0" aria-hidden />
      <span className="flex-1">{n === 1 ? t('1 turned in on Canvas · Cross it off') : t('{n} turned in on Canvas · Cross them off', { n })}</span>
    </motion.button>
  )
}
