# Gym Tracker: Plan

A single-user workout tracker, installable on iPhone as a PWA. Data stays on the device only: no backend, no accounts, no paid services. It covers fitness only.

---

## 1. Stack and technical decisions

| Area | Choice | Why |
|---|---|---|
| Build | Vite + React + TypeScript | As specified |
| PWA | vite-plugin-pwa (Workbox `generateSW`) | Precaches the whole app so it works offline. Generates the manifest. iOS meta tags go in `index.html`. |
| Storage | Dexie 4 + `dexie-react-hooks` (`useLiveQuery`) | Screens re-render on their own when data changes, and every edit autosaves |
| Routing | `react-router` with **HashRouter** | Works on GitHub Pages and on Vercel with no server rewrites. Behaves reliably in iOS standalone mode. |
| Build paths | Relative `base: './'` | The same build runs on either host, so the hosting choice can wait until deploy time |
| UI | Hand-written CSS with tokens. No UI library. | Keeps the app small and holds the design to exactly the specified colours |
| Charts (Phase 2) | Recharts, or uPlot if bundle size becomes a concern | Decided at the start of Phase 2 |
| Tests | Vitest + `fake-indexeddb`; `npm run check:offline` (playwright-core driving the Mac's installed Chrome) | Unit tests for the logic: prefill lookup, durations, week totals, CSV, backup round-trip. The offline check proves the built app loads with the server stopped. |
| IDs | `crypto.randomUUID()` with a small fallback | The fallback covers plain `http://` over Wi-Fi testing, where `randomUUID` doesn't exist |

**First run:** call `navigator.storage.persist()`, then seed the database once.

**Design tokens** (no other colours will be used):
- `--bg #0A0A0A`, `--card #161616`, `--accent #FB923C`, `--text #F5F5F4` (my pick for "off-white")
- Muted text, borders and ghost values use off-white at reduced opacity, not a new colour.
- Delete actions use a confirm step rather than red.
- Fonts are the system font (SF Pro on iPhone) with tabular numerals, so numbers line up. Workout numbers are large.
- Inputs are at least 16 px so iOS doesn't zoom in on them.
- Tap targets are at least 48 px.
- Weight fields use `inputmode="decimal"` and reps fields use `inputmode="numeric"`.
- Layout respects the iPhone safe areas (notch and home bar). Content is centred with a 480 px maximum width.

---

## 2. Data model

There are four Dexie tables. A **session is one document**: its exercises and sets are stored inside it. That keeps autosave, editing, deleting and backup simple, and the data stays small for a single user.

```ts
type ExerciseType = 'compound' | 'isolation' | 'core';
type WarmupPolicy = 'full' | 'one' | 'zeroToOne' | 'none';
// Labels: "Full warm-up" | "1 warm-up set" | "0–1 warm-up sets" | "No warm-up"

interface Exercise {
  id: string;
  name: string;            // display name
  nameKey: string;         // trimmed + lower-cased; unique so names can't duplicate
  perHand: boolean;        // weight entered is per dumbbell
  bodyweight: boolean;     // weight = added load; 0 = bodyweight only
  weightStep: number;      // kg, default 2.5, used by the +/- steppers
  type: ExerciseType;
  createdAt: number;
}

interface TemplateSlot {
  id: string;
  exerciseId: string;      // default exercise
  alternativeIds: string[];
  targetSets: number;
  repMin: number;
  repMax: number;
  warmup: WarmupPolicy;
  planNote: string;
}

interface Template {
  id: string;
  name: string;
  slots: TemplateSlot[];   // in order
  order: number;           // position in the template list
  createdAt: number;
  updatedAt: number;
}

interface WorkoutSet {
  id: string;
  weight: number | null;   // kg (per hand if perHand; added load if bodyweight)
  reps: number | null;
  warmup: boolean;
  note: string;
  loggedAt: number;        // when the set was created; used to suggest the end time
}

interface SessionExercise {
  id: string;
  exerciseId: string;            // the exercise actually done (after any swap)
  slot: TemplateSlot | null;     // SNAPSHOT of the slot when the session started; null if added ad hoc
  note: string;                  // per-exercise note
  sets: WorkoutSet[];            // in order
}

interface Session {
  id: string;
  templateId: string | null;
  templateName: string | null;   // snapshot; null = blank session
  status: 'active' | 'finished';
  startedAt: number;             // epoch ms (local date is derived from this)
  endedAt: number | null;
  note: string;                  // whole-session note
  exercises: SessionExercise[];  // in order
  exerciseIds: string[];         // derived; indexed for "last time I did X"
  updatedAt: number;
}

interface Settings {             // single row, id 'app'
  id: 'app';
  rest: { warmup: string; compound: string; isolation: string; core: string };
  lastBackupAt: number | null;
  seededAt: number | null;
}
```

**Dexie schema v1**
```
exercises: 'id, &nameKey'
templates: 'id, order'
sessions:  'id, status, startedAt, *exerciseIds'
settings:  'id'
```
Phase 2 adds a `bodyweights` table and block-tracker settings through a Dexie version bump. Existing data is kept.

### Rules the model enforces
- **Snapshots:** each session copies its slot targets when it starts. Editing or deleting a template later never changes past sessions.
- **Variations stay separate:** history, prefill and PRs are always looked up by `exerciseId`. Swapping a slot only changes `exerciseId` on that session exercise.
- **Working set** means a set that isn't a warm-up and has both weight and reps entered. Only working sets count towards PRs, volume and estimated 1RM.
- **Last session for exercise X** is the most recent other *finished* session that started earlier than the current one and has at least one set for X. It's found through the `*exerciseIds` index.
- **Duration** = `endedAt − startedAt`.
- **"This week"** runs from Monday 00:00 to Sunday 23:59, local time.
- **Suggested end time** is the latest `loggedAt` among the session's sets, or now if there are no sets.
- **Rest text** comes from the exercise's type, plus the warm-up text when its warm-up policy isn't "none". The four texts can be edited in Settings. Defaults:
  - warm-up sets: 1–2 min
  - compound: 3–5 min
  - isolation: 90 s–3 min
  - core: 60–90 s
- **New exercise names** typed anywhere (in the slot editor or during a workout) are saved to the library right away. They then appear in every exercise list.

---

## 3. Screens

Navigation uses a bottom tab bar: **Today · History · Progress · Settings**.

**Today**
- If no workout is running: a big **Start workout** button. It opens the start sheet, where you pick a template or Blank and a date (defaults to today; an earlier date logs a past session).
- If a workout is running: a **Resume workout** button showing the live elapsed time instead.
- Last session summary: date, template, duration, exercises.
- This week: number of sessions and total gym time.
- Backup reminder banner if there's been no JSON backup in 14 days.

**Workout** (full screen, tab bar hidden; one editor with three modes)
- *Live:* elapsed timer in the header and a **Finish** button.
- *Past / Edit:* date, start time and end time fields instead of the timer, and a **Done** button.
- Session note at the top. Exercise cards stacked vertically. **Add exercise** at the bottom.
- **Exercise card** shows:
  - Exercise name. Tapping it opens the swap list: this slot's default and alternatives first, then every saved exercise with search, then "Create '…'".
  - Target line, e.g. `2 × 5–12 | Compound | Full warm-up`
  - Rest text and plan note
  - Set rows, each with:
    - set number
    - warm-up toggle
    - weight with − / +
    - reps with − / +
    - note
    - delete
  - **Add set**, **Copy last set**, **Copy previous session's sets**
  - Per-exercise note
- **Ghost rows:** last session's sets for this exercise appear dimmed below the sets you've logged. A ghost row isn't a set yet. Tapping it, or typing into it, turns it into a real set stamped with the current time, and you can still edit it. **Copy previous session's sets** turns all remaining ghost rows into sets in one tap.
- **Finish sheet:** start time and suggested end time (both editable), with the duration shown live.

**History:** sessions listed newest first, each showing date, template, duration and exercise names. Tap a session to open its read-only detail view, which has **Edit** (opens the Workout screen in Edit mode) and **Delete** (asks to confirm).

**Progress:** shows "Coming in Phase 2" during Phase 1.

**Settings**
- Templates: list → template editor → slot editor
- Exercises: library list → exercise editor
- Rest guidance texts
- Backup & export:
  - JSON backup
  - Restore from JSON
  - CSV export of all sets
  - Copy for Claude (with a date range)

**Small necessities I've included:**
- reorder slots with ↑/↓ buttons
- remove an exercise from a session
- discard a workout started by mistake

---

## 4. Folder structure

```
gym-tracker/
├─ PLAN.md · PROGRESS.md · README.md (deploy + install steps, written in the final chunk)
├─ index.html                 iOS meta tags (apple-mobile-web-app-*, status bar, viewport-fit=cover)
├─ vite.config.ts             React + PWA plugin (manifest, precache, icons)
├─ public/                    app icons (180 apple-touch, 192, 512, maskable 512)
├─ src/
│  ├─ main.tsx · App.tsx      router, tab bar, first-run persist() + seed
│  ├─ styles/                 tokens.css, base.css
│  ├─ db/
│  │  ├─ types.ts             the data model above
│  │  ├─ db.ts                Dexie schema + versions
│  │  ├─ seed.ts              library, 3 templates, sample session
│  │  └─ queries.ts           lastSessionFor(), weekStats(), lastFinishedSession() …
│  ├─ lib/                    ids, time/duration/week maths, formatting, export (json/csv/claude text)
│  ├─ components/             TabBar, Sheet, ConfirmDialog, Stepper, NumberInput, ExercisePicker, SetRow, ExerciseCard
│  └─ screens/
│     ├─ today/               Today, StartSheet
│     ├─ workout/             WorkoutScreen (live / past / edit), FinishSheet
│     ├─ history/             HistoryList, SessionDetail
│     ├─ progress/            Phase 1 placeholder
│     └─ settings/            Settings, Templates, TemplateEditor, SlotEditor, Exercises, ExerciseEditor, RestGuidance, Backup
├─ scripts/offline-check.mjs  serve dist → install SW → stop server → reload → app must still work
└─ tests/                     Vitest unit tests
```

---

## 5. Chunks: Phase 1

After each chunk: build, run the tests, try it in the browser at iPhone size (375×812), fix problems, commit, tick it in PROGRESS.md, then stop and tell you how to try it.

| # | Chunk | Done when |
|---|---|---|
| 1 | **Project setup + PWA shell**: Vite/React/TS, PWA plugin, manifest, icons, iOS meta tags, theme tokens, tab bar with 4 empty tabs, HashRouter, `persist()` on first run, Vitest, git | Build passes. The app loads, tabs switch, and it still loads with the network off after the first visit. The manifest is valid. |
| 2 | **Database + exercise library**: Dexie schema, settings row with default rest texts, Settings → Exercises (list / add / edit / delete if unused), Settings → Rest guidance, the reusable ExerciseSearch (search, pick, create by typing) | Exercises survive a reload. Duplicate names are blocked regardless of letter case. Unit tests pass. |
| 3 | **Template builder**: list, create, rename, duplicate, delete; template editor (add / edit / delete / reorder slots); slot editor (default, alternatives, sets, rep range, warm-up policy, plan note); the ExercisePicker bottom sheet (wraps ExerciseSearch, with quick-create) | A template can be built, edited, duplicated and deleted, and survives a reload |
| 4 | **Seed data**: the exercise library and the 3 templates (see §7), seeded once on first run. No sample session. | A fresh install shows all three templates exactly as specified |
| 5 | **Today screen + start flow**: start sheet (template / Blank + date), session created from template snapshots, Workout screen listing slots with target line and rest text, last-session summary, this week's sessions and time, Resume when active | Starting from each template shows the right slots. Today shows the last session and this week's totals (from sessions logged during testing). |
| 6 | **Active workout: set entry**: set rows (numeric keypad, steppers by weight step, warm-up toggle, note, delete), add set, exercise and session notes, swap list, add / remove exercise. Every change autosaves. | A full workout can be logged. Closing and reopening the app mid-workout loses nothing. |
| 7 | **Fast entry**: Copy last set, ghost prefill from the last session of the same exercise, Copy previous session's sets | After logging a session, the same exercise next time opens with those sets as ghosts. Copying works as described. Swapped exercises show their own history. |
| 8 | **Gym time + finish**: live elapsed timer, finish sheet with suggested end time, editable start/end, duration on the summary; past-dated sessions (no timer, times entered by hand); empty exercises dropped on finish | Duration is correct. A past session can be logged for an earlier date. |
| 9 | **History + edit past sessions**: list, detail view, edit (same editor in Edit mode), change date and times, delete | Any past session can be viewed, edited and deleted, and the Today totals update |
| 10 | **Export / backup**: JSON backup (iOS share sheet → Save to Files, with a download fallback), restore (replaces everything after a confirm), CSV of all sets, Copy for Claude with a date range, 14-day reminder | Backup → wipe → restore gives identical data. The CSV opens in Numbers. The Claude text pastes cleanly. |
| 11 | **Phase 1 wrap-up**: run through the whole Definition of Done, fix anything found, write README with free deploy steps and Safari → Share → Add to Home Screen | Every Definition of Done item checked. Ready for you to test on your phone. |

## 6. Chunks: Phase 2 (planned 12 Oct 2026, after Phase 1 was confirmed on the iPhone)

**Your answers:**
- Weekly volume = **working sets per week**.
- **No** bodyweight log.
- The third warm-up (75% × 2–4) is **for compound exercises only**.
- The progression hint triggers when **set 1** reaches the top of the rep range.

**Data model:** one addition, `settings.block = { startDate: 'YYYY-MM-DD' | null, weekOffAfter: number }` (default 12). No new tables. Missing settings fields fall back to defaults, so older backups still restore.

**Shared rules:**
- A **working set** isn't a warm-up and has weight and reps > 0. Only finished sessions count.
- **Epley e1RM** = weight × (1 + reps / 30). It's calculated only from working sets of 12 reps or fewer, and is the best value in a session.
- **Top working-set weight** is the heaviest working set in a session, at any rep count.
- **Per-hand weights** are used as entered (kg each).
- **Bodyweight exercises** record added load only, so their charts show "top added weight" and "most reps" instead of e1RM.
- **Everything is per exercise.** Variations never mix.

| # | Chunk | Done when |
|---|---|---|
| 12 | **Progress tab: exercise chart.** Pick an exercise (most recently trained first). The chart shows top working-set weight and e1RM per session over time (bodyweight: added weight and most reps). Built with Recharts, loaded only when the Progress tab opens. | The chart matches hand-calculated values. The tab works offline. |
| 13 | **PRs, weekly volume, gym time.** Per exercise: heaviest weight (with date) and best reps at each weight. Working sets per week (last 12 weeks, Monday–Sunday). Gym time per session as a trend. | PRs and weekly counts match the tests. |
| 14 | **Warm-up helper.** On exercise cards with a warm-up policy, it's based on the first work weight (this session's, else last session's), rounded to the exercise's step. "Full" gives 40% × 6–10, then 65% × 4–8, then (compound only) 75% × 2–4. "1 set" and "0–1" give a single 65% × 4–8 set. Shown as a text line; nothing is logged automatically. Bodyweight and ad-hoc exercises get no suggestion. | The suggestions are correct for each policy and are rounded to the step. |
| 15 | **Progression hint.** If set 1 last time reached the slot's top rep, the card says to try 5–10% more next, with the weights rounded to the step (at least one step). During a workout it also shows whether your top set beat, matched or fell short of last session's (heavier weight wins; at the same weight, more reps wins). | The hint and comparison are correct in the tests and on screen. |
| 16 | **Training block tracker.** Settings → Training block: a start date and "Week off after N weeks" (default 12). Today shows "Week X" (weeks 1–2 labelled "Break-in") and a reminder once you're past N weeks. | Week numbers and the reminder are correct around the boundaries. |
| 17 | **Phase 2 wrap-up.** Extend `check:dod` to cover Phase 2, fix anything found, and update the docs. | All checks pass. Ready to push to the phone. |

---

## 7. How I'm reading the seed data

**Library.** Type is from your list. "Per hand" and "bodyweight" are only set where you said so, or where it's obvious from a dumbbell exercise.

| Exercise | Type | Per hand | Bodyweight |
|---|---|---|---|
| Flat Dumbbell Bench Press | compound | ✓ | |
| Dips | compound | | ✓ |
| Cable Fly · Pec Deck | isolation | | |
| Pull-up | compound | | ✓ |
| Lat Pulldown | compound | | |
| Chest-supported Row · Seated Cable Row | compound | | |
| Single-arm Dumbbell Row | compound | ✓ | |
| Back Extension | isolation | | ✓ *(assumed: plate is added load)* |
| Seated Back Extension Machine · Reverse Hyper | isolation | | |
| Hanging Knee Raise · Hanging L-sit · Hanging Pike | core | | ✓ |
| Hack Squat · Back Squat · Romanian Deadlift · Deadlift | compound | | |
| Leg Extension · Lying Leg Curl · Standing Calf Raise | isolation | | |
| Seated Dumbbell Overhead Press | compound | ✓ | |
| Dumbbell Lateral Raise | isolation | ✓ | |
| Cable Lateral Raise | isolation | | |
| Face Pull · Preacher Curl Machine · Overhead Cable Triceps Extension · Cable Pushdown | isolation | | |
| Dumbbell Curl | isolation | ✓ | |
| Ab Wheel | core | | ✓ |
| Cable Crunch | core | | |

**Weight steps:** 2.5 kg for every exercise, except **Lat Pulldown and Seated Cable Row at 7 kg** (from your stack numbers, 25 → 32 → 39).

**Text in brackets that isn't an alternative becomes a slot plan note:**
- Face Pull → "Rope"
- Dumbbell Curl → "Supinate"
- Hack Squat slot → "Back Squat: use safety pins"
- Dips → "Add weight once 12 bodyweight reps are possible"
- Hanging core slot → "Progression: Knee Raise → L-sit → Pike"

Knee Raise is that slot's default; L-sit and Pike are its alternatives.

**Lateral Raise (DB or Cable)** becomes two exercises, Dumbbell (default) and Cable (alternative), because progress must never merge across variations.

**No sample session.** The 12/10 session was for reference only, so nothing is seeded into History. The exercises that only appeared in it (Incline DB Press, the barbell warm-up) aren't seeded either; type them in whenever you need them.

---

## 8. Decisions (answered 12 Oct 2026)

1. **Sample session:** don't seed it.
2. **Ghost rows:** approved as described in §3. A set is created and timestamped when you tap or type into a ghost row, or use Add set / Copy last set / Copy previous session's sets. There's no separate "done" tick.
3. **App name:** "Gym Log".
4. **Testing and deploy:** test on the Mac during Phase 1 and deploy at the end.
5. **Cable step size (not answered, so default applied):** Lat Pulldown and Seated Cable Row at 7 kg, everything else 2.5 kg.
6. **Deleting library exercises (not answered, so default applied):** allowed only for exercises never used in any session or template.

**Assumptions I'll go with unless you say otherwise:**
- A week runs Monday to Sunday.
- Only one workout can be running at a time.
- Restoring from JSON **replaces** all data (after a confirm) rather than merging.
- The backup reminder resets only on a JSON backup, because CSV can't be restored.
- Copy last set copies weight and reps only. The warm-up toggle starts off and the note starts empty.
- Swapping an exercise that already has sets moves those sets to the new exercise (after a confirm).
- Exercises with no sets are removed when you finish, so skipped slots don't clutter History.
- In the CSV, the "session" column is the template name (or "Blank"). Set number counts every set in that exercise, warm-ups included.
- In Phase 1 the Progress tab is a placeholder.
