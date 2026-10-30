import { useEffect } from 'react'
import { completionsOn, levelFor, qualifyingBadges, QUEST_BONUS, streak, totalXp } from '@/domain/game'
import { toLocalDay } from '@/domain/dates'
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
