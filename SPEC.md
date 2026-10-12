# Original brief (as given, 12 Oct 2026)

> Source of truth for requirements. PLAN.md records how it's being built and the decisions made since (e.g. the sample session below is **not** seeded; see PLAN.md §8).

# Project: Personal Gym Workout Tracker (PWA, iPhone)

Build a single-user workout tracker as an installable PWA for iPhone. Local-only data, no backend, no accounts, no paid services, free to host (GitHub Pages or Vercel). Fitness only: no food or calorie features.

## How to work (read this first)
This is a big project. Build it in small, verified chunks, not all at once.
1. **Plan first.** Before writing any app code, write PLAN.md: the data model, screen list, folder structure, and an ordered list of small chunks (each one a single working piece, e.g. "project setup + PWA shell", "database + exercise library", "template builder", "active workout screen: set entry", "copy-last-set + prefill", "gym timer", "history + edit past sessions", "export/backup", "seed data"). Show me the plan and wait for my approval.
2. **One chunk at a time.** After each chunk: run the app, test it works, fix problems, commit with a clear message, tick it off in PROGRESS.md, then stop and summarise what was built and how I can try it. Wait for me to say "go" before starting the next chunk.
3. **Keep PROGRESS.md updated** (done, in progress, next, decisions made, known issues) so work can resume cleanly in a new session.
4. **Do not add features, screens or colours not described here.** If something is ambiguous or a decision affects the data model, ask me before building.
5. **Don't rewrite working code** from earlier chunks unless a bug requires it; tell me if you do.
6. Phase 2 does not start until I confirm Phase 1 is working on my phone.

## Stack
Vite + React + TypeScript, vite-plugin-pwa (offline + home-screen install + iOS meta tags), Dexie (IndexedDB) for storage, Recharts or uPlot for charts. Mobile-first, max width ~480px. Request persistent storage via navigator.storage.persist() on first run.

