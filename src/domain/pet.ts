import { isAssignmentDone, isAssignmentOverdue } from './assignments'
import type { XpEvent } from './game'
import type { Assignment } from './types'

/**
 * The study pet. Pure functions only.
 *
 * - The student picks a species and a name. The pet grows with the student's level.
 * - Its mood mirrors how things are going. It never dies: finishing anything cheers it up.
 */

export type PetSpecies = 'cat' | 'dragon' | 'bunny' | 'fox' | 'axolotl'

export interface PetChoice {
  species: PetSpecies
  name: string
}

export const PET_SPECIES: Array<{ id: PetSpecies; kind: string; name: string; blurb: string }> = [
  { id: 'dragon', kind: 'Baby dragon', name: 'Ember', blurb: 'Little wings and horns' },
  { id: 'cat', kind: 'Cat blob', name: 'Mochi', blurb: 'Soft, round, cat ears' },
  { id: 'bunny', kind: 'Bunny', name: 'Puff', blurb: 'Fluffy with long ears' },
  { id: 'fox', kind: 'Fox', name: 'Sunny', blurb: 'Orange with a fluffy tail' },
  { id: 'axolotl', kind: 'Axolotl', name: 'Bubbles', blurb: 'Pink with frilly gills' },
]

export type PetStage = 'egg' | 'baby' | 'kid' | 'teen' | 'adult' | 'legend'

const STAGES: Array<{ stage: PetStage; label: string; from: number }> = [
  { stage: 'egg', label: 'Egg', from: 1 },
  { stage: 'baby', label: 'Baby', from: 2 },
  { stage: 'kid', label: 'Kid', from: 4 },
  { stage: 'teen', label: 'Teen', from: 6 },
  { stage: 'adult', label: 'Grown up', from: 8 },
  { stage: 'legend', label: 'Legend', from: 12 },
]

export function petStage(level: number): { stage: PetStage; label: string; next: { label: string; at: number } | null } {
  let i = 0
  while (i + 1 < STAGES.length && level >= STAGES[i + 1].from) i++
  const next = STAGES[i + 1]
  return { stage: STAGES[i].stage, label: STAGES[i].label, next: next ? { label: next.label, at: next.from } : null }
}

export type PetMood = 'happy' | 'ok' | 'worried' | 'sleepy'

const DAY = 86_400_000

/** Worried with 2+ late, okay with 1, sleepy after 2 quiet days, otherwise happy. */
export function petMood(assignments: Assignment[], events: XpEvent[], now: Date): { mood: PetMood; late: number } {
  const late = assignments.filter((a) => !isAssignmentDone(a) && isAssignmentOverdue(a, now)).length
  if (late >= 2) return { mood: 'worried', late }
  if (late === 1) return { mood: 'ok', late }
  const last = events.filter((e) => e.kind === 'assignment' || e.kind === 'task').reduce((m, e) => Math.max(m, new Date(e.at).getTime()), 0)
  if (last && now.getTime() - last > 2 * DAY) return { mood: 'sleepy', late }
  return { mood: 'happy', late }
}

export function petLine(mood: PetMood, name: string, late: number): { title: string; text: string } {
  switch (mood) {
    case 'worried':
      return { title: `${name} is worried`, text: `${late} things are late. Finish one to cheer ${name} up!` }
    case 'ok':
      return { title: `${name} is okay`, text: `1 thing is late. Catch up and ${name} will be all smiles.` }
    case 'sleepy':
      return { title: `${name} is sleepy`, text: `Nothing finished in a couple of days. Wake ${name} up with a quick win!` }
    default:
      return { title: `${name} is happy`, text: 'Nothing late. Keep it up!' }
  }
}
