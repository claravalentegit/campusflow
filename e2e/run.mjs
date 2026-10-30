/**
 * End-to-end acceptance tests against the production build.
 *   npm run build && npm run test:e2e
 * Starts the CampusFlow server (API + dist) on a free port, drives Chromium with Playwright,
 * and exits non-zero on any failure. Uses the Playwright already installed on the machine if the
 * project does not depend on it.
 */
import { spawn, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { MOCK_TOKEN, startMockCanvas } from './mock-canvas.mjs'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
let playwright
try {
  playwright = require('playwright')
} catch {
  playwright = createRequire(join(execSync('npm root -g').toString().trim(), 'noop.js'))('playwright')
}
const { chromium } = playwright

if (!existsSync(join(root, 'dist/index.html'))) {
  console.error('Build first: npm run build')
  process.exit(1)
}

const PORT = 8899
const BASE = `http://localhost:${PORT}`
const MOCK_PORT = 8898
const MOCK = `http://localhost:${MOCK_PORT}`
const mock = await startMockCanvas(MOCK_PORT)
// The app server talks to the mock Canvas. http is allowed only because this is a local test.
const server = spawn(process.execPath, ['server/index.ts', '--serve-dist'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR: mkdtempSync(join(tmpdir(), 'cf-e2e-')),
    CANVAS_BASE_URL: '',
    CANVAS_ACCESS_TOKEN: '',
    CANVAS_ALLOW_INSECURE: '1',
  },
  stdio: 'ignore',
})
await new Promise((r) => setTimeout(r, 800))

