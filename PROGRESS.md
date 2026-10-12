# Progress

## Status
SPEC.md = the original brief; PLAN.md = how it's being built + decisions.

**Phase 1, chunk 1 done.** Waiting for "go" before chunk 2.

## Phase 1 chunks
- [x] 1. Project setup + PWA shell
- [ ] 2. Database + exercise library
- [ ] 3. Template builder
- [ ] 4. Seed data (library + 3 templates; no sample session)
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
Chunk 2: Dexie schema (all four tables from PLAN.md §2), a settings row with the default rest texts, Settings → Exercises (list / add / edit / delete-if-unused), Settings → Rest guidance, and the reusable ExercisePicker (search, pick, create by typing).

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
- Toolchain: Vite 8, React 19, TypeScript 7, React Router 8, vite-plugin-pwa 2, Vitest 5.

## Known issues
- The Claude app's built-in browser pane can't register service workers. Offline is verified with `npm run check:offline`, which uses the real Chrome, instead.
- React Router applies navigation inside a transition, so a tab switch renders a frame later. It isn't noticeable, but automated checks need a short wait after a click.
- npm reports `fsevents` has an unapproved install script. It's an optional macOS file watcher and ships prebuilt, so it's safe to ignore.
