# CampusFlow

A student command center for Canvas courses. It answers five questions the moment you open it:
what's due today, what's coming up, which courses need attention, where you're falling behind,
and what to work on next.

It runs fully on its own with demo data or data you enter yourself. Connect Canvas from inside the app to import your classes and assignments automatically (read-only, through a small server that keeps your credentials off the browser).

## Quick start

```bash
npm install
npm run dev            # app on http://localhost:5173
npm run dev:server     # optional: Canvas integration server on :8787 (Vite proxies /api to it)
```

Production build, served together with the API:

```bash
npm run build
npm start              # http://localhost:8787
```

Requires Node 22.18 or newer, because the server is TypeScript run directly by Node with no build
step.

| Script | What it does |
| --- | --- |
| `npm run typecheck` | `tsc -b` over the app and the server |
| `npm run lint` | ESLint (TypeScript + React hooks rules) |
| `npm test` | Vitest unit tests for domain logic and Canvas mapping/merge |
| `npm run test:e2e` | Playwright acceptance tests against the production build (run `npm run build` first) |

## What's in it

Three tabs. Nothing opens a separate page: tapping something opens it right where it is.

- **Today**: your study pet, the daily quest (hearts), and everything to do, sorted into Late,
  Today, This week and Later. Tap a quest to open it in place: due date, description, stages you
  can check off for XP, a 25-minute focus timer, Edit, and Open in Canvas.
- **Grade guide**: on Today, one row per class that needs something, opening into clear steps:
  turn in the late or closing-soon work Canvas still accepts (most valuable first), ask the teacher
  to reopen closed work (with a ready-to-edit email the student sends themselves), and focus on a heavy
  category that's low. Includes an estimate of what turning work in could do to the grade, and a
  "How to raise your grade" help button. Rule-based; CampusFlow never contacts teachers.
- **Study pet**: each student picks one of five pets (dragon, cat, bunny, fox, axolotl) and names
  it. It grows with your level (egg → baby → kid → teen → grown up → legend), shows your mood
  (happy, okay with 1 late, worried with 2+ late that can still be turned in, sleepy after 2 quiet days), jumps when XP lands,
  and never dies.
- **Courses**: one card per class. Tap it to see your grade, what missing work could cost you,
  what's due next, the latest announcement, and Open in Canvas.
- **Me**: your pet, level, streak, badges, and all settings on the same page.
- **Game feel**: XP, levels, streaks, badges, confetti, and synthesized sound effects for clicks,
  tabs, opening cards, adding things, XP landing, the pet, focus timers and celebrations (turn
  them off in Me → Settings).
- `Ctrl/⌘ K` searches everything; `C` adds an assignment or to-do; `F` starts a focus session.
  Single-key shortcuts never fire while you're typing.

## Honesty rules the app follows

- **Your status is not Canvas.** *Completed* and *Submitted (self-reported)* are personal
  tracking. Every assignment shows its Canvas submission state separately. That state is
  *Unknown — not synced with Canvas* unless a real sync reported it. Nothing is ever submitted to
  Canvas.
- **Demo data is labeled as demo.** A banner appears on the dashboard and the Settings status
  reads *Demo mode — not connected*. Demo submission states and grades carry a *Demo* label.
- **Rule-based means rule-based.** The Grade guide and "Suggest stages" explain the rules they
  use and are never called AI.
- **No invented grades.** If there's nothing graded, the app shows *Not enough data*.

## Architecture

```
src/
  domain/          Pure business logic + types (no React): dates, assignments, recommend,
                   workload, breakdown, grades, calendar (merge + dedupe), search, notifications
  data/demo.ts     Demo dataset, generated relative to "now" so deadlines always look live
  store/           Zustand store persisted to localStorage (appStore), UI state (ui), IndexedDB files
  integrations/
    canvas/        Adapter interface, raw Canvas API types, pure mapper, merge policy
    ai/            PlanningAssistant extension point (rule-based implementation today)
  components/      Design-system primitives (ui/), layout shell, forms, overlays, rows, chart
  pages/           One file per route; pages other than the dashboard load lazily
server/            Dependency-free Node server: read-only Canvas proxy + static hosting
e2e/run.mjs        Acceptance tests (Playwright)
```

**Design system.** All styling comes from tokens in `src/styles/index.css`: surfaces, lines, the
text scale, an indigo accent, amber for due soon, red for overdue or urgent, green for done, course
colors and chart colors. Light and dark themes are both defined there. Tailwind utilities map to
those tokens (`bg-surface`, `text-fg-2`, `border-line`, `bg-accent-soft`). Icons are
`lucide-react`. The workload chart's two series colors passed the dataviz palette validator
(lightness band, chroma, colorblind separation, contrast) in both themes. Overloaded days get an
icon and a label, and every chart has a table view.

**Data model.** See `src/domain/types.ts`. Every record has a stable `id` and a `source` (`canvas`,
`demo` or `manual`). Moments in time, such as due dates, are stored as UTC ISO strings and shown in
your local time zone. Days with no time attached, such as the day a task is planned for, are local
`yyyy-MM-dd` strings, and date input is always parsed in an explicit format. Assignment checklist
steps are `StudyTask`s with an `assignmentId`, so they show up in the planner, the Study Tasks page
and recommendations without duplicate data.

