# Progress

## Status
SPEC.md = the original brief; PLAN.md = how it's being built + decisions.

**Phase 1, chunk 8 done.** Going straight on to chunk 9.

## Phase 1 chunks
- [x] 1. Project setup + PWA shell
- [x] 2. Database + exercise library
- [x] 3. Template builder
- [x] 4. Seed data (library + 3 templates; no sample session)
- [x] 5. Today screen + start flow
- [x] 6. Active workout: set entry
- [x] 7. Fast entry (copy last set, ghost prefill, copy previous session's sets)
- [x] 8. Gym time + finish (incl. past-dated sessions)
- [ ] 9. History + edit past sessions
- [ ] 10. Export / backup (JSON, restore, CSV, Copy for Claude, 14-day reminder)
- [ ] 11. Phase 1 wrap-up + deploy instructions

## Phase 2 (only after Phase 1 is confirmed on the phone)
- [ ] 12–17: see PLAN.md §6

## In progress
Nothing.

## Next
Chunk 9: History and editing past sessions.
- **History tab:** sessions newest first, each with date, template, duration and exercise names.
- **Session detail:** read-only, with Edit and Delete (Delete asks first).
- **Edit** reuses the workout screen for a finished session:
  - date, start and end are editable (`setSessionTimes`)
  - sets, notes and swaps work as during a workout
  - "Done" goes back
- **Ghosts in Edit mode** compare against sessions before the one being edited, which `previousSetsFor` already handles.
- **After Finish,** go to the new session's detail page rather than Today.

## How to run
```
npm install
npm run dev              # http://localhost:5173 (no service worker in dev)
npm test                 # unit tests
npm run build            # type-check + production build into dist/
npm run preview          # serve dist/ at http://localhost:4173 (service worker active)
npm run check:offline    # after build: proves the app loads with the server stopped
npm run icons            # regenerate icons from public/icon.svg
```

## Decisions made
- **Workflow change (12 Oct 2026, user's request):** work through the remaining Phase 1 chunks (7–11) one at a time without waiting for "go". Each chunk is still tested, committed and recorded here. Stop only for complications or decisions that need the user. Stop after chunk 11 (deploy instructions), because Phase 2 waits until the user confirms Phase 1 on their phone.
- The project lives at `~/Developer/gym-tracker`.
- The plan was approved on 12 Oct 2026. Answers are in PLAN.md §8.
  - No sample session.
  - Ghost-row behaviour as planned.
  - App name "Gym Log".
  - Test on the Mac and deploy at the end.
  - Defaults applied: 7 kg step on Lat Pulldown and Seated Cable Row; delete only unused exercises.
- Routing uses a HashRouter and the build uses relative paths (`base: './'`), so GitHub Pages and Vercel both work. The host is picked at deploy time.
- Each session is stored as one document, with its exercises and sets inside it. Slot targets are snapshotted when the session starts.
- PWA: `registerType: 'autoUpdate'`. Workbox precaches everything in dist/ (12 entries, about 260 KB). The new service worker takes over in the background and the new version shows on the next launch, with no forced reload mid-workout.
- Icon: an ember dumbbell on near-black (`public/icon.svg`), turned into PNGs by `@vite-pwa/assets-generator`. The apple-touch icon uses 10% padding.
- `navigator.storage.persist()` is requested on every launch until granted (`src/lib/storage.ts`).
- `newId()` falls back to `getRandomValues` when `crypto.randomUUID` is missing (plain-http testing over Wi-Fi).
- Toolchain: Vite 8, React 19, TypeScript 7, React Router 8, vite-plugin-pwa 2, Vitest 5, Dexie 4.
- **Database** (`src/db/`): IndexedDB database `gym-log`, Dexie schema v1 with all four tables from PLAN.md §2.
  - The settings row (`id: 'app'`) is created with the default rest texts by Dexie's `populate` hook.
  - Defaults live in `defaults.ts`, which avoids an import cycle with `db.ts`.
- **Exercise names:** they're stored with whitespace cleaned up. Uniqueness is enforced on `nameKey` (lower-cased) by a unique index plus a friendly pre-check (`DuplicateNameError`). Renaming to change only the capitals is allowed.
- **Deleting exercises:** only allowed when no template slot (default or alternative) and no session (`exerciseIds` index) uses the exercise. Slot snapshots inside sessions aren't counted; later UI must skip alternative ids that no longer exist.
- **New exercises:** a type must be chosen (it drives the rest text). The weight step defaults to 2.5 and the flags default to off.
- **Settings forms** (exercise editor, rest guidance) use an explicit Save button. The workout screen will autosave.
- **Delete confirmation** uses the native `window.confirm`. Errors are shown in the accent colour, since there's no red in the palette.
- **ExercisePicker:** the shared `ExerciseSearch` (search, matching list, "+ Add “…”" when the typed name is new) is built and used by Settings → Exercises. The bottom-sheet wrapper was moved to chunk 3, where it's first used.
- **Templates** (`src/db/templates.ts`, screens under `src/screens/settings/`):
  - The template editor and slot editor **autosave** every change. There's no Save button; you just go back.
  - Clearing a template's name isn't saved. The field goes back to the stored name when you leave it.
  - Every slot change goes through `normaliseSlot`: sets 1–20 and reps 1–100, whole numbers, with max reps never below min.
  - Raising min reps above max pushes max up, and lowering max below min pulls min down.
- **New slots** start at 2 × 8–12 with no warm-up. The slot editor opens straight after you add an exercise so you can set them.
- **Changing a slot's default** to one of its alternatives swaps them, so the old default becomes an alternative. This suits progressions like Knee Raise → L-sit (`withDefault`).
- **The picker hides exercises already in the slot** (the default when changing the default; the default and alternatives when adding an alternative). Hidden names still block creating duplicates.
- **Picker quick-create:** typing a new name in the picker opens the new-exercise form inside the sheet. "Add to library and use" saves it and picks it in one go.
- **Duplicate** adds "Name (copy)" at the end of the list with new ids throughout, and opens it. Deleting a template asks first and never touches past sessions, since they hold their own snapshot.
- **Template order:** the list is in creation order. Reordering templates isn't in the spec, so it isn't built.
- **Slot reorder:** ↑/↓ buttons (48 px) on each slot card, disabled at the ends.
- **Seeding** (`src/db/seed.ts`): `seedIfNeeded()` runs from `main.tsx` on every launch and does nothing once `settings.seededAt` is set.
  - It adds 32 exercises and 3 templates in a single transaction.
  - An exercise that already exists (same name, any case) is reused rather than duplicated, and its flags are left alone.
  - Seed templates are always added after any existing templates, never merged.
  - Deleting a seeded template doesn't bring it back. Restoring a backup (chunk 10) carries `seededAt` with it.
  - Seed data is plain data in `seed.ts`, and nothing else in the app refers to those names.
- **Target lines** (`targetLine` → `joinUnbroken`) use no-break spaces, non-breaking hyphens and word joiners, so they wrap only at the " | " separators. They're display-only; exports should build their own text.
- **Sessions** (`src/db/sessions.ts`):
  - Only one `active` session can exist at a time; `startSession` throws `ActiveSessionError` otherwise.
  - Starting deep-copies the template's slots into `SessionExercise.slot`.
  - `withDerived()` recomputes `exerciseIds` (every exercise in the session, deduplicated) and `updatedAt` on every write.
- **Start date:** the start sheet's date can't be in the future.
  - For today, `startedAt` is now.
  - For a past date, it's that date at the current time of day, as a placeholder until chunk 8 adds manual times.
  - A past-dated session is `active` (a draft) until it's finished, so Today shows "Resume workout · Legs · Fri 9 Oct".
- **This week** runs Monday 00:00 to Sunday 23:59 local time and counts only finished sessions. **Last session** is the finished session with the latest `startedAt`.
- **Discard workout** (shown only on an active session) asks first, then deletes it. It's needed until Finish exists, and is the agreed "discard a workout started by mistake".
- **The workout screen** (`/workout/:id`) is full-screen with no tab bar. "‹ Today" leaves the workout running.
- **Rest text** is "Rest {type text} · warm-ups {warm-up text}". The warm-up part is dropped when the slot's policy is "none"; ad-hoc exercises show both.
- **Set entry** (chunk 6):
  - A set row is two lines.
    - Line 1: the label ("W" for warm-ups, otherwise 1, 2, 3… counting working sets only), the Warm-up chip, a note toggle (✎), and delete (✕). Delete needs two taps: the first arms it and it disarms after 3 s.
    - Line 2: weight and reps steppers.
  - The weight column is 1.3× the width of reps. On screens narrower than 360 px (SE, or Display Zoom) weight and reps stack, with small unit labels inside the fields.
- **Number fields** (`NumberField`) save on every keystroke and keep the exact typed text while focused.
  - Weight accepts "," or ".", up to 2 decimals. Reps take whole numbers only.
  - Unusually long values get smaller text instead of clipping.
- **Steppers** (`StepField`) step by the exercise's weight step, or 1 for reps. From empty, + gives one step and − gives 0. They never go below 0.
- **The weight column heading** says "kg", "kg each" (per hand) or "+kg" (bodyweight).
- **Saved values are cleaned:** weight is ≥ 0 and rounded to 2 decimals; reps are whole and ≥ 0. Empty stays `null`. Editing a set never changes its `loggedAt`.
- **Swap** happens by tapping the exercise name (⇄).
  - The picker shows "This slot" (default and alternatives, minus the current one) first, then all exercises, plus create-new.
  - If sets are logged, it asks "Move N sets to X?" and moves them.
  - The slot snapshot stays as it was, so the target line is unchanged.
- **Notes:** the session note sits at the top, there's an exercise note on each card, and set notes are behind ✎. All autosave. The note fields grow with their text (`field-sizing: content`).
- **"+ Add exercise"** adds an ad-hoc exercise (`slot: null`: rest text but no target line) and scrolls to it. Removing an exercise asks first and mentions how many sets will go.
- **Chips** have a 48 px tap area around a 36 px pill.
- **Ghost rows** (chunk 7):
  - `previousSetsFor(exerciseIds, session)` finds, per exercise, the latest *finished* session that started before this one and has sets for it. Other sessions without sets for it are skipped.
  - Ghosts are last time's sets from position `sets.length` onwards. They're dimmed, and their values show as placeholders.
  - Any of these logs a ghost: "✓ Log", typing, −/+ (which starts from the ghost value), or the warm-up chip. The new set takes the ghost's values plus your change.
- **Keeping focus on a ghost row:** each position has a pre-made set id (`ghostIds`). Logged sets and ghosts render as one keyed list, so the row and its input survive the change and the iOS keypad stays up.
  - A `logging` set makes keystrokes typed before the new set arrives update that set instead of adding another.
  - The position's id is replaced once the add finishes.
- **"Copy last set"** copies weight and reps only. It's disabled when there are no sets.
- **"Copy previous session's sets (N)"** shows while ghosts remain and adds them all in one write (`addSets`).
- **"Last time · Sat 10 Oct"** appears above the sets when there's history.
- **Swapping** shows the new exercise's own history (variations never mix).
- **Live or past** (chunk 8): `isLive(session)` means it's `active` and started less than 16 hours ago, so it was started today with the timer running.
  - A past-dated draft started yesterday or earlier at least 24 hours ago, so it isn't live: no timer, "Save" instead of "Finish".
  - A workout left open overnight also stops being live, so there's no runaway timer.
  - This avoids adding a field to the data model.
- **The workout bar** is a sticky top bar: "‹ Today", the live gym timer (m:ss, or h:mm:ss after an hour) or the date for a past draft, and Finish/Save.
  - The timer is its own component, so only it re-renders each second.
- **The Finish / Save sheet** has start and end time inputs on the session's day.
  - If the end is earlier than the start, it's taken as the next day (ran past midnight).
  - Live: end defaults to `suggestedEnd` (latest set `loggedAt`, or now with no sets). Past: end defaults to start + 1 h.
  - The duration preview updates live, and it says how many exercises with no sets will be left out.
- **`finishSession`** sets `finished` and the times, and drops exercises with no sets. Finishing currently returns to Today.
- **Dates and times** follow the device's locale (`toLocaleDateString` / `toLocaleTimeString`). Durations look like "1h 12m"; on Today, the units are drawn smaller than the numbers.

## Known issues
- The Claude app's built-in browser pane can't register service workers. Offline is verified with `npm run check:offline`, which uses the real Chrome, instead.
- While the Claude app's browser pane is hidden it pauses animation frames, so screenshots taken right after a tap can look stale. Measured navigation is 1–6 ms, so the app itself isn't slow.
- Dexie live queries only notice writes made through Dexie. Test data inserted with raw IndexedDB needs a page reload to show.
- npm reports `fsevents` has an unapproved install script. It's an optional macOS file watcher and ships prebuilt, so it's safe to ignore.
