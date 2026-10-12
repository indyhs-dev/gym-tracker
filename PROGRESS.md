# Progress

## Status
SPEC.md = the original brief; PLAN.md = how it's being built + decisions.

**Phase 1, chunk 4 done.** Waiting for "go" before chunk 5.

## Phase 1 chunks
- [x] 1. Project setup + PWA shell
- [x] 2. Database + exercise library
- [x] 3. Template builder
- [x] 4. Seed data (library + 3 templates; no sample session)
- [ ] 5. Today screen + start flow
- [ ] 6. Active workout: set entry
- [ ] 7. Fast entry (copy last set, ghost prefill, copy previous session's sets)
- [ ] 8. Gym time + finish (incl. past-dated sessions)
- [ ] 9. History + edit past sessions
- [ ] 10. Export / backup (JSON, restore, CSV, Copy for Claude, 14-day reminder)
- [ ] 11. Phase 1 wrap-up + deploy instructions

## Phase 2 (only after Phase 1 is confirmed on the phone)
- [ ] 12–17: see PLAN.md §6

## In progress
Nothing.

## Next
Chunk 5: Today screen + start flow.
- **Today:**
  - A big **Start workout** button opens a start sheet: choose a template or Blank, plus a date that defaults to today.
  - A last-session summary.
  - This week's sessions and total gym time (Monday to Sunday).
  - **Resume workout** replaces Start while a session is active.
- **Starting a session** creates a `Session` (status `active`) whose exercises snapshot the template slots.
- **Workout screen** (`/workout/:id`, tab bar hidden): lists each slot with its target line, rest text (from settings) and plan note.
  - Set entry comes in chunk 6.
  - Past-date details (no timer, start and end times entered by hand) come in chunk 8.

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

## Known issues
- The Claude app's built-in browser pane can't register service workers. Offline is verified with `npm run check:offline`, which uses the real Chrome, instead.
- While the Claude app's browser pane is hidden it pauses animation frames, so screenshots taken right after a tap can look stale. Measured navigation is 1–6 ms, so the app itself isn't slow.
- npm reports `fsevents` has an unapproved install script. It's an optional macOS file watcher and ships prebuilt, so it's safe to ignore.