const shots = join(root, 'e2e/screenshots')
mkdirSync(shots, { recursive: true })
const browser = await chromium.launch()
const results = []
const consoleErrors = []

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function test(name, fn, viewport = { width: 1366, height: 900 }, opts = {}) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.on('console', (m) => m.type() === 'error' && !(opts.allowNetworkErrors && /ERR_FAILED|Failed to load resource/.test(m.text())) && consoleErrors.push(`${name}: ${m.text()}`))
  page.on('pageerror', (e) => consoleErrors.push(`${name}: ${e}`))
  try {
    // The app opens on the Canvas sign-in screen; most tests continue with the demo.
    if (!opts.fresh) {
      await page.goto(`${BASE}/`)
      await page.getByRole('button', { name: 'Try the demo instead' }).first().click()
      await page.getByTestId('day-summary').waitFor()
    }
    await fn(page)
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (e) {
    results.push({ name, ok: false, error: e.message })
    console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`)
    await page.screenshot({ path: join(shots, `FAIL-${name.replace(/\W+/g, '-')}.png`), fullPage: true }).catch(() => {})
  } finally {
    await context.close()
  }
}

const isoDay = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dialog = (page) => page.locator('dialog[open]')

console.log('CampusFlow e2e')

/** Walk the sign-in flashcards: welcome → address → settings → token → paste. */
async function connectThroughCards(page, address, token) {
  await page.getByRole('button', { name: 'Let’s start' }).click()
  await page.getByLabel('Your school’s Canvas address').fill(address)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('link', { name: /Open Canvas settings/ }).waitFor()
  await page.getByRole('button', { name: 'I’m there' }).click()
  await page.getByText('Approved Integrations').waitFor()
  await page.getByRole('button', { name: 'I copied it' }).click()
  await page.getByLabel('Access token', { exact: true }).fill(token)
  await page.getByRole('button', { name: 'Connect' }).click()
}

const quest = (page, id) => page.locator(`[id="quest-a:${id}"]`)
const openQuest = async (page, id) => {
  await quest(page, id).locator('button[aria-expanded]').click()
  return quest(page, id).getByTestId('quest-details')
}
const pickPet = async (page, kind = 'Fox', name = 'Zippy') => {
  await page.getByRole('radio', { name: kind }).click()
  await page.getByPlaceholder(/Ember|Mochi|Puff|Sunny|Bubbles/).fill(name)
  await page.getByRole('button', { name: `Choose ${name}` }).click()
  await page.getByTestId('pet-mood').waitFor()
}

const xp = async (page) => Number((await page.locator('#xp-target').innerText()).replace(/[^\d]/g, ''))
const ready = (page) => page.getByTestId('day-summary').waitFor()
const keepGoing = async (page) => {
  await page.getByRole('button', { name: /Keep going|Nice!/ }).first().waitFor()
  await page.waitForTimeout(900) // let the entrance animation settle
  await page.getByRole('button', { name: /Keep going|Nice!/ }).last().click()
  await page.waitForTimeout(400)
}

// Finishing late work can unlock a badge or the daily quest; close any celebration that pops up.
const dismissCelebrations = async (page) => {
  await page.waitForTimeout(1200)
  while (await page.getByRole('button', { name: /Keep going|Nice!/ }).count()) {
    await keepGoing(page)
    await page.waitForTimeout(800)
  }
}

await test('1. Add a class; it opens in place on Courses and persists', async (page) => {
  await page.goto(`${BASE}/courses`)
  await page.getByRole('button', { name: 'Add class' }).first().click()
  await dialog(page).getByLabel('Course name').fill('Organic Chemistry')
  await dialog(page).getByLabel('Code', { exact: true }).fill('CHEM 232')
  await dialog(page).getByRole('button', { name: 'Add class' }).click()
  const card = page.getByTestId('course-card').filter({ hasText: 'Organic Chemistry' })
  await card.getByTestId('course-details').getByText('No grades yet').waitFor()
  assert(page.url().endsWith('/courses'), `left the Courses tab: ${page.url()}`)
  await page.reload()
  await card.waitFor()
  await card.locator('button[aria-expanded]').click()
  await card.getByText('CHEM 232').waitFor()
})

await test('2–3, 9. Create an assignment with a due date, edit it, and it persists after reload', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  const d = dialog(page)
  await d.getByLabel('Title').fill('Reaction mechanisms worksheet')
  await d.getByLabel('Course').selectOption({ label: 'BIOL 150 · Introductory Biology' })
  await d.getByLabel('Due date').fill(isoDay(3))
  await d.getByLabel('Due time').fill('17:00')
  await d.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: 'Open' }).last().click()
  const details = page.getByTestId('quest-details')
  await details.getByText(/Due .* 5:00 PM/).waitFor()
  await details.getByRole('button', { name: 'Edit details' }).click()
  await dialog(page).getByLabel('Title').fill('Enzyme mechanisms worksheet')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await page.reload()
  await ready(page)
  await page.getByText('Enzyme mechanisms worksheet').waitFor()
})

await test('4, 9. Completing earns XP, updates counts, survives reload, and Undo takes the XP back', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  const before = await xp(page)
  const count = (t) => Number(/(\d+) things? for today/.exec(t)?.[1] ?? 0)
  const today = count(await page.getByTestId('day-summary').textContent())
  await page.getByRole('checkbox', { name: 'Complete Quiz 7: Working Memory' }).click()
  await page.waitForFunction((n) => Number(/(\d+) things? for today/.exec(document.querySelector('[data-testid=day-summary]')?.textContent ?? '')?.[1] ?? 0) === n, today - 1)
  // The counter rolls up after the flying XP lands; wait for it to settle on +10.
  await page.waitForFunction((b) => Number(document.getElementById('xp-target')?.innerText.replace(/[^\d]/g, '')) === b + 10, before, { timeout: 5000 })
  await page.reload()
  await ready(page)
  assert((await xp(page)) === before + 10, 'XP did not persist')
  await page.getByRole('button', { name: /done today/ }).click()
  await page.getByRole('checkbox', { name: 'Undo Quiz 7: Working Memory' }).click()
  await page.waitForFunction((b) => Number(document.getElementById('xp-target')?.innerText.replace(/[^\d]/g, '')) === b, before, { timeout: 5000 })
})

await test('11. Personal completion is never shown as a Canvas submission', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await page.getByRole('checkbox', { name: 'Complete Quiz 7: Working Memory' }).click()
  await dismissCelebrations(page) // late at night this unlocks Night Owl
  await page.getByRole('button', { name: /done today/ }).click()
  const details = await openQuest(page, 'asg_psyc_quiz7')
  const text = await details.getByTestId('submission-notice').textContent()
  assert(text.includes('does not submit anything to Canvas'), 'missing personal-vs-Canvas notice')
  assert(text.includes('Unknown — not synced with Canvas'), 'Canvas state should be unknown')
  assert(!/Submitted on Canvas/.test(text), 'falsely claims a Canvas submission')
})

await test('Daily quest: 3 completions make a gold day, celebrate, and extend the streak', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await pickPet(page)
  const names = ['Complete Create an outline and thesis', 'Complete Email Prof. Reyes about midterm room conflict', 'Complete Make flashcards for chapters 6–7']
  for (const [i, name] of names.entries()) {
    await page.getByRole('checkbox', { name }).click()
    if (i < names.length - 1) await dismissCelebrations(page) // badges like Night Owl, depending on the hour
  }
  for (let i = 0; i < 4 && !(await page.getByRole('heading', { name: 'Quest complete!' }).count()); i++) await keepGoing(page)
  await page.getByRole('heading', { name: 'Quest complete!' }).waitFor()
  await keepGoing(page)
  await page.getByText('Quest complete! Today is a gold day.').waitFor()
  await page.getByTitle(/6-day streak/).waitFor()
})

await test('Level up: defeating a boss levels you up with a celebration', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await page.getByRole('checkbox', { name: 'Complete Research Paper: Final Draft' }).click()
  await page.getByRole('heading', { name: 'Level up!' }).waitFor()
  await page.getByText('You’re now level 7').waitFor()
  await keepGoing(page)
  // Badges earned by the same action queue up one after another.
  for (let i = 0; i < 4 && !(await page.getByRole('heading', { name: 'Boss Slayer' }).count()); i++) await keepGoing(page)
  await page.getByRole('heading', { name: 'Boss Slayer' }).waitFor()
})

await test('6. Boss stages: open in place, suggest, clear and add stages', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await quest(page, 'asg_math_mid2').getByText('Boss level').waitFor()
  const details = await openQuest(page, 'asg_math_mid2')
  await details.getByRole('button', { name: 'Suggest stages' }).click()
  const d = dialog(page)
  await d.getByLabel('Step 1 title').fill('Collect exam topics from the review sheet')
  await d.getByRole('button', { name: 'Save steps' }).click()
  await details.getByText('Collect exam topics from the review sheet', { exact: true }).waitFor()
  await details.getByRole('checkbox', { name: /^Clear stage 1/ }).click()
  await details.getByText('Stages · 1 / 5').waitFor()
  await details.getByLabel('New stage').fill('Make a formula note card')
  await page.keyboard.press('Enter')
  await details.getByText('Stages · 1 / 6').waitFor()
  assert(page.url() === `${BASE}/`, `navigated away: ${page.url()}`)
})

await test('Pet: pick and name a pet; its mood follows late work', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await page.getByText('Pick your study pet!').waitFor()
  await pickPet(page, 'Axolotl', 'Bubbles Jr')
  await page.getByTestId('pet-mood').getByText('Bubbles Jr is worried').waitFor()
  // Catch up until only one late thing is left: the pet calms down to "okay".
  await page.getByRole('button', { name: 'See all assignments' }).click()
  const lateRows = page.getByTestId('all-assignments').locator('li').filter({ hasText: /Late|Missing/ }).filter({ hasNotText: 'Closed' })
  await lateRows.first().waitFor()
  while ((await lateRows.count()) > 1) {
    await lateRows.first().getByRole('checkbox', { name: /^Complete / }).click()
    await dismissCelebrations(page)
  }
  await page.getByRole('link', { name: 'Today' }).first().click()
  await page.getByTestId('pet-mood').getByText('Bubbles Jr is okay').waitFor()
  await page.reload()
  await page.getByTestId('pet-mood').getByText('Bubbles Jr is okay').waitFor()
  await page.goto(`${BASE}/me`)
  await page.getByRole('button', { name: 'Bubbles Jr, your pet. Tap to say hi.' }).waitFor()
})

await test('Grade guide: clear steps per class, an email to reopen closed work, and how to raise your grade', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  const guide = page.getByRole('region', { name: 'Grade guide' })
  await guide.waitFor()
  // Late work is in the guide, not repeated in a long Late list.
  const lateList = page.getByRole('region', { name: /^Late ·/ })
  if (await lateList.count()) assert(!(await lateList.getByText('Problem Set 7').count()), 'late work listed twice')
  // Calculus: turn in Problem Set 7 before it closes.
  const calc = guide.locator('li').filter({ has: page.getByRole('button', { name: /Calculus III/ }) }).first()
  if ((await calc.getByRole('button', { name: /Calculus III/ }).getAttribute('aria-expanded')) !== 'true') await calc.getByRole('button', { name: /Calculus III/ }).click()
  const steps = calc.getByTestId('class-guide')
  await steps.getByText('Turn this in while you still can').waitFor()
  await steps.getByText(/Closes tomorrow/).waitFor()
  await steps.getByText(/Estimate: about/).waitFor()
  // Psychology: a closed assignment, with an email to ask for it to be reopened.
  const psych = guide.locator('li').filter({ has: page.getByRole('button', { name: /Cognitive Psychology/ }) }).first()
  await psych.getByRole('button', { name: /Cognitive Psychology/ }).click()
  await psych.getByText(/“Reflection Journal 4” is closed on Canvas/).waitFor()
  await psych.getByRole('button', { name: 'Write the email' }).click()
  const d = dialog(page)
  assert((await d.getByLabel('Subject').inputValue()).includes('Reflection Journal 4'), 'email subject')
  assert(/reopen it[\s\S]*Thank you/.test(await d.getByLabel('Message').inputValue()), 'email body')
  await d.getByText('CampusFlow never sends messages for you.', { exact: false }).waitFor()
  await d.getByRole('button', { name: 'Close' }).last().click()
  // The help button at the top of Today.
  await page.getByRole('button', { name: 'How to raise your grade' }).first().click()
  await dialog(page).getByText('Ask to reopen closed work').waitFor()
  await dialog(page).getByRole('button', { name: 'Got it' }).click()
  // Checking work off in the guide removes it.
  await calc.getByRole('button', { name: /Calculus III/ }).click()
  await steps.getByRole('checkbox', { name: 'Complete Problem Set 7: Lagrange Multipliers' }).click()
  await dismissCelebrations(page)
  assert(!(await guide.getByText('Problem Set 7: Lagrange Multipliers').count()), 'finished work still in the guide')
})

await test('Plan: one card at a time (turn in, email, learn, study), Done shows the next, until the plan is complete', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await page.getByRole('link', { name: 'Plan' }).first().click()
  const card = page.getByTestId('plan-card')
  await card.waitFor()
  const total = Number(/of (\d+)/.exec(await page.getByText(/^Step \d+ of \d+$/).innerText())[1])
  assert(total >= 4, `plan too short: ${total}`)
  // "Not now" moves a card to the end of the deck.
  const first = await card.getByRole('heading', { level: 2 }).innerText()
  await card.getByRole('button', { name: 'Not now' }).click()
  await page.waitForTimeout(500)
  assert((await card.getByRole('heading', { level: 2 }).innerText()) !== first, 'Not now did not move on')
  const seen = new Set()
  for (let i = 0; i < 20 && (await card.count()); i++) {
    const label = await card.getAttribute('aria-label')
    seen.add(label.split(':')[0])
    if (label.startsWith('Send an email')) assert(/reopen/.test(await card.getByLabel('Message').inputValue()), 'email card has no draft')
    if (label.startsWith('Learn what you missed')) await card.getByText('Lecture: Working memory models').waitFor()
    if (label.startsWith('Study for a test')) await card.getByRole('checkbox', { name: /^Learned / }).first().waitFor()
    await card.getByRole('button', { name: /I turned it in|I sent it|I learned it|I’m ready/ }).click()
    await dismissCelebrations(page)
    await page.waitForTimeout(300)
  }
  for (const k of ['Turn in', 'Send an email', 'Learn what you missed', 'Study for a test']) assert(seen.has(k), `no ${k} card: ${[...seen]}`)
  await page.getByTestId('plan-empty').getByText('Plan complete!').waitFor()
  // Finished steps stay finished.
  await page.reload()
  await page.getByTestId('plan-empty').waitFor()
})

await test('Old links land on the matching tab', async (page) => {
  await page.goto(`${BASE}/calendar`)
  await ready(page)
  await page.goto(`${BASE}/assignments/asg_cs_mp4`)
  await quest(page, 'asg_cs_mp4').getByTestId('quest-details').waitFor()
  await page.goto(`${BASE}/settings#canvas`)
  await page.waitForURL(/\/me#canvas/)
  await page.getByTestId('canvas-status').waitFor()
  await page.goto(`${BASE}/grades`)
  await page.waitForURL(/\/courses$/)
})

await test('8. Search finds an assignment (Ctrl+K)', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Search' }).fill('flood')
  await page.getByRole('option', { name: /MP4: Flood Fill/ }).waitFor()
  await page.keyboard.press('Enter')
  await quest(page, 'asg_cs_mp4').getByTestId('quest-details').waitFor()
})

