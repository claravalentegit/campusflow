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

const xp = async (page) => Number((await page.locator('#xp-target').innerText()).replace(/[^\d]/g, ''))
const ready = (page) => page.getByTestId('day-summary').waitFor()
const keepGoing = async (page) => {
  await page.getByRole('button', { name: /Keep going|Nice!/ }).first().waitFor()
  await page.waitForTimeout(900) // let the entrance animation settle
  await page.getByRole('button', { name: /Keep going|Nice!/ }).last().click()
  await page.waitForTimeout(400)
}

await test('1. Add a class and open its page', async (page) => {
  await page.goto(`${BASE}/courses`)
  await page.getByRole('button', { name: 'Add class' }).first().click()
  await dialog(page).getByLabel('Course name').fill('Organic Chemistry')
  await dialog(page).getByLabel('Code', { exact: true }).fill('CHEM 232')
  await dialog(page).getByRole('button', { name: 'Add class' }).click()
  await page.waitForURL(/\/courses\/crs_/)
  await page.getByRole('heading', { level: 1, name: 'Organic Chemistry' }).waitFor()
  await page.reload()
  await page.getByRole('heading', { level: 1, name: 'Organic Chemistry' }).waitFor()
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
  await page.waitForURL(/\/assignments\/asg_/)
  await page.getByText('5:00 PM').first().waitFor()
  await page.getByRole('button', { name: 'Edit details' }).click()
  await dialog(page).getByLabel('Title').fill('Enzyme mechanisms worksheet')
  await dialog(page).getByRole('button', { name: 'Save changes' }).click()
  await page.reload()
  await page.getByRole('heading', { level: 1, name: 'Enzyme mechanisms worksheet' }).waitFor()
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
  await page.goto(`${BASE}/assignments/asg_psyc_quiz7`)
  await page.getByRole('button', { name: 'Reopen' }).click()
  await page.waitForFunction((b) => Number(document.getElementById('xp-target')?.innerText.replace(/[^\d]/g, '')) === b, before, { timeout: 5000 })
})

await test('11. Personal completion is never shown as a Canvas submission', async (page) => {
  await page.goto(`${BASE}/assignments/asg_psyc_quiz7`)
  await page.getByRole('button', { name: /Complete · \+/ }).click()
  const text = await page.getByTestId('submission-notice').textContent()
  assert(text.includes('does not submit anything to Canvas'), 'missing personal-vs-Canvas notice')
  assert(text.includes('Unknown — not synced with Canvas'), 'Canvas state should be unknown')
  assert(!/Submitted on Canvas/.test(text), 'falsely claims a Canvas submission')
})

await test('Daily quest: 3 completions make a gold day, celebrate, and extend the streak', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  for (const name of ['Complete Create an outline and thesis', 'Complete Email Prof. Reyes about midterm room conflict', 'Complete Make flashcards for chapters 6–7']) {
    await page.getByRole('checkbox', { name }).click()
    await page.waitForTimeout(250)
  }
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

await test('6. Boss stages: suggest, clear and add stages', async (page) => {
  await page.goto(`${BASE}/assignments/asg_math_mid2`)
  await page.getByText('BOSS LEVEL', { exact: false }).first().waitFor()
  await page.getByRole('button', { name: 'Suggest stages' }).first().click()
  const d = dialog(page)
  await d.getByLabel('Step 1 title').fill('Collect exam topics from the review sheet')
  await d.getByRole('button', { name: 'Save steps' }).click()
  await page.getByRole('button', { name: 'Collect exam topics from the review sheet', exact: true }).waitFor()
  await page.getByRole('button', { name: /^Clear stage 1/ }).click()
  await page.getByText('1 / 5 stages').waitFor()
  await page.getByLabel('New stage').fill('Make a formula note card')
  await page.keyboard.press('Enter')
  await page.getByText('1 / 6 stages').waitFor()
})

await test('7. Add study time and see it on the calendar', async (page) => {
  await page.goto(`${BASE}/calendar?date=${isoDay(2)}`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.keyboard.press('c')
  const d = dialog(page)
  await d.getByRole('radio', { name: 'Study time' }).click()
  await d.getByLabel('What will you study?').fill('Organic chem flashcards')
  await d.getByLabel('Date').fill(isoDay(2))
  await d.getByLabel('Start').fill('14:00')
  await d.getByLabel('End').fill('15:30')
  await d.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: /Organic chem flashcards/ }).waitFor()
})

await test('8. Search finds an assignment (Ctrl+K)', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Search' }).fill('flood')
  await page.getByRole('option', { name: /MP4: Flood Fill/ }).waitFor()
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/assignments\/asg_cs_mp4/)
})

await test('10. Late work is identified correctly', async (page) => {
  await page.goto(`${BASE}/`)
  await ready(page)
  const late = page.getByRole('region', { name: /^Late ·/ })
  await late.getByText('Problem Set 7: Lagrange Multipliers').waitFor()
  const text = await late.innerText()
  assert(!/Quiz 7|Midterm|MP4/.test(text), `future work listed as late: ${text}`)
  await late.getByText('+20 XP').waitFor() // half of 40
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
  for (const path of ['/', '/courses', '/courses/crs_engl102', '/assignments/asg_engl_paper', '/calendar', '/me', '/grades', '/settings']) {
    await page.goto(`${BASE}${path}`)
    await page.waitForTimeout(600)
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
  await page.goto(`${BASE}/assignments/does-not-exist`)
  await page.getByText('This assignment doesn’t exist').waitFor()
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
  const late = page.getByRole('region', { name: /^Late ·/ })
  await late.getByText('Discussion: Social Norms').waitFor()
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

await test('Canvas: without the server, the page says so instead of pretending', async (page) => {
  await page.route('**/api/**', (r) => r.abort())
  await page.goto(`${BASE}/connect`)
  await page.getByText('Preview: practice run, can’t connect').waitFor()
  await connectThroughCards(page, 'canvas.example.edu', MOCK_TOKEN)
  await page.getByTestId('connect-preview').getByText('You did everything right!').waitFor()
  await page.getByRole('button', { name: 'Try the demo instead for now' }).click()
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
  await page.goto(`${BASE}/assignments/asg_engl_paper`)
  await page.getByLabel('New stage').fill('calc')
  assert(!(await dialog(page).count()), 'typing "c" opened quick add')
  await page.locator('h1').click()
  await page.keyboard.press('c')
  await dialog(page).getByRole('heading', { name: 'Add' }).waitFor()
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
