// Phase 1 + 2 (and sauna) "definition of done", run end to end against the production build
// in the locally installed Google Chrome (throwaway profile, iPhone-sized window).
// Usage: npm run build && npm run check:dod
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4175;
const URL = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
};

function startServer() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && resolve(server));
    server.on('exit', (code) => reject(new Error(`preview exited (${code})`)));
  });
}
const stopServer = (server) =>
  new Promise((resolve) => {
    if (server.exitCode !== null) return resolve();
    server.once('exit', resolve);
    server.kill();
  });

const tmp = await mkdtemp(join(tmpdir(), 'gym-dod-'));
const server = await startServer();
const context = await chromium.launchPersistentContext(join(tmp, 'profile'), {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 390, height: 844 },
  acceptDownloads: true,
});
const page = context.pages()[0] ?? (await context.newPage());
page.on('dialog', (d) => d.accept());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const go = async (hash) => {
  await page.goto(URL + hash);
  await page.waitForTimeout(300);
};
/** The open exercise card (only one is open at a time). */
const card = (name) => page.locator('.exercise-card').filter({ has: page.locator('.exercise-name', { hasText: name }) });
/** A closed exercise: one tappable row. */
const exerciseRow = (name) => page.locator('.exercise-row', { hasText: name });
const setRows = (c) => c.locator('.set-row');
const exerciseCount = () => page.locator('.exercise-slot').count();
/** Opens a ••• / set-number menu and picks an action from it. */
async function menu(opener, action) {
  await opener.click();
  await page.locator('.action-sheet .action', { hasText: action }).click();
}
/** Opens an exercise by tapping its row (if it isn't the open card already). */
async function openExercise(name) {
  if ((await card(name).count()) === 0) await exerciseRow(name).first().click();
  await card(name).waitFor();
  return card(name);
}
/** "weight × reps" as typed in a row's inputs, "placeholder" for the greyed-out values. */
async function rowText(row, what = 'value') {
  const get = (field) =>
    row.locator(`input[aria-label$="${field}"]`).evaluate((el, w) => (w === 'value' ? el.value : el.placeholder) || '–', what);
  return `${await get('weight')} × ${await get('reps')}`;
}

const localDate = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Starts a workout; with `date` ("YYYY-MM-DD") it's logged as a past session. */
async function startWorkout(template, date) {
  await go('#/');
  await page.getByRole('button', { name: 'Choose a different workout' }).click();
  if (date) await page.locator('.sheet input[type="date"]').fill(date);
  await page.locator('.sheet .start-row', { hasText: template }).first().click();
  await page.locator('.workout-bar').waitFor();
}

/** Types a set into the next row (adding one if every row is done) and ticks it. */
async function logSet(name, weight, reps) {
  const c = await openExercise(name);
  if ((await c.locator('.set-row.is-next').count()) === 0) await c.getByRole('button', { name: '+ Add set' }).click();
  await c.locator('.set-row.is-next').waitFor();
  const index = await setRows(c).evaluateAll((rows) => rows.findIndex((r) => r.classList.contains('is-next')));
  const row = setRows(c).nth(index);
  await row.locator('input[aria-label$="weight"]').fill(String(weight));
  await row.locator('input[aria-label$="reps"]').fill(String(reps));
  await page.waitForTimeout(150);
  await row.locator('.done-button').click();
  await page.waitForTimeout(150);
}

/** Editing a finished session (no ✓): + Add set, then type into the new row. */
async function addSetEditing(name, weight, reps) {
  const c = await openExercise(name);
  const before = await setRows(c).count();
  await c.getByRole('button', { name: '+ Add set' }).click();
  const row = setRows(c).nth(before);
  await row.waitFor();
  await row.locator('input[aria-label$="weight"]').fill(String(weight));
  await row.locator('input[aria-label$="reps"]').fill(String(reps));
  await page.waitForTimeout(150);
}