**Persistence.** Data lives in `localStorage` under the key `campusflow:v1`, and file attachments
live in IndexedDB. This is a single-user prototype, so data:
- stays in one browser and isn't synced between devices,
- is lost when site data is cleared (Me → Settings → *Download a backup*),
- is limited to roughly 5 MB for structured data.

If saving fails, the app shows a toast and doesn't crash. Me → Settings → *Your data* can reset the
demo data or start an empty workspace. No secrets are ever stored on the client.

## Connecting Canvas

Students connect from the app with a **personal access token**, never a password. CampusFlow opens on a short deck of sign-in cards: school address → open Canvas settings (direct link) → make a token (**Account → Settings → + New Access Token**) → paste it. Some schools disable personal tokens; in that case CampusFlow can still be used with manually added work.

Once connected, CampusFlow syncs on open, every 30 minutes, and when you return to the tab, plus a **Sync** button on Today. Classes, assignments (with due dates and your Canvas submission state), modules, announcements, calendar events and grades come in. Anything submitted on Canvas *after connecting* earns XP on the next sync. Your own fields (colors, priority, estimates, stages, notes, XP) are never overwritten.

**Why a server is needed.** Canvas doesn't allow web pages to call its API directly, and a token must not live in the browser. The CampusFlow server (`server/`) holds credentials and only makes read-only GET requests.

**Security**
- The browser only gets a random session id in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` over https). Tokens are stored server-side, encrypted with AES-256-GCM (`.data/`, keyed by `SESSION_SECRET` or a generated key file with 0600 permissions). Session ids are stored hashed.
- State-changing requests require JSON plus a custom header, which cross-site forms can't send (CSRF protection).
- The school address a student types is checked: https only, and hosts that resolve to private or local networks are refused (prevents the server being used to reach internal machines). `CANVAS_ALLOWED_HOSTS` can restrict it further.
- Sign-in attempts are rate limited. Tokens are never logged or put in URLs.
- Pagination links are only followed on the same Canvas host.

**Testing without a school account.** `node e2e/mock-canvas.mjs` runs a fake Canvas on port 8898 (token: `mock-canvas-token-0123456789`). Start the server with `CANVAS_ALLOW_INSECURE=1` to allow its http address. The end-to-end suite uses it for token sign-in, wrong tokens, sync, XP for new submissions, and disconnect.

> Not yet verified against a live school Canvas instance from this environment; the client follows the official REST API and is tested against Canvas-shaped responses.

## Putting it online

`render.yaml` sets CampusFlow up as one website for everyone on [Render](https://render.com)
(free plan): New → Blueprint → pick the repository, then enter your school's Canvas address for
`CANVAS_ALLOWED_HOSTS` (for example `myschool.instructure.com`). The blueprint turns on:

- `SESSION_STORE=cookie` with a generated `SESSION_SECRET`: each student's session is sealed in
  their own HttpOnly cookie, so free servers going to sleep or restarting doesn't sign anyone out,
  and no tokens are written to the server's disk.
- `TRUST_PROXY=1` so rate limits apply per visitor, and `COOKIE_SECURE=1`.

Never set `CANVAS_ACCESS_TOKEN` on a shared server; it would give everyone the same account.
Free Render servers sleep after about 15 minutes without visitors and take up to a minute to wake.

## Family sharing

Parents follow their student's school year without a Canvas account: the student opens
**Me → Family → Add a parent** and gets a 6-digit code (one use, 15 minutes) and a QR code; the parent
opens `/parent` (or taps "I'm a parent" on the welcome card), types the code and their name.

- Parents see everything CampusFlow shows: every assignment (skipped ones are labeled), grades with
  how each class is weighted, teacher announcements, streak and level. Private notes are never shared.
  English and Spanish.
- The student always sees who's linked and when they last looked, and can remove anyone; the parent is
  then told sharing stopped. A parent can unlink their own phone.
- The student's app uploads a snapshot a few seconds after anything changes. Snapshots are only kept
  while at least one parent is linked.
- Parent devices get a random token in an HttpOnly cookie; only its hash is stored. Codes are stored
  hashed and rate limited.
- Storage (`server/kv.ts`): Postgres when `DATABASE_URL` is set (e.g. a free Neon database), otherwise a
  file in `DATA_DIR`. Every value is sealed with AES-256-GCM before it's stored, so the database only
  holds ciphertext.

## Optional AI assistant

No AI service is configured. `src/integrations/ai/assistant.ts` defines a `PlanningAssistant`
interface. The `ruleBasedAssistant` implementation powers *Break into steps* today and also reports
missing information, such as no due date, estimate, rubric or instructions.

An AI implementation should:
- call the model from `server/`, never with an API key in the browser,
- check the stored `prefs.aiConsent` opt-in before sending any assignment text,
- return suggestions the student reviews in the existing breakdown dialog.

## Known limitations

- Reminders appear in the in-app notifications and on the calendar. There are no browser push
  notifications.
- There's no multi-user accounts or server-side storage. Adding them requires authentication and
  checks that each user can only reach their own records.
- There's no recurring events and no import from external calendars (ICS).
