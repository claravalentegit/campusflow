/**
 * Pixel-art characters, drawn from text grids. Each letter is a colour; '.' is empty.
 * k outline · h/H hair · s/S skin · e eye · w white · b blush · m mouth · t/T shirt · p/P pants · o shoes
 * B book · g page lines · u cup · hats: R/Q/W beanie · C/D cap · F/y/G flowers · Y/Z crown
 */
import type { Look, Status } from '../shared/model.ts'

const W = 18
const HAT_ROWS = 4 // empty space above every head, so all characters stand on the same line

const HEADS: Record<string, string[]> = {
  short: [
    '......kkkkkk......',
    '....kkhhhhhhkk....',
    '...khhhHHHHhhhk...',
    '..khhHHhhhhhhhhk..',
    '..khhhhhhhhhhhhk..',
    '.khhhssssssssshhk.',
    '.khhssssssssssshk.',
    '.khsseessssseeshk.',
    '.khssewsssssewshk.',
    '.khsssssssssssshk.',
    '.khsbbssssssbbshk.',
    '..ksssssmmsssssk..',
    '...kkSssssssSkk...',
  ],
  long: [
    '......kkkkkk......',
    '....kkhhhhhhkk....',
    '...khhhHHHHhhhk...',
    '..khhHHhhhhhhhhk..',
    '..khhhhhhhhhhhhk..',
    '.khhhssssssssshhk.',
    '.khhssssssssssshk.',
    '.khsseessssseeshk.',
    '.khssewsssssewshk.',
    '.khsssssssssssshk.',
    '.khsbbssssssbbshk.',
    '.khhsssssmmssshhk.',
    '.khhkSssssssSkhhk.',
  ],
  curly: [
    '...kk.kkkkkk.kk...',
    '..khhkhhhhhhkhhk..',
    '.khhHhhhHHhhhHhhk.',
    '.khHhhhhhhhhhhhhk.',
    'khhhhhhhhhhhhhhhhk',
    'khhhssssssssssshhk',
    '.khhssssssssssshk.',
    '.khsseessssseeshk.',
    '.khssewsssssewshk.',
    '.khsssssssssssshk.',
    '.khsbbssssssbbshk.',
    '..ksssssmmsssssk..',
    '...kkSssssssSkk...',
  ],
  bun: [
    '......kkkkkk......',
    '....kkhhhhhhkk....',
    '...khhhHHHHhhhk...',
    '..khhHHhhhhhhhhk..',
    '..khhhhhhhhhhhhk..',
    '.khhhssssssssshhk.',
    '.khhssssssssssshk.',
    '.khsseessssseeshk.',
    '.khssewsssssewshk.',
    '.khsssssssssssshk.',
    '.khsbbssssssbbshk.',
    '..ksssssmmsssssk..',
    '...kkSssssssSkk...',
  ],
}
export const HAIR_STYLES = ['short', 'long', 'curly', 'bun'] as const

const BODY = [
  '....kkttttttkk....',
  '...kttttttttttk...',
  '..ktTttttttttTtk..',
  '..ktTttttttttTtk..',
  '..ktTttttttttTtk..',
  '..ksTttttttttTsk..',
  '..kskttttttttksk..',
  '...kkppppppppkk...',
  '....kppppppppk....',
  '....kpppkkpppk....',
  '....kppk..kppk....',
  '....kppk..kppk....',
  '....kPPk..kPPk....',
  '...koook..koook...',
  '...kkkkk..kkkkk...',
]

/** Hats are 6 rows drawn from the very top; the last 2 rows overlap the top of the head. */
const HATS: Array<string[] | null> = [
  null,
  [
    '........kk........',
    '......kkWWkk......',
    '....kkRRRRRRkk....',
    '...kRRQRRRRQRRk...',
    '..kWWWWWWWWWWWWk..',
    '..kkkkkkkkkkkkkk..',
  ],
  [
    '..................',
    '......kkkkkk......',
    '....kkCCCCCCkk....',
    '...kCCCCwwCCCCk...',
    '..kDDDDDDDDDDDDkk.',
    '..kkkkkkkkkCCCCCCk',
  ],
  [
    '..................',
    '..................',
    '..................',
    '..kF..kF..Fk..Fk..',
    '.kFyFkFyFkFyFkFyF.',
    '..kGGGGGGGGGGGGk..',
  ],
  [
    '..................',
    '...k..k....k..k...',
    '..kYk.kYkkYk.kYk..',
    '..kYYkYYYYYYkYYk..',
    '..kYYYYZYYZYYYYk..',
    '..kkkkkkkkkkkkkk..',
  ],
]
const BUN = ['..................', '.......kkkk.......', '......khhhhk......', '......khHhhk......', '.......kkkk.......', '..................']