await test('10. Late work is identified correctly', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await page.getByRole('button', { name: 'See all assignments' }).click()
  const rows = page.getByTestId('all-assignments').locator('li')
  const ps7 = rows.filter({ hasText: 'Problem Set 7: Lagrange Multipliers' })
  await ps7.getByText('Late', { exact: true }).waitFor()
  await ps7.getByText('+20 XP').waitFor() // half of 40
  for (const title of ['Quiz 7', 'Midterm 2', 'MP4']) assert(!(await rows.filter({ hasText: title }).getByText('Late', { exact: true }).count()), `${title} marked late`)
})

await test('12a. Phone: tabs, quick add with validation, no sideways scroll', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  const tabs = page.getByRole('navigation', { name: 'Tabs' })
  await tabs.getByRole('link', { name: 'Me' }).click()
  await page.waitForURL(/\/me/)
  await page.getByText('Badges ·').waitFor()
  await tabs.getByRole('button', { name: 'Add' }).click()
  await dialog(page).getByRole('button', { name: 'Save' }).click()
  await dialog(page).getByText('Title is required.').waitFor()
  await page.screenshot({ path: join(shots, 'mobile-quick-add.png') })
}, { width: 390, height: 844 })

await test('12b. Phone pages have no horizontal overflow', async (page) => {
  for (const path of ['/', '/?open=asg_engl_paper', '/courses', '/me']) {
    await page.goto(`${BASE}${path}`)
    await page.waitForTimeout(600)
    if (path === '/courses') await page.getByTestId('course-card').first().locator('button[aria-expanded]').click()
    const w = await page.evaluate(() => document.documentElement.scrollWidth)
    assert(w <= 390, `${path} overflows: ${w}px`)
  }
}, { width: 390, height: 844 })