/** Finishes (live) or saves (past) the workout from the Finish screen; times are left as suggested if not given. */
async function finish(start, end) {
  await page.locator('.workout-bar').getByRole('button', { name: /^(Finish|Save)$/ }).click();
  await page.locator('.finish-screen').waitFor();
  const times = page.locator('.finish-screen input[type="time"]');
  if ((start || end) && (await times.count()) === 0) await page.locator('.finish-when').click();
  if (start) await times.nth(0).fill(start);
  if (end) await times.nth(1).fill(end);
  await page.getByRole('button', { name: 'Save workout' }).click();
  await page.waitForURL(/#\/history\//);
  return (await page.locator('.detail-summary .stat-value').first().textContent()).trim();
}

const detailExercises = () => page.locator('.exercise-name-static').allTextContents();

try {
  await go('');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  check('installs for offline use (service worker active)', true);

  await go('#/settings');
  check('seeded: 3 templates and 32 exercises', (await page.locator('main').textContent()).includes('3 templates') &&
    (await page.locator('main').textContent()).includes('32 in library'));

  await go('#/');
  const firstNext = (await page.locator('.next-up').textContent()) ?? '';
  check('Today: next up is the first template before any history', firstNext.includes('Torso') && firstNext.includes('not done yet'), firstNext);

  // --- Torso (logged as yesterday, so later sessions always come after it) ---
  await startWorkout('Torso', localDate(1));
  check('Torso starts with 7 exercises', (await exerciseCount()) === 7);
  check('the first exercise is open, the rest are rows under "Up next"',
    (await page.locator('.exercise-card').count()) === 1 && (await card('Flat Dumbbell Bench Press').count()) === 1 &&
      (await page.locator('.up-next').count()) === 1 && (await page.locator('.exercise-row').count()) === 6);
  const firstBench = card('Flat Dumbbell Bench Press');
  check('rows pre-filled to the template’s target (2 × 5–12 → 2 rows)', (await setRows(firstBench).count()) === 2);
  await logSet('Flat Dumbbell Bench Press', 22.5, 8);
  await logSet('Flat Dumbbell Bench Press', 22.5, 9);
  await menu((await openExercise('Pull-up')).getByRole('button', { name: 'Pull-up options' }), 'Swap exercise');
  await page.locator('.sheet .list-row', { hasText: 'Lat Pulldown' }).first().click();
  await card('Lat Pulldown').waitFor();
  check('swap Pull-up → Lat Pulldown', (await card('Lat Pulldown').count()) === 1 && (await exerciseRow('Pull-up').count()) === 0);
  await logSet('Lat Pulldown', 39, 7);
  const carried = setRows(card('Lat Pulldown')).nth(1);
  const carriedValues = await rowText(carried, 'placeholder');
  check('the next row carries the working weight as a placeholder, reps left blank', carriedValues === '39 × –', carriedValues);
  await carried.locator('.done-button').click();
  const asksReps = await carried.locator('input[aria-label$="reps"]').evaluate((el) => el === document.activeElement);
  check('✓ with no reps to log asks for them instead', asksReps && (await rowText(carried)) === '– × –');
  await carried.locator('input[aria-label$="reps"]').fill('7');
  await page.waitForTimeout(150);
  await carried.locator('.done-button').click();
  await page.waitForTimeout(150);
  let duration = await finish('18:00', '19:12');
  check('past session (yesterday) saved with correct duration', duration === '1h 12m', duration);
  const torsoExercises = await detailExercises();
  check('skipped exercises left out', JSON.stringify(torsoExercises) === JSON.stringify(['Flat Dumbbell Bench Press', 'Lat Pulldown']), torsoExercises.join(', '));

  // --- Legs: next up after Torso, started straight from Today ---
  await go('#/');
  const legsNext = (await page.locator('.next-up').textContent()) ?? '';
  check('next up after Torso is Legs', legsNext.includes('Legs') && legsNext.includes('5 exercises'), legsNext);
  await page.getByRole('button', { name: 'Start Legs' }).click();
  await page.locator('.workout-bar').waitFor();
  check('"Start Legs" starts it straight away, dated today (gym timer running)',
    (await page.locator('.workout-title h1').textContent()) === 'Legs' && (await page.locator('[role="timer"][aria-label="Gym time"]').count()) === 1);
  check('Legs starts with 5 exercises', (await exerciseCount()) === 5);
  await logSet('Hack Squat', 80, 10);
  duration = await finish('07:00', '08:05');
  check('Legs finished with correct duration', duration === '1h 5m', duration);

  // --- Today after Legs: this week, last session; start sheet in rotation order ---
  await go('#/');
  const todayDot = page.locator('.week-day.is-today');
  check('this week: today is outlined and ticked after training', (await todayDot.count()) === 1 && (await todayDot.getAttribute('class')).includes('is-trained'));
  const lastCard = (await page.locator('.last-session-card').textContent()) ?? '';
  check('last session card: template, date, duration and sets', lastCard.includes('Legs ·') && lastCard.includes('1h 5m · 1 set'), lastCard);
  await page.getByRole('button', { name: 'Choose a different workout' }).click();
  const nextUpRow = (await page.locator('.sheet .start-next').textContent()) ?? '';
  const otherRows = await page.locator('.sheet .start-list .row-title').allTextContents();
  const torsoRow = (await page.locator('.sheet .start-row', { hasText: 'Torso' }).textContent()) ?? '';
  check('start sheet: next up on top with its badge, then rotation order, Blank last, last done dates',
    nextUpRow.includes('Shoulders & Arms') && nextUpRow.includes('Next up') &&
      JSON.stringify(otherRows) === '["Torso","Legs","Blank workout"]' && torsoRow.includes('last done'),
    `${nextUpRow} / ${otherRows.join(', ')} / ${torsoRow}`);
  check('start sheet: date row says Today', ((await page.locator('.sheet .start-date-value').textContent()) ?? '').trim() === 'Today');
  await page.locator('.sheet .start-row', { hasText: 'Shoulders & Arms' }).click();
  await page.locator('.workout-bar').waitFor();

  // --- Shoulders & Arms ---
  check('Shoulders & Arms starts with 8 exercises', (await exerciseCount()) === 8);
  await logSet('Seated Dumbbell Overhead Press', 17.5, 9);
  duration = await finish('20:00', '21:00');
  check('Shoulders & Arms finished with correct duration', duration === '1h', duration);

  // --- Torso again (live): last time's sets are the placeholders; ✓ on an empty row logs them ---
  await startWorkout('Torso');
  const bench = card('Flat Dumbbell Bench Press');
  const placeholders = [await rowText(setRows(bench).nth(0), 'placeholder'), await rowText(setRows(bench).nth(1), 'placeholder')];
  check('last session’s sets shown as placeholders', JSON.stringify(placeholders) === '["22.5 × 8","22.5 × 9"]', placeholders.join(', '));
  const nextRow = await bench.locator('.set-row.is-next .set-label').textContent();
  await setRows(bench).nth(0).locator('.done-button').click();
  await page.waitForTimeout(200);
  const ticked = await rowText(setRows(bench).nth(0));
  check('✓ on an empty row logs the placeholders; set 1 was the next set', ticked === '22.5 × 8' && nextRow === '1', ticked);
  const restBar = async () => `${await page.locator('.rest-bar-label').textContent()} | ${await page.locator('.rest-bar-clock').textContent()}`;
  const resting = await restBar();
  check('the rest bar counts down, saying what’s next', /^Rest · Set 2 next \| (3:00|2:59)$/.test(resting), resting);
  await page.getByRole('button', { name: '+30 s' }).click();
  const longer = await restBar();
  check('+30 s adds to the rest', /\| (3:30|3:29)$/.test(longer), longer);
  await setRows(bench).nth(1).locator('input[aria-label$="reps"]').fill('10');
  await page.waitForTimeout(150);
  await setRows(bench).nth(1).locator('.done-button').click();
  await page.waitForTimeout(300);
  const doneBench = (await exerciseRow('Flat Dumbbell Bench Press').textContent()) ?? '';
  check('typed reps override the placeholder; the done exercise collapses to its top set and the next one opens',
    doneBench.includes('22.5 × 10') && (await card('Dips').count()) === 1, doneBench);
  const count = (await page.locator('.workout-count').textContent()) ?? '';
  check('progress counts working sets: 2 of 15', count === '2 of 15 sets', count);

  // Typing reps and ticking ✓ on the last exercise, scrolled to the bottom, never moves the row (no mis-taps).
  const knee = await openExercise('Hanging Knee Raise');
  const kneeRow = setRows(knee).first();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const repsInput = kneeRow.locator('input[aria-label$="reps"]');
  const tops = new Set();
  const measure = async () => tops.add(Math.round((await repsInput.boundingBox()).y));
  await measure();
  await kneeRow.locator('input[aria-label$="weight"]').fill('5');
  await measure();
  for (const reps of ['0', '1', '12', '', '10']) {
    await repsInput.fill(reps);
    await page.waitForTimeout(100);
    await measure();
  }
  await kneeRow.locator('.done-button').click();
  await page.waitForTimeout(100);
  await measure();
  check('logging a set never shifts the row under your thumb', tops.size === 1, [...tops].join(', '));
  check('typing into a pre-filled row keeps one set (no duplicates)', (await knee.getByRole('button', { name: /^Set \d options$/ }).count()) === 1);
  await menu(knee.getByRole('button', { name: 'Set 1 options' }), 'Delete set');
  // Deleting is only in the set's menu, never next to the inputs.
  const bench2 = await openExercise('Flat Dumbbell Bench Press');
  await bench2.getByRole('button', { name: '+ Add set' }).click();
  await setRows(bench2).nth(2).locator('input[aria-label$="weight"]').fill('20');
  await page.waitForTimeout(150);
  await menu(bench2.getByRole('button', { name: 'Set 3 options' }), 'Delete set');
  await page.waitForTimeout(200);
  check('delete a set from its menu', (await bench2.getByRole('button', { name: /^Set \d options$/ }).count()) === 2 &&
    (await (await openExercise('Hanging Knee Raise')).getByRole('button', { name: /^Set \d options$/ }).count()) === 0);
  duration = await finish('21:10', '21:55');
  check('second Torso finished with correct duration', duration === '45m', duration);

  // --- Edit a past session ---
  await go('#/history');
  const historyRows = await page.locator('.history-row').count();
  check('history lists all 4 sessions', historyRows === 4, `${historyRows}`);
  await page.locator('.history-row', { hasText: 'Legs' }).click();
  await page.getByRole('link', { name: 'Edit session' }).click();
  await page.locator('.times-editor input[type="time"]').nth(1).fill('08:35');
  await addSetEditing('Hack Squat', 85, 8);
  await page.locator('.workout-bar').getByRole('button', { name: 'Done' }).click();
  await page.waitForURL(/#\/history\//);
  const edited = (await page.locator('.detail-summary .stat-value').first().textContent()).trim();
  const editedSets = (await page.locator('.detail-summary .stat-value').nth(1).textContent()).trim();
  check('edit past session: new end time and extra set saved', edited === '1h 35m' && editedSets === '2', `${edited}, ${editedSets} sets`);

  // ===== Phase 2 =====

  // --- Warm-up rest, and no "Go up" yet ---
  await startWorkout('Torso');
  const bench3 = card('Flat Dumbbell Bench Press');
  await bench3.getByRole('button', { name: 'Start warm-up rest timer' }).click();
  await page.waitForTimeout(200);
  const warmBar = `${await page.locator('.rest-bar-label').textContent()} | ${await page.locator('.rest-bar-clock').textContent()}`;
  check('Warm-up starts a warm-up rest (1–2 min) and logs nothing',
    /^Warm-up rest · not logged \| (1:00|0:59)$/.test(warmBar) && (await page.locator('.workout-count').textContent()) === '0 of 15 sets', warmBar);
  await page.getByRole('button', { name: 'Skip' }).click();
  check('Skip closes the rest bar', (await page.locator('.rest-bar').count()) === 0);
  // A rest that has run out: green "Ready" with how long you've rested, one clock only.
  await page.evaluate(() => {
    const key = 'gym-log.rest-timer';
    const state = JSON.parse(localStorage.getItem(key));
    const sessionId = location.hash.split('/').pop();
    state.timer = { sessionId, setId: 'x', startedAt: Date.now() - 200_000, text: '3–5 min', range: { min: 180, max: 300 } };
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.locator('.rest-bar.is-ready').waitFor();
  const readyBar = `${await page.locator('.rest-bar-label').textContent()} | ${await page.locator('.rest-bar-clock').textContent()}`;
  check('at zero the rest bar turns to "Ready", rested time counting up, with Dismiss',
    /^Rested 3:2\d · go when ready \| Ready$/.test(readyBar) && (await page.getByRole('button', { name: 'Dismiss' }).count()) === 1 &&
      (await page.locator('[role="timer"][aria-label="Rest left"]').count()) === 0, readyBar);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  check('no "Go up" hint when set 1 missed the top of the range', (await bench3.locator('.progression-hint').count()) === 0);
  await logSet('Flat Dumbbell Bench Press', 22.5, 12);
  await openExercise('Dips');
  const benchTag = (await exerciseRow('Flat Dumbbell Bench Press').locator('.exercise-row-goup').textContent()) ?? '';
  check('set 1 at the top of the range: "Go up" tag on the collapsed row', benchTag === '↑ Go to 25 kg next time', benchTag);
  await page.locator('.workout-bar').getByRole('button', { name: 'Finish' }).click();
  await page.locator('.finish-screen').waitFor();
  await page.locator('.best-badge').first().waitFor({ timeout: 3000 }).catch(() => {}); // bests load from the database
  const stats = await page.locator('.finish-stat').allTextContents();
  const goUpCard = (await page.locator('.finish-goup').textContent()) ?? '';
  const benchLine = (await page.locator('.finish-list-row', { hasText: 'Flat Dumbbell Bench Press' }).textContent()) ?? '';
  check('Finish screen: title, stats, Go up next time, BEST badge',
    (await page.locator('.finish-title').textContent()) === 'Torso done' &&
      JSON.stringify(stats.slice(1)) === '["1working sets","1new best"]' &&
      goUpCard.includes('Flat Dumbbell Bench Press') && goUpCard.includes('22.5 → 25 kg') &&
      benchLine.includes('Best') && benchLine.includes('22.5 × 12'),
    `${stats.join(', ')} / ${goUpCard} / ${benchLine}`);
  await page.getByRole('button', { name: 'Back to workout' }).click();
  check('Back to workout', (await page.locator('.workout-bar').count()) === 1);
  await page.locator('.workout-bar').getByRole('button', { name: 'Finish' }).click();
  await page.getByLabel('Session note').fill('Felt strong');
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Save workout' }).click();
  await page.waitForURL(/#\/history\//);
  check('session note from the Finish screen is saved', ((await page.locator('.detail-note').textContent()) ?? '') === 'Felt strong');

  // --- Progression hint next time ---
  await startWorkout('Torso');
  const goUp = (await card('Flat Dumbbell Bench Press').locator('.progression-hint').textContent()) ?? '';
  check('"Go up" hint after set 1 hit the top of the range', goUp === '↑ Try 25 kg today', goUp);
  await page.getByRole('button', { name: 'Discard workout' }).click();
  await page.waitForURL(/#\/$/);

  // --- Progress tab ---
  await go('#/progress');
  await page.locator('select').selectOption({ label: 'Flat Dumbbell Bench Press' });
  await page.locator('.recharts-line').first().waitFor();
  check('progress chart: top set and estimated 1RM', (await page.locator('.recharts-line').count()) === 2);
  const pr = (await page.locator('.pr-hero-value').textContent()) ?? '';
  check('personal record: heaviest set', pr.includes('22.5 kg each × 12'), pr);
  await page.getByRole('button', { name: 'Overall' }).click();
  await page.locator('.recharts-bar-rectangle').first().waitFor();
  check('weekly working sets and gym-time charts', (await page.locator('.chart-card').count()) === 2);

  // --- Training block ---
  await go('#/settings/block');
  await page.locator('input[type="date"]').fill(localDate(15));
  await go('#/');
  const blockText = (await page.locator('.block-card').textContent()) ?? '';
  check('training block shows the week number', blockText.includes('Week 3'), blockText);

  // --- Navigation: Gym · Sauna · Settings, each section with Today · History · Progress ---
  await go('#/');
  const bar = await page.locator('.tab').allTextContents();
  const gymTabs = await page.locator('.section-tab').allTextContents();
  await go('#/sauna/progress');
  const saunaOn = `${await page.locator('.tab.active').textContent()} / ${await page.locator('.section-tab.active').textContent()}`;
  check('navigation: Gym · Sauna · Settings, each with Today · History · Progress',
    bar.join() === 'Gym,Sauna,Settings' && gymTabs.join() === 'Today,History,Progress' && saunaOn === 'Sauna / Progress', saunaOn);

  // --- Sauna ---
  const saunaRows = () => page.locator('.history-row');
  const saveSheet = async (name) => {
    await page.getByRole('button', { name }).click();
    await page.locator('.sheet').waitFor({ state: 'detached' });
  };
  await go('#/sauna/history');
  check('sauna: 3 sample sessions seeded', (await saunaRows().count()) === 3);
  // The usual case: defaults from the last session, pick a feel score, save.
  await go('#/sauna');
  await page.getByRole('button', { name: /^Log sauna/ }).click();
  await page.getByRole('group', { name: 'Feel, 1 to 5' }).getByRole('button', { name: '4' }).click();
  await saveSheet('Save session');
  await go('#/sauna/history');
  check('sauna: logged from defaults in 3 taps', (await saunaRows().count()) === 4);
  await go('#/sauna');
  await page.getByRole('button', { name: /^Log sauna/ }).click();
  await page.getByLabel('Round 2 time left (m:ss)').pressSequentially('337');
  const preview = (await page.locator('.round-preview').textContent()) ?? '';
  await page.getByRole('group', { name: 'Feel, 1 to 5' }).getByRole('button', { name: '3' }).click();
  await page.getByLabel('Sauna note').fill('Busy tonight');
  await saveSheet('Save session');
  await go('#/sauna/history');
  const leftEarly = (await saunaRows().first().textContent()) ?? '';
  check('sauna: 3:37 left on 15 min = 11:23 done, shown as entered, with note',
    preview.includes('11:23 done') && leftEarly.includes('Round 2: 15 min, left with 3:37 remaining') && leftEarly.includes('Busy tonight'), preview);
  await go('#/sauna');
  await page.getByRole('button', { name: 'Log a skip' }).click();
  await page.locator('.sheet .chip', { hasText: 'Sauna closed' }).click();
  await saveSheet('Save skip');
  const saunaWeek = (await page.locator('.card-link .stats').textContent()) ?? '';
  check('sauna: skip logged and shown for the week', saunaWeek.includes('1 skipped'), saunaWeek);
  await go('#/sauna/progress');
  check('sauna: weekly chart, calendar and feel trend', (await page.locator('.chart-card').count()) === 3 && (await page.locator('.cal').count()) === 1);
  // Delete the left-early session from History (newest first: skip, then it).
  await go('#/sauna/history');
  await saunaRows().nth(1).click();
  await saveSheet('Delete session');
  check('sauna: deleted from history', (await saunaRows().count()) === 5);

  // --- Export JSON and CSV ---
  await go('#/settings/backup');
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save backup (JSON)' }).click(),
  ]);
  const backupPath = join(tmp, jsonDownload.suggestedFilename());
  await jsonDownload.saveAs(backupPath);
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  check('JSON backup exported', backup.format === 'gym-log-backup' && backup.data.sessions.length === 5, jsonDownload.suggestedFilename());
  check('sauna entries in the backup', backup.data.saunaEntries?.length === 5, `${backup.data.saunaEntries?.length}`);

  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export all sets (CSV)' }).click(),
  ]);
  const csvPath = join(tmp, csvDownload.suggestedFilename());
  await csvDownload.saveAs(csvPath);
  const csvLines = (await readFile(csvPath, 'utf8')).replace(/^﻿/, '').trim().split('\r\n');
  if (process.env.DEBUG) console.log(csvLines.join('\n'));
  check('CSV exported (header + 10 sets)', csvLines.length === 11 && csvLines[0] === 'date,session,exercise,set number,weight,reps,warm-up,note',
    `${csvLines.length - 1} rows`);

  // --- Wipe everything, then restore from the JSON backup ---
  await page.evaluate(
    () => new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('gym-log');
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    }),
  );
  await go('#/history');
  await page.reload();
  await page.waitForTimeout(500);
  check('data wiped', (await page.locator('.history-row').count()) === 0);
  await go('#/settings/backup');
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await page.locator('.notice').waitFor();
  check('restore from JSON', (await page.locator('.notice').textContent()).includes('Restored 5 sessions'));
  await go('#/history');
  check('history back after restore', (await page.locator('.history-row').count()) === 5);
  await go('#/');
  check('training block restored too', ((await page.locator('.block-card').textContent()) ?? '').includes('Week 3'));
  await go('#/sauna/history');
  check('sauna entries restored too', (await page.locator('.history-row').count()) === 5);
  await go('#/history');

  // --- Offline ---
  await stopServer(server);
  await page.reload();
  await page.locator('h1').waitFor({ timeout: 5000 });
  const offlineRows = await page.locator('.history-row').count();
  check('works offline with the server stopped', offlineRows === 5, `${offlineRows} sessions shown`);
  await page.locator('.history-row').first().click();
  await page.locator('.detail-summary').waitFor({ timeout: 3000 }).catch(() => {});
  check('session detail offline', (await page.locator('.detail-summary').count()) === 1);
  await go('#/progress');
  await page.locator('.recharts-surface').first().waitFor({ timeout: 5000 }).catch(() => {});
  check('progress charts offline', (await page.locator('.recharts-surface').count()) > 0);
  await go('#/sauna/progress');
  await page.locator('.recharts-surface').first().waitFor({ timeout: 5000 }).catch(() => {});
  check('sauna charts offline', (await page.locator('.recharts-surface').count()) > 0);

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (err) {
  check('unexpected error', false, err.message);
} finally {
  await context.close();
  await stopServer(server);
  await rm(tmp, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