const SKINS = [
  ['#f6cfaa', '#e0a985'],
  ['#e8b48f', '#cf9670'],
  ['#c68a62', '#a56d48'],
  ['#8d5a3b', '#6e4229'],
  ['#5e3a26', '#47291a'],
]
const HAIRS = [
  ['#3b2a20', '#5e4232'],
  ['#1d1a2b', '#3a3355'],
  ['#f2b84b', '#ffd67a'],
  ['#b5502e', '#d9724a'],
  ['#8a8494', '#b3aec0'],
  ['#7c5cff', '#a48cff'],
]
const SHIRTS = [
  ['#7c5cff', '#5a3be0'],
  ['#ff7b7b', '#e05a5a'],
  ['#5bc6e8', '#2fa3c4'],
  ['#f5b041', '#d99500'],
  ['#4fae7c', '#378a5d'],
  ['#ff8fc8', '#e06aa6'],
  ['#f4efe2', '#d6cfbd'],
]
const PANTS = ['#3d4a7a', '#4a3550', '#8a6ad6', '#6b5040']
export const SWATCHES = { skin: SKINS.map((s) => s[0]), hairColor: HAIRS.map((h) => h[0]), shirt: SHIRTS.map((s) => s[0]), pants: PANTS }

function palette(look: Look, status: Status): Record<string, string> {
  const [s, S] = SKINS[look.skin]
  const [h, H] = HAIRS[look.hairColor]
  const [t, T] = SHIRTS[look.shirt]
  return {
    k: '#2a1d33', h, H, s, S, e: '#2a1d33', w: '#ffffff', b: '#ff9fb2', m: '#c2546b', t, T,
    p: PANTS[look.pants], P: '#1e2440', o: '#4a3550',
    B: status === 'study' ? ['#ef6b6b', '#5b8def', '#4fae7c', '#f5b041'][look.shirt % 4] : '#ef6b6b', g: '#c9bfd8', u: '#ffb36b',
    R: '#ef6b6b', Q: '#c94f4f', W: '#fff5e6', C: '#5b8def', D: '#3f6fd1', F: '#ff8fc8', y: '#ffd36b', G: '#4fae7c', Y: '#ffcf3d', Z: '#ef4b6b',
  }
}

function grid(look: Look, status: Status, blink: boolean): string[] {
  const head = HEADS[HAIR_STYLES[look.hair]].map((r) => r)
  const body = BODY.map((r) => r)
  const rows = [...Array(HAT_ROWS).fill('.'.repeat(W)), ...head, ...body].map((r) => r.split(''))
  const at = (row: number, line: string) => (rows[HAT_ROWS + row] = line.split(''))
  if (blink || status === 'rest') {
    at(7, '.khsssssssssssshk.')
    at(8, '.khskksssssskkshk.')
  }
  if (status === 'study') {
    at(14, '...kkkkkkkkkkkk...')
    at(15, '..kBwwwwwkwwwwwBk.')
    at(16, '..kBwgggwkwgggwBk.')
    at(17, '..kBwwwwwkwwwwwBk.')
    at(18, '.ksBBBBBBBBBBBBBsk')
  }
  if (status === 'break') {
    at(14, '..ktTttttttttTtkuu')
    at(15, '..ktTttttttttTtkuu')
    at(16, '..ksTttttttttTskuu')
  }
  // Hats (or a bun) are drawn over the top rows.
  const hat = HATS[look.hat] ?? (HAIR_STYLES[look.hair] === 'bun' ? BUN : null)
  if (hat)
    hat.forEach((line, r) =>
      line.split('').forEach((ch, c) => {
        if (ch !== '.') rows[r][c] = ch
      }),
    )
  return rows.map((r) => r.join(''))
}

export const SPRITE_W = W
export const SPRITE_H = HAT_ROWS + 13 + BODY.length

const cache = new Map<string, string>()

/** A PNG data URL of the character at 1 pixel per cell; scale it up in CSS with image-rendering: pixelated. */
export function spriteUrl(look: Look, status: Status, blink = false): string {
  const id = `${Object.values(look).join(',')}|${status}|${blink}`
  const hit = cache.get(id)
  if (hit) return hit
  const rows = grid(look, status, blink)
  const pal = palette(look, status)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = rows.length
  const ctx = canvas.getContext('2d')!
  rows.forEach((row, y) =>
    row.split('').forEach((ch, x) => {
      if (ch === '.') return
      ctx.fillStyle = pal[ch] ?? '#ff00ff'
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  const url = canvas.toDataURL('image/png')
  cache.set(id, url)
  return url
}
