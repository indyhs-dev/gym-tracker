# Workout UI redesign

Put this folder in the repo at `docs/redesign/`. Mockups are next to this file:

| Screen | Screenshot | Design file (open in a browser, exact colours/sizes) |
|---|---|---|
| Workout screen | `screens/01-workout-screen.png` | `html/01-workout-screen.html` |
| Rest bar, counting down | `screens/02-rest-counting-down.png` | `html/02-rest-counting-down.html` |
| Rest bar, ready | `screens/03-rest-ready.png` | `html/03-rest-ready.html` |
| Rest bar, warm-up | `screens/04-rest-warmup.png` | `html/04-rest-warmup.html` |
| Finish summary | `screens/05-finish-summary.png` | `html/05-finish-summary.html` |
| Today | `screens/06-today.png` | `html/06-today.html` |
| Start sheet | `screens/07-start-sheet.png` | `html/07-start-sheet.html` |

The weights, dates and names in the mockups are sample data. The HTML files are static mockups, so copy their look, not their code.

Match the mockups closely. Use the existing tokens in `src/styles/tokens.css`. Dark theme only. Min touch target 44px.
Don't change Sauna, Settings, History or Progress this round. Keep it fully offline.
Work in the steps below and show me after each one. Update tests; run `npm test`, `check:offline` and `check:dod`.

## Step 1: Workout screen (WorkoutScreen, ExerciseCard, SetRow)
- Header: "‹ Today" in muted text, elapsed timer centred, Finish as a neutral secondary button (card background, hairline border), not orange.
- Under the header: template name, "X of Y sets" and a thin accent progress bar (working sets only).
- Remove the session note field from the top (it moves to the Finish screen).
- Exercise list: done exercises collapse to one row (green tick, name, top set e.g. "32.5 × 12"). The current exercise (first with unfinished sets) is an expanded card with an accent border. Upcoming exercises are collapsed rows (name, scheme, chevron) under an "UP NEXT" label. Tapping any row opens it.
- Exercise names are no longer orange. Orange is only for the current set and main actions.
- Pre-fill set rows to the template's target count (2 × 8–15 → 2 rows). Keep "+ Add set" as a small text button under the rows.
- Remove the PREVIOUS column. Show last time's values as placeholder text inside the kg and reps inputs (use previousBeside).
- Tapping the tick on a row with empty inputs logs the placeholder values. Typed values override them.
- The next unfinished set gets an accent set number and an accent border on its kg input.
- Remove the warm-up policy chip, warm-up suggestions and all helper text from the card.
- Add a small "Warm-up" button with a stopwatch icon in the card header, next to the ⋯ menu. Tapping it starts a warm-up rest using the warm-up rest guidance (default 1–2 min). It logs nothing and doesn't count toward sets. It can be tapped again for each warm-up.

## Step 2: Rest bar (RestBar, restTimer)
- Replace the full red bar with a dark bar fixed to the bottom. A thin progress line on top counts DOWN to the lower bound of the rest range: accent for working-set rest, muted grey for warm-up rest.
- Left: a small label ("Rest · Set 2 next", "Rest · Pull-up next", "Warm-up rest · not logged") and a big m:ss countdown. Right: "+30 s" and "Skip".
- At zero it turns green (--go): tick + "Ready", label "Rested m:ss" counting up, and a "Dismiss" button. Only one clock is ever visible.
- Stop using --rest red for the timer (keep it for delete actions).
- Keep the screen awake during a workout with the Screen Wake Lock API (feature-detect, fail silently).
- Play a short sound when rest reaches zero if the iPhone PWA allows it (Web Audio unlocked by the user's tap). Feature-detect, never crash. No vibration on iOS.

## Step 3: Progression tag + Finish summary
- Use the existing progressionHint(). When it applies to today's sets, show "↑ Go to {low} kg next time" (or "{low}–{high} kg" if they differ) in accent under the exercise name on its collapsed row.
- In the next session, show the hint on that exercise's card ("↑ Try {low} kg today").
- Finish (replace FinishSheet with a full screen): "{Template} done" with date and time range; three stat tiles (time, working sets, new bests); a "GO UP NEXT TIME" card (accent border) listing progression hints as "32.5 → 35 kg"; an exercise list with a green BEST badge where topSet() beat the previous best (show 2–3, then "+ N more"); an optional session note; an orange "Save workout" button; "‹ Back to workout".

## Step 4: Today screen + start sheet
- "Next up" card: the next template in rotation (the one after the most recently done template, in template order; the first if there's no history). Shows name, exercise count, "last trained {date}", an orange "Start {name}" button that starts it straight away with today's date, and a "Choose a different workout" text button that opens the start sheet.
- "This week" card: sessions and total time in the header, then a Mon–Sun row of circles (filled with a tick on training days, today outlined in accent).
- "Last session" card: template, date, "duration · sets · N new bests"; tapping it opens the session detail.
- Start sheet: templates first. The next-up template sits on top with an accent border and a "NEXT UP" badge; the others show "last done {date}"; Blank workout goes last. Move the date to a compact "Date — Today ▾" row at the bottom.

## Small fix vs the mockup
On the workout card the "Warm-up" button squeezes the rest text onto two lines ("Rest 90 s–3 / min"). Keep the button, but let the meta line wrap cleanly or shorten it (e.g. "2 × 8–15 · 90 s–3 min rest").