await test('13. Empty workspace starts at level 1 with a clear first step', async (page) => {
  await page.goto(`${BASE}/settings#data`)
  await page.getByRole('button', { name: 'Start empty' }).click()
  await dialog(page).getByRole('button', { name: 'Delete everything' }).click()
  await page.goto(`${BASE}/`)
  await page.getByText('Level 1. Let’s go!').waitFor()
  await page.goto(`${BASE}/courses`)
  await page.getByText('No classes yet').waitFor()
  await page.goto(`${BASE}/does-not-exist`)
  await page.getByText('This page doesn’t exist').waitFor()
})

await test('14. Demo mode is never presented as a Canvas connection', async (page) => {
  await page.goto(`${BASE}/`)
  await page.getByText('Demo data · not connected to Canvas').waitFor()
  await page.goto(`${BASE}/settings#canvas`)
  const status = page.getByTestId('canvas-status')
  await status.getByText('Demo mode — not connected').waitFor()
  assert(!(await status.getByText('Connected', { exact: true }).count()), 'claims a connection')
})

await test('Canvas: the cards check the address and reject a wrong token', async (page) => {
  await page.goto(`${BASE}/connect`)
  await page.getByRole('button', { name: 'Let’s start' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('alert').getByText('Type your school’s Canvas address').waitFor()
  await page.getByRole('button', { name: 'Previous card' }).click()
  await page.getByRole('button', { name: 'Let’s start' }).waitFor()
  await connectThroughCards(page, MOCK, 'definitely-not-a-real-token-123')
  await page.getByRole('alert').getByText('Canvas didn’t accept that token').waitFor()
}, undefined, { allowNetworkErrors: true, fresh: true }) // the browser logs the server's intended 401

await test('Canvas: connect with an access token, import classes, and sync on Today', async (page) => {
  await page.goto(`${BASE}/`)
  await page.getByRole('heading', { name: 'Connect your Canvas' }).waitFor()
  assert(!(await page.getByRole('button', { name: /Sign in with Canvas/ }).count()), 'OAuth option still shown')
  await connectThroughCards(page, MOCK, MOCK_TOKEN)
  const done = page.getByTestId('connect-done')
  await done.getByText('You’re connected, Jordan!').waitFor()
  await page.waitForTimeout(900)
  assert((await done.innerText()).includes('3') && (await done.innerText()).includes('6'), `unexpected counts: ${await done.innerText()}`)
  await page.getByRole('button', { name: 'Let’s go' }).click()
  await ready(page)
  await page.getByText('Homework 6: Eigenvalues').waitFor()
  await page.getByText(/Synced with Canvas/).waitFor()
  assert(!(await page.getByText('Calculus III').count()), 'demo data still present')
  // The late discussion is closed on Canvas: the Grade guide suggests asking the teacher to reopen it.
  const guide = page.getByRole('region', { name: 'Grade guide' })
  const soc = guide.locator('li').filter({ has: page.getByRole('button', { name: /Intro to Sociology/ }) }).first()
  if ((await soc.getByRole('button', { name: /Intro to Sociology/ }).getAttribute('aria-expanded')) !== 'true') await soc.getByRole('button', { name: /Intro to Sociology/ }).click()
  await soc.getByText(/“Discussion: Social Norms” is closed on Canvas/).waitFor()
  await soc.getByRole('button', { name: 'Write the email' }).waitFor()
  // Submitting on Canvas earns XP on the next sync.
  const before = await xp(page)
  await fetch(`${MOCK}/__test/submit/9101`, { method: 'POST' })
  await page.getByRole('button', { name: 'Sync with Canvas now' }).click()
  await page.getByText(/you submitted on Canvas/).waitFor()
  await page.waitForFunction((b) => Number(document.getElementById('xp-target')?.innerText.replace(/[^\d]/g, '')) > b, before, { timeout: 5000 })
  // Reload: still connected via the server session.
  await page.reload()
  await ready(page)
  await page.getByText(/Synced with Canvas/).waitFor()
  await page.goto(`${BASE}/connect`)
  await page.getByTestId('connect-connected').getByText('Connected as Jordan Rivera').waitFor()
  // Disconnect.
  await page.goto(`${BASE}/settings#canvas`)
  await page.getByTestId('canvas-status').getByRole('button', { name: 'Disconnect' }).click()
  await dialog(page).getByRole('button', { name: 'Disconnect' }).click()
  await page.getByTestId('canvas-status').getByText('Not connected').waitFor()
  const status = await page.evaluate(() => fetch('/api/canvas/status').then((r) => r.json()))
  assert(status.state === 'signed_out', `server still signed in: ${JSON.stringify(status)}`)
}, undefined, { fresh: true })

await test('Skip: an assignment leaves CampusFlow, Undo brings it back, and Settings can restore it', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await quest(page, 'asg_cs_lab9').waitFor()
  await page.getByRole('button', { name: 'Skip Lab 9: Heaps' }).click()
  await quest(page, 'asg_cs_lab9').waitFor({ state: 'detached' })
  await page.getByText(/Skipped “Lab 9: Heaps”. It’s still on Canvas./).waitFor()
  await page.getByRole('button', { name: 'Undo' }).click()
  await quest(page, 'asg_cs_lab9').waitFor()
  // Skip again from inside the opened quest, then it stays gone after a reload.
  const details = await openQuest(page, 'asg_cs_lab9')
  await details.getByRole('button', { name: 'Skip', exact: true }).click()
  await quest(page, 'asg_cs_lab9').waitFor({ state: 'detached' })
  await page.reload()
  await ready(page)
  assert(!(await page.getByText('Lab 9: Heaps').count()), 'skipped assignment came back after reload')
  await page.goto(`${BASE}/me#data`)
  const list = page.getByRole('region', { name: 'Skipped assignments' })
  await list.getByText('Lab 9: Heaps').waitFor()
  await list.getByRole('button', { name: 'Restore' }).click()
  await page.goto(`${BASE}/`)
  await quest(page, 'asg_cs_lab9').waitFor()
})

await test('Skip: a skipped Canvas assignment stays out after syncing again', async (page) => {
  await page.goto(`${BASE}/`)
  await connectThroughCards(page, MOCK, MOCK_TOKEN)
  await page.getByRole('button', { name: 'Let’s go' }).click()
  await ready(page)
  await page.getByRole('button', { name: 'Skip Lab Report 3: Distillation' }).click()
  await page.getByText('Lab Report 3: Distillation').first().waitFor({ state: 'detached' }).catch(() => {})
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Sync with Canvas now' }).click()
  await page.getByText(/Synced with Canvas just now/).waitFor()
  await page.waitForTimeout(500)
  assert(!(await page.locator('[id^="quest-"]').filter({ hasText: 'Lab Report 3' }).count()), 'skipped Canvas assignment came back after sync')
}, undefined, { fresh: true })

await test('Family: a parent links with a code, sees everything in plain words, and is told when sharing stops', async (page) => {
  await page.goto(`${BASE}/`)
  await connectThroughCards(page, MOCK, MOCK_TOKEN)
  await page.getByRole('button', { name: 'Let’s go' }).click()
  await ready(page)
  await page.goto(`${BASE}/me#family`)
  await page.getByRole('button', { name: 'Add a parent' }).click()
  const code = ((await page.getByTestId('family-code').locator('p').nth(1).innerText()) || '').replace(/\D/g, '')
  assert(/^\d{6}$/.test(code), `no code: ${code}`)

  // The parent, on their own phone (a separate browser with no Canvas).
  const parentCtx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const parent = await parentCtx.newPage()
  parent.on('pageerror', (e) => consoleErrors.push(`family parent: ${e}`))
  await parent.goto(`${BASE}/parent?code=${code}`)
  await parent.getByLabel('Your name (like Mom, Dad, Abuela)').fill('Mom')
  await parent.getByRole('button', { name: 'Link to my student' }).click()

  // The student sees Mom linked, and their app shares its data.
  await page.getByRole('region', { name: 'Shared with' }).getByText('Mom').waitFor()
  for (let i = 0; i < 10 && !(await parent.getByTestId('parent-view').count()); i++) {
    await parent.waitForTimeout(1500)
    await parent.reload()
  }
  const view = parent.getByTestId('parent-view')
  await view.getByText('Jordan’s week').waitFor()
  await view.getByRole('region', { name: 'Needs attention' }).getByText('Discussion: Social Norms').waitFor()
  await view.getByRole('region', { name: 'Coming up' }).getByText('Homework 6: Eigenvalues').waitFor()
  await view.getByRole('tab', { name: 'Classes' }).click()
  await view.getByRole('button', { name: /Linear Algebra/ }).click()
  await view.getByText('Homework 5: Determinants').waitFor()
  await view.getByText('18 / 20', { exact: false }).waitFor()
  await view.getByText('Midterm review session Thursday').waitFor()

  // The weekly guide: one card at a time, until done. The student is told.
  await view.getByRole('tab', { name: 'Guide' }).click()
  const guide = parent.getByTestId('parent-guide')
  await guide.getByTestId('parent-guide-card').first().getByText('Start with the good').waitFor()
  await parent.screenshot({ path: join(shots, 'family-guide-good.png'), fullPage: true })
  let sawFocus = false
  for (let i = 0; i < 15 && !(await guide.getByTestId('parent-guide-done').count()); i++) {
    const card = guide.getByTestId('parent-guide-card')
    await card.waitFor()
    if (!sawFocus && (await card.getByTestId('try-saying').count())) {
      sawFocus = true
      const before = await card.getByTestId('try-saying').innerText()
      await card.getByRole('button', { name: 'Different words' }).click()
      await parent.waitForTimeout(400)
      assert((await card.getByTestId('try-saying').innerText()) !== before, 'Different words did not change the line')
      await parent.screenshot({ path: join(shots, 'family-guide-talk.png'), fullPage: true })
    }
    await card.getByRole('button', { name: 'Got it, next' }).click()
    // Wait for the old card to fly away before reading the next one.
    await parent.waitForFunction(() => document.querySelectorAll('[data-testid=parent-guide-card]').length <= 1)
    await parent.waitForTimeout(300)
  }
  assert(sawFocus, 'no “what matters” card with words to say')
  await guide.getByText('You’re done for this week 💚').waitFor()
  await page.reload()
  await page.getByRole('region', { name: 'Shared with' }).getByTestId('guide-done-note').waitFor()

  // Settings: the parent picks Portuguese.
  await parent.getByRole('button', { name: 'Settings' }).click()
  await dialog(parent).getByRole('radio', { name: 'Português' }).click()
  await dialog(parent).getByRole('button', { name: 'Pronto' }).click()
  await parent.getByRole('tab', { name: 'Aulas' }).waitFor()
  await parent.getByRole('tab', { name: 'Guia' }).waitFor()
  assert((await parent.evaluate(() => document.documentElement.scrollWidth)) <= 390, 'parent view overflows on a phone')
  await parent.screenshot({ path: join(shots, 'family-parent.png'), fullPage: true })

  // The student stops sharing; the parent is told.
  await page.getByRole('region', { name: 'Shared with' }).getByRole('button', { name: 'Remove' }).click()
  await dialog(page).getByRole('button', { name: 'Stop sharing' }).click()
  await parent.reload()
  await parent.getByText('Jordan parou de compartilhar.').waitFor()
  await parentCtx.close()
}, undefined, { fresh: true })

await test('Canvas: without the server, the page says so instead of pretending', async (page) => {
  await page.route('**/api/**', (r) => r.abort())
  await page.goto(`${BASE}/connect`)
  await page.getByText('Preview: practice run, can’t connect').waitFor()
  await connectThroughCards(page, 'canvas.example.edu', MOCK_TOKEN)
  await page.getByTestId('connect-preview').getByText('You did everything right!').waitFor()
  await page.getByRole('button', { name: 'Try the demo instead' }).click()
  await page.getByTestId('day-summary').waitFor()
}, undefined, { allowNetworkErrors: true, fresh: true })

await test('First launch opens on the sign-in screen, and the choice is remembered', async (page) => {
  await page.goto(`${BASE}/calendar`)
  await page.waitForURL(/\/connect$/)
  await page.getByRole('heading', { name: 'Connect your Canvas' }).waitFor()
  assert(!(await page.getByRole('navigation', { name: 'Main' }).count()), 'app menus shown on the sign-in screen')
  await page.getByRole('button', { name: /Just looking\? Try the demo instead/ }).click()
  await page.getByTestId('day-summary').waitFor()
  await page.reload()
  await page.getByTestId('day-summary').waitFor()
  await page.goto(`${BASE}/connect`)
  await page.getByRole('heading', { name: 'Connect Canvas', exact: true }).waitFor()
  await page.getByRole('navigation', { name: 'Main' }).waitFor()
}, undefined, { fresh: true })

await test('15. Single-key shortcuts do not fire while typing', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  const details = await openQuest(page, 'asg_engl_paper')
  await details.getByLabel('New stage').fill('calc')
  assert(!(await dialog(page).count()), 'typing "c" opened quick add')
  await page.locator('h1').click()
  await page.keyboard.press('c')
  await dialog(page).getByRole('heading', { name: 'Add' }).waitFor()
})

