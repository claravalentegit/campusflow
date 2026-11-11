// Draws the home-screen icons (run: node scripts/make-icons.mjs public). Needs Playwright's Chromium.
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

let playwright
try {
  playwright = createRequire(import.meta.url)('playwright')
} catch {
  playwright = createRequire(join(execSync('npm root -g').toString().trim(), 'noop.js'))('playwright')
}
const { chromium } = playwright
const out = process.argv[2]
// Full-bleed square: phones round the corners themselves. `pad` shrinks the bolt for maskable icons.
const icon = ({ top, bottom, shadow, pad = 1 }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
    <radialGradient id="shine" cx="0.3" cy="0.2" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <rect width="512" height="512" fill="url(#shine)"/>
  <g transform="translate(256 262) scale(${pad}) translate(-256 -256)">
    <path d="M290 66 L132 282 h110 l-26 164 L382 222 H270 z" fill="${shadow}" transform="translate(0 18)"/>
    <path d="M290 66 L132 282 h110 l-26 164 L382 222 H270 z" fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round"/>
  </g>
</svg>`
const sets = {
  '': { top: '#8a6bff', bottom: '#5a35f0', shadow: '#3f21b8' },
  'family-': { top: '#22c4c2', bottom: '#0b8f8e', shadow: '#066463' },
}
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [prefix, c] of Object.entries(sets)) {
  writeFileSync(`${out}/${prefix}icon.svg`, icon(c))
  for (const [name, size, pad] of [['apple-touch-icon', 180, 0.88], ['icon-192', 192, 0.88], ['icon-512', 512, 0.88], ['icon-maskable-512', 512, 0.72]]) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>html,body{margin:0}</style>${icon({ ...c, pad }).replace('<svg ', `<svg width="${size}" height="${size}" `)}`)
    await page.screenshot({ path: `${out}/${prefix}${name}.png`, omitBackground: false })
  }
}
await browser.close()
