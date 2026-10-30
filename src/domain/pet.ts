import { lateOpen } from './guide'
import type { XpEvent } from './game'
import { tr } from '@/i18n/core'
import { msg } from '@/i18n/langs'
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
  { id: 'dragon', kind: msg('Baby dragon'), name: 'Ember', blurb: 'Little wings and horns' },
  { id: 'cat', kind: msg('Cat blob'), name: 'Mochi', blurb: 'Soft, round, cat ears' },
  { id: 'bunny', kind: msg('Bunny'), name: 'Puff', blurb: 'Fluffy with long ears' },
  { id: 'fox', kind: msg('Fox'), name: 'Sunny', blurb: 'Orange with a fluffy tail' },
  { id: 'axolotl', kind: msg('Axolotl'), name: 'Bubbles', blurb: 'Pink with frilly gills' },
]

export type PetStage = 'egg' | 'baby' | 'kid' | 'teen' | 'adult' | 'legend'

const STAGES: Array<{ stage: PetStage; label: string; from: number }> = [
  { stage: 'egg', label: msg('Egg'), from: 1 },
  { stage: 'baby', label: msg('Baby'), from: 2 },
  { stage: 'kid', label: msg('Kid'), from: 4 },
  { stage: 'teen', label: msg('Teen'), from: 6 },
  { stage: 'adult', label: msg('Grown up'), from: 8 },
  { stage: 'legend', label: msg('Legend'), from: 12 },
]

export function petStage(level: number): { stage: PetStage; label: string; next: { label: string; at: number } | null } {
  let i = 0
  while (i + 1 < STAGES.length && level >= STAGES[i + 1].from) i++
  const next = STAGES[i + 1]
  return { stage: STAGES[i].stage, label: STAGES[i].label, next: next ? { label: next.label, at: next.from } : null }
}

export type PetMood = 'happy' | 'ok' | 'worried' | 'sleepy'

const DAY = 86_400_000

/** Worried with 2+ late (that can still be turned in), okay with 1, sleepy after 2 quiet days, otherwise happy. */
export function petMood(assignments: Assignment[], events: XpEvent[], now: Date): { mood: PetMood; late: number } {
  // Only late work that can still be turned in: closed work can't be fixed, so it shouldn't worry the pet forever.
  const late = lateOpen(assignments, now).length
  if (late >= 2) return { mood: 'worried', late }
  if (late === 1) return { mood: 'ok', late }
  const last = events.filter((e) => e.kind === 'assignment' || e.kind === 'task').reduce((m, e) => Math.max(m, new Date(e.at).getTime()), 0)
  if (last && now.getTime() - last > 2 * DAY) return { mood: 'sleepy', late }
  return { mood: 'happy', late }
}

export function petLine(mood: PetMood, name: string, late: number): { title: string; text: string } {
  switch (mood) {
    case 'worried':
      return { title: tr('{name} is worried', { name }), text: tr('{n} things are late. Finish one to cheer {name} up!', { n: late, name }) }
    case 'ok':
      return { title: tr('{name} is okay', { name }), text: tr('1 thing is late. Catch up and {name} will be all smiles.', { name }) }
    case 'sleepy':
      return { title: tr('{name} is sleepy', { name }), text: tr('Nothing finished in a couple of days. Wake {name} up with a quick win!', { name }) }
    default:
      return { title: tr('{name} is happy', { name }), text: tr('Nothing late. Keep it up!') }
  }
}