await test('Language: Español and Português everywhere, remembered after reload', async (page) => {
  await page.goto(`${BASE}/me#language`)
  await page.getByRole('radio', { name: 'Español' }).click()
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Hoy' }).waitFor()
  await page.getByRole('heading', { name: 'Ajustes' }).waitFor()
  await page.reload()
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Hoy' }).click()
  await page.getByRole('region', { name: 'Guía de notas' }).waitFor()
  assert((await page.evaluate(() => document.documentElement.lang)) === 'es', 'html lang not set')
  await page.screenshot({ path: join(shots, 'lang-es-today.png') })
  await page.getByRole('link', { name: 'Plan' }).first().click()
  await page.getByRole('heading', { name: 'Tu plan' }).waitFor()
  await page.goto(`${BASE}/me#language`)
  await page.getByRole('radio', { name: 'Português' }).click()
  await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Hoje' }).click()
  await page.getByText(/Bom dia|Boa tarde|Boa noite|Trabalhando até tarde/).first().waitFor()
  await page.screenshot({ path: join(shots, 'lang-pt-today.png') })
  await page.goto(`${BASE}/me#language`)
  await page.getByRole('radio', { name: 'English' }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' }).waitFor()
})

await test('Dark theme renders without errors', async (page) => {
  await page.goto(`${BASE}/settings`)
  await page.getByRole('radio', { name: 'Dark' }).click()
  await page.goto(`${BASE}/`)
  await ready(page)
  assert((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'theme not applied')
  await page.screenshot({ path: join(shots, 'dark-today.png') })
})

await browser.close()
server.kill()
mock.close()

const failed = results.filter((r) => !r.ok)
if (consoleErrors.length) console.log(`\nConsole errors (${consoleErrors.length}):\n  ${consoleErrors.join('\n  ')}`)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length || consoleErrors.length ? 1 : 0)