## Design
- Near-black background (#0A0A0A), card surfaces (#161616), ember orange accent (#FB923C), off-white text. Large numerals.
- Big tap targets (min 48px) for use mid-workout with sweaty hands. Numeric keypad for weight and reps inputs.
- Bottom tab bar: Today, History, Progress, Settings.
- No haptics (not supported in iOS Safari). Units: kg.

## Core concepts
- **Exercise library:** name, per-hand flag (dumbbells), bodyweight flag (weight field = added weight, 0 = bodyweight), weight step (default 2.5 kg, editable per exercise because cable stacks use odd increments), type (compound / isolation / core). Typing a new exercise name anywhere saves it permanently so it appears in every dropdown after that.
- **Template:** a named session with an ordered list of **slots**. Each slot has: a default exercise, optional alternative exercises, target sets, rep range (min-max), warm-up policy (full / 1 set / 0-1 sets / none), and a short plan note. Build, edit, rename, duplicate and delete templates in-app. Do not hard-code any routine in the app logic (the routines below are seed data only).
- **Variations:** swapping a slot to an alternative is allowed, but progress, PRs and prefill are tracked per exercise, never merged across variations.
- **Session:** a dated instance of a template (or blank), containing exercises, sets, notes, start time and end time.
- **Set:** weight (kg), reps, warm-up toggle, optional note. Warm-up sets are excluded from PRs, volume and estimated 1RM.
- **Rest guidance (text only, no timer):** warm-up sets 1-2 min; compound 3-5 min; isolation 90 s-3 min; core 60-90 s. Store as editable fields and show the relevant text on each exercise during a workout.

## Phase 1 (build in chunks, as above)
1. **Today screen:** big "Start workout" button (choose template or blank), last session summary, sessions and total gym time this week.
2. **Active workout screen:**
   - Slots listed vertically, each showing the target (e.g. "2 x 5-12 | Compound | Full warm-up") and rest text. Each has a dropdown to swap in the default, an alternative, or any saved exercise, and "add exercise".
   - Within each exercise: a list of sets with weight, reps, warm-up toggle, note. Add and delete set.
   - **Fast entry:** "Copy last set" (one tap duplicates previous weight and reps, like a ditto mark); each exercise opens prefilled from the last session of that same exercise as editable ghost values, with a "copy previous session's sets" option. +/- steppers using the exercise's step size.
   - Per-exercise notes and a whole-session note.
3. **Gym time:** timer starts when I tap "Start workout" and ends when I tap "Finish workout". On finish, suggest end time = timestamp of last logged set, editable. Start and end are editable afterwards. Show total duration on the session summary.
4. **Log past sessions:** date picker when starting or editing, so I can enter a session after the fact. Past sessions are fully editable and deletable.
5. **History tab:** list of sessions by date (template, duration, exercises), tap to view or edit.
6. **Export/backup:** JSON full backup and restore; CSV export of all sets (date, session, exercise, set number, weight, reps, warm-up, note); "Copy for Claude" button that copies a compact plain-text summary for a chosen date range (sessions, exercises, sets, notes, duration) to the clipboard. Show a backup reminder if no export in 14 days.
7. **Seed data** (editable in-app after seeding). Slot format: Default (alternatives) | sets x reps | type | warm-up.

   **Torso**
   1. Flat Dumbbell Bench Press | 2 x 5-12 | compound | full warm-up (per hand)
   2. Dips | 2 x 5-12 | compound | 1 warm-up set (bodyweight; note: add weight once 12 bodyweight reps are possible)
   3. Cable Fly (Pec Deck) | 2 x 8-15 | isolation | 0-1 warm-up
   4. Pull-ups (Lat Pulldown) | 2 x 5-12 | compound | full warm-up (bodyweight)
   5. Chest-supported Row (Seated Cable Row, Single-arm DB Row) | 2 x 5-12 | compound | 1 warm-up
   6. Back Extension (Seated Back Extension Machine, Reverse Hyper) | 2 x 8-25 | isolation | 1 warm-up
   7. Hanging Core Progression: Knee Raise > L-sit > Pike (as three selectable exercises) | 3 x 5 | core | no warm-up (bodyweight)

   **Legs**
   1. Hack Squat (Back Squat, use safety pins) | 2 x 5-12 | compound | full warm-up
   2. Leg Extension | 2 x 8-15 | isolation | 1 warm-up
   3. Romanian Deadlift (Deadlift) | 2 x 5-10 | compound | full warm-up
   4. Lying Leg Curl | 2 x 6-12 | isolation | 1 warm-up
   5. Standing Calf Raise | 3 x 8-15 | isolation | full warm-up

   **Shoulders & Arms**
   1. Seated DB Overhead Press | 2 x 5-12 | compound | full warm-up (per hand)
   2. Lateral Raise (DB or Cable) | 2 x 10-20 | isolation | 0-1 warm-up
   3. Face Pull (Rope) | 2 x 12-20 | isolation | 0-1 warm-up
   4. Dumbbell Curl (supinate) | 2 x 8-15 | isolation | full warm-up (per hand)
   5. Preacher Curl Machine | 2 x 8-15 | isolation | 0-1 warm-up
   6. Overhead Cable Triceps Extension | 2 x 8-15 | isolation | full warm-up
   7. Cable Pushdown | 2 x 8-15 | isolation | 0-1 warm-up
   8. Ab Wheel (Cable Crunch) | 2 x 8-15 | core | no warm-up

   Also seed one sample session dated 12/10 so there is test data (add any exercises not above to the library):
   - Warm-up: barbell x10; DB incline 12.5 x10, 15 x10
   - Incline: 20 x10, 22.5 x8
   - Flat: 22.5 x8, 22.5 x9
   - Seated cable row: 25 x8 (warm-up), 39 x7, 39 x8
   - Lat pulldown: 32 x7 (warm-up), 39 x7, 39 x7
   - Session notes: "need to strengthen forearms"; "forearms are dead" on pulldowns.

## Phase 2 (only after Phase 1 is confirmed working)
- **Progress tab:** per-exercise chart (top working-set weight and estimated 1RM using Epley, ignoring sets over 12 reps), automatic PRs (heaviest weight, best reps at a given weight), weekly volume, gym-time-per-session trend. Optional simple bodyweight log with trend line.
- **Warm-up helper:** for "full warm-up" exercises, suggest warm-up sets from my first work set weight (or last session's): 40% x 6-10, then 65% x 4-8, then 75% x 2-4 if heavy. Rounded to the exercise's weight step. 1-set / 0-1 policies suggest a single set.
- **Progression hint:** my rules: work set 1 to failure (then strain 3-5 s more), work set 2 stops at failure. If I hit the top of the rep range with good form, suggest adding 5-10% next session. Also show whether I beat last session's top set.
- **Training block tracker:** a start-date setting showing "Week X"; weeks 1-2 labelled break-in; reminder to take a week off after 12-16 weeks (configurable).

## Definition of done (Phase 1)
Works offline once installed. Can run a workout from each seeded template, swap an exercise, copy sets, finish with a correct duration, edit a past session, export JSON/CSV and restore from JSON. When done, give me step-by-step instructions to deploy for free and add it to my iPhone via Safari > Share > Add to Home Screen.
