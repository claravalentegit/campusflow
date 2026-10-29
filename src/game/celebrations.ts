import { create } from 'zustand'
import type { BadgeId } from '@/domain/game'

export type Celebration =
  | { kind: 'quest'; streak: number; bonus: number }
  | { kind: 'level'; level: number }
  | { kind: 'badge'; id: BadgeId }
  | { kind: 'rescue'; bonus: number }

export const useCelebrations = create<{ queue: Celebration[]; push: (c: Celebration) => void; next: () => void }>((set) => ({
  queue: [],
  push: (c) => set((s) => ({ queue: [...s.queue, c] })),
  next: () => set((s) => ({ queue: s.queue.slice(1) })),
}))
