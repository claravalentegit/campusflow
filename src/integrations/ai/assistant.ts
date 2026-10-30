import { suggestBreakdown, type SuggestedStep } from '@/domain/breakdown'
import type { Assignment } from '@/domain/types'
import { tr } from '@/i18n/core'

/**
 * Extension point for an optional planning assistant.
 *
 * The default implementation is rule-based (templates by assignment type) and runs entirely in the
 * browser. A future AI-backed implementation should:
 *  - run its API calls on the server (never ship an API key to the browser),
 *  - only send assignment text after the student opts in (`Preferences.aiConsent`),
 *  - return suggestions marked as suggestions, list missing information, and never invent
 *    requirements or claim access to Canvas.
 */
export interface PlanningAssistant {
  readonly id: 'rules' | 'ai'
  readonly label: string
  breakDown(assignment: Assignment, now: Date, totalMinutes: number | null): Promise<{ steps: SuggestedStep[]; missingInfo: string[] }>
}

export function missingInfoFor(a: Assignment): string[] {
  const missing: string[] = []
  if (!a.dueAt) missing.push(tr('No due date — the steps cannot be scheduled.'))
  if (!a.estimatedMinutes) missing.push(tr('No time estimate — add one to size each step.'))
  if (!a.description.trim()) missing.push(tr('No description — check Canvas Pages, Files, and the syllabus for the instructions.'))
  if (!a.submissionInstructions.trim()) missing.push(tr('No submission instructions recorded.'))
  if (!a.rubricNotes.trim() && a.type !== 'reading') missing.push(tr('No rubric or grading notes recorded.'))
  return missing
}

export const ruleBasedAssistant: PlanningAssistant = {
  id: 'rules',
  label: 'Rule-based template',
  async breakDown(assignment, now, totalMinutes) {
    return { steps: suggestBreakdown(assignment, now, totalMinutes), missingInfo: missingInfoFor(assignment) }
  },
}
