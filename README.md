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

- **Dashboard**: a greeting with counts calculated from your data and a "what to work on next"
  pick, with the reasons it was chosen. Also a prioritized *Today* list (overdue, due today,
  planned for today), upcoming deadlines grouped by when they're due, course rows that show what
  needs attention, a 7- or 14-day workload chart that flags overloaded days, and important
  announcements.
- **Courses**: filter by active, completed or archived. Each course gets the same layout, however
  its instructor set up Canvas: Overview (description, upcoming work, announcements you can star or
  mark read, quick links), Modules (expand or collapse, per-item completion, typed items, add your
  own), Assignments (sort, show completed) and Resources. You can change the color and icon, hide
  a course or archive it.
- **Assignments**: list view grouped by deadline, or a board view where you drag cards (or change
  status from the keyboard). Filter by course or status, search, and sort. Full create, edit and
  delete with confirmation. The detail page is a workspace with requirements, submission
  instructions, rubric notes, a checklist (inline add, rename, reorder, plan a day per step),
  personal notes that autosave, linked resources and notes, study sessions, and time remaining
  against your estimate.
- **Planner**: day and week views. Drag tasks between days or into the unscheduled tray. Each day
  shows how full it is and warns when it's overloaded. "Big assignments without a plan" lead into
  **Break into steps**: a rule-based breakdown by assignment type, spread across the days before the
  deadline, where you edit every step before saving.
- **Calendar**: month, week and day views, filtered by course. Shows deadlines, exams, study
  sessions, events, reminders and (optionally) planned tasks, with overdue and completed marked
  clearly. Drag sessions and events to new times; double-click empty time to add a session. When
  Canvas lists an assignment as a calendar event too, it's shown only once.
- **Study Tasks**: to-dos and assignment steps, grouped by the day you planned them.
- **Grades & Progress**: estimated current grade, either weighted by syllabus categories or by
  total points, with the assumptions written out. Also a target-grade calculator, a trend chart,
  missing work, work awaiting a grade, and manual grade entry. Every grade is labeled *Canvas*,
  *Entered by you* or *Demo*.
- **Notes & Resources**: a notes editor that autosaves, with light Markdown, a preview and `#tags`,
  linked to a course, module, assignment or study task. A resource library holds links, references
  and files (validated: PDF, image, text, Word or PowerPoint, up to 5 MB, stored in IndexedDB), with
  favorites, tags and search.
- **Everywhere**:
  - `Ctrl/⌘ K` command palette, which searches courses, assignments, tasks, notes and resources
  - Quick add (`C`) for assignments, tasks, study sessions, reminders, events and notes
  - A focus timer (`F`) that logs finished sessions to the calendar
  - Notifications built from your deadlines, reminders and starred announcements
  - Toasts with Undo, light and dark themes, a compact sidebar, and a mobile drawer plus bottom
    navigation

Single-key shortcuts never fire while you're typing in a field.

## Honesty rules the app follows

- **Your status is not Canvas.** *Completed* and *Submitted (self-reported)* are personal
  tracking. Every assignment shows its Canvas submission state separately. That state is
  *Unknown — not synced with Canvas* unless a real sync reported it. Nothing is ever submitted to
  Canvas.
- **Demo data is labeled as demo.** A banner appears on the dashboard and the Settings status
  reads *Demo mode — not connected*. Demo submission states and grades carry a *Demo* label.
- **Rule-based means rule-based.** "What to work on next" and "Break into steps" explain the rules
  they use and are never called AI. Your available study time is used only if you enter it in
  Settings.
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
- is lost when site data is cleared (Settings → *Export JSON backup*),
- is limited to roughly 5 MB for structured data.

If saving fails, the app shows a toast and doesn't crash. Settings → *Data & storage* can reset the
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
