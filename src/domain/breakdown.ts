import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns'
import { parseInstant, toLocalDay } from './dates'
import type { Assignment, AssignmentType, LocalDay } from './types'

export interface SuggestedStep {
  title: string
  estimatedMinutes: number | null
  plannedFor: LocalDay | null
}

/** Each template step carries the share of the total estimate it typically takes. */
const TEMPLATES: Record<AssignmentType, Array<[string, number]>> = {
  essay: [
    ['Review the assignment instructions and rubric', 0.05],
    ['Find and evaluate sources', 0.2],
    ['Create an outline and thesis', 0.1],
    ['Draft the introduction and main sections', 0.35],
    ['Revise and verify citations', 0.2],
    ['Proofread and prepare the final submission', 0.1],
  ],
  problem_set: [
    ['Read the problems and note what each one asks', 0.1],
    ['Review the related lecture notes and examples', 0.15],
    ['Work through the first half of the problems', 0.3],
    ['Work through the remaining problems', 0.3],
    ['Check answers and write up clean solutions', 0.15],
  ],
  project: [
    ['Clarify requirements and deliverables', 0.08],
    ['Plan the approach and split the work', 0.12],
    ['Build the first working version', 0.35],
    ['Complete remaining features or sections', 0.25],
    ['Test, review, and polish', 0.12],
    ['Package and submit the deliverables', 0.08],
  ],
  lab: [
    ['Read the lab handout and pre-lab questions', 0.15],
    ['Organize the collected data', 0.2],
    ['Run the analysis and make figures', 0.3],
    ['Write the report sections', 0.25],
    ['Check formatting and submit', 0.1],
  ],
  quiz: [
    ['List the topics the quiz covers', 0.15],
    ['Review notes and readings', 0.45],
    ['Do practice questions', 0.4],
  ],
  exam: [
    ['Collect the exam topics and past materials', 0.1],
    ['Review lecture notes topic by topic', 0.3],
    ['Do practice problems or a past exam', 0.3],
    ['Review mistakes and weak topics', 0.2],
    ['Final light review', 0.1],
  ],
  reading: [
    ['Skim headings and summary', 0.15],
    ['Read and annotate', 0.65],
    ['Write a short summary of key ideas', 0.2],
  ],
  discussion: [
    ['Read the prompt and required material', 0.4],
    ['Draft the initial post', 0.4],
    ['Reply to classmates', 0.2],
  ],
  presentation: [
    ['Clarify the topic and time limit', 0.1],
    ['Research and collect content', 0.25],
    ['Build the slides', 0.3],
    ['Rehearse and time it', 0.25],
    ['Final review', 0.1],
  ],
  other: [
    ['Review what is required', 0.15],
    ['Do the main work', 0.65],
    ['Check and submit', 0.2],
  ],
}

function roundTo5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5)
}

/**
 * Rule-based breakdown: picks a template for the assignment type, splits the estimate by typical
 * shares, and spreads the steps across the days before the deadline (never after it).
 * Students review and edit every step before anything is saved.
 */
export function suggestBreakdown(
  a: Pick<Assignment, 'type' | 'dueAt' | 'estimatedMinutes'>,
  now: Date,
  totalMinutesOverride?: number | null,
): SuggestedStep[] {
  const template = TEMPLATES[a.type] ?? TEMPLATES.other
  const total = totalMinutesOverride ?? a.estimatedMinutes
  const due = parseInstant(a.dueAt)
  const today = startOfDay(now)
  let days: Date[] = []
  if (due && due.getTime() > now.getTime()) {
    // Work on days strictly before the due day when possible; otherwise on the due day itself.
    const span = differenceInCalendarDays(due, today)
    const count = Math.max(1, span)
    days = Array.from({ length: count }, (_, i) => addDays(today, i))
  }
  return template.map(([title, share], i) => {
    const day = days.length ? days[Math.min(days.length - 1, Math.floor((i * days.length) / template.length))] : null
    return {
      title,
      estimatedMinutes: total ? roundTo5(total * share) : null,
      plannedFor: day ? toLocalDay(day) : null,
    }
  })
}
