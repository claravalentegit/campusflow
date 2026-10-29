import { useEffect } from 'react'
import { completionsOn, levelFor, qualifyingBadges, QUEST_BONUS, streak, totalXp } from '@/domain/game'
import { toLocalDay } from '@/domain/dates'
import { isAssignmentDone } from '@/domain/assignments'
import { lateOpen, RESCUE_BONUS, RESCUE_MIN_LATE, rescueOrder } from '@/domain/rescue'
import { useNow } from '@/hooks/useNow'
import { useStore } from '@/store/appStore'
import { useCelebrations } from './celebrations'

/**
 * Turns progress into moments: completes the daily quest (adds the bonus once), detects level-ups
 * and new badges, and queues their celebrations. Undo is handled quietly: losing a level or
 * dropping below the daily goal never plays anything.
 */
export function GameWatcher() {
  const events = useStore((s) => s.xpEvents)
  const goal = useStore((s) => s.prefs.dailyGoal)
  const badges = useStore((s) => s.badges)
  const assignments = useStore((s) => s.assignments)
  const rescue = useStore((s) => s.prefs.rescue)
  const now = useNow(60_000)

  // Rescue plan: starts when enough work is late, takes in work that becomes late later,
  // and pays its bonus once everything in it is done.
  useEffect(() => {
    const st = useStore.getState()
    const late = lateOpen(assignments, now)
    if (!rescue) {
      if (late.length >= RESCUE_MIN_LATE) st.updatePrefs({ rescue: { ids: rescueOrder(late), startedAt: now.toISOString() } })
      return
    }
    const inPlan = assignments.filter((a) => rescue.ids.includes(a.id))
    const added = late.filter((a) => !rescue.ids.includes(a.id))
    if (added.length) {
      st.updatePrefs({ rescue: { ...rescue, ids: [...rescue.ids, ...rescueOrder(added)] } })
      return
    }
    if (inPlan.length === 0) {
      st.updatePrefs({ rescue: null })
      return
    }
    if (inPlan.every(isAssignmentDone)) {
      st.updatePrefs({ rescue: null })
      const id = `rescue_${rescue.startedAt}`
      if (!st.xpEvents.some((e) => e.id === id)) {
        st.addXpEvent({ id, at: new Date().toISOString(), amount: RESCUE_BONUS, kind: 'rescue', refId: id })
        useCelebrations.getState().push({ kind: 'rescue', bonus: RESCUE_BONUS })
      }
    }
  }, [assignments, rescue, now])

  useEffect(() => {
    const st = useStore.getState()
    const push = useCelebrations.getState().push
    const now = new Date()
    const day = toLocalDay(now)
    const bonusId = `quest_${day}`
    const hasBonus = events.some((e) => e.id === bonusId)
    const done = completionsOn(events, now)

    if (done >= goal && !hasBonus) {
      st.addXpEvent({ id: bonusId, at: now.toISOString(), amount: QUEST_BONUS, kind: 'quest', refId: `quest:${day}` })
      if (st.prefs.questCelebratedOn !== day) {
        st.updatePrefs({ questCelebratedOn: day })
        push({ kind: 'quest', streak: streak(events, now, goal).days, bonus: QUEST_BONUS })
      }
      return // the bonus changes XP; the next run checks levels and badges
    }
    if (done < goal && hasBonus) {
      st.removeXpEvent(bonusId)
      return
    }

    const level = levelFor(totalXp(events)).level
    if (level > st.prefs.lastSeenLevel) {
      st.updatePrefs({ lastSeenLevel: level })
      push({ kind: 'level', level })
    } else if (level < st.prefs.lastSeenLevel) {
      st.updatePrefs({ lastSeenLevel: level })
    }

    const earned = new Set(badges.map((b) => b.id))
    for (const id of qualifyingBadges(events, now, goal)) {
      if (earned.has(id)) continue
      st.addBadge(id)
      push({ kind: 'badge', id })
    }
  }, [events, goal, badges])

  return null
}
