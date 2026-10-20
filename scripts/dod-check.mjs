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
const card = (name) => page.locator('.exercise-card').filter({ has: page.locator('.exercise-name', { hasText: name }) });
const loggedRows = (c) => c.locator('.set-row');
/** Opens a ••• / set-number menu and picks an action from it. */
async function menu(opener, action) {
  await opener.click();
  await page.locator('.action-sheet .action', { hasText: action }).click();
}

const localDate = (daysAgo) => {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Starts a workout; with `date` ("YYYY-MM-DD") it's logged as a past session. */
async function startWorkout(template, date) {
  await go('#/');
  await page.getByRole('button', { name: 'Start workout' }).click();
  if (date) await page.locator('.sheet input[type="date"]').fill(date);
  await page.locator('.sheet .list-row', { hasText: template }).click();
  await page.locator('.workout-bar').waitFor();
}

async function logSet(name, weight, reps) {
  const c = card(name);
  const before = await loggedRows(c).count();
  await c.getByRole('button', { name: '+ Add set' }).click();
  // Wait for the new row before typing, or we'd type into the previous set.
  const row = loggedRows(c).nth(before);
  await row.waitFor();
  await row.locator('input[aria-label="weight"]').fill(String(weight));
  await row.locator('input[aria-label="reps"]').fill(String(reps));
  await page.waitForTimeout(150);
}

/** Finishes (live) or saves (past) the workout; times are left as suggested if not given. */
async function finish(start, end) {
  await page.locator('.workout-bar').getByRole('button', { name: /^(Finish|Save)$/ }).click();
  const times = page.locator('.sheet input[type="time"]');
  if (start) await times.nth(0).fill(start);
  if (end) await times.nth(1).fill(end);
  await page.getByRole('button', { name: /^(Finish workout|Save session)$/ }).click();
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

  // --- Torso (logged as yesterday, so later sessions always come after it) ---
  await startWorkout('Torso', localDate(1));
  check('Torso starts with 7 exercises', (await page.locator('.exercise-card').count()) === 7);
  await logSet('Flat Dumbbell Bench Press', 22.5, 8);
  await logSet('Flat Dumbbell Bench Press', 22.5, 9);
  await menu(card('Pull-up').getByRole('button', { name: 'Pull-up options' }), 'Swap exercise');
  await page.locator('.sheet .list-row', { hasText: 'Lat Pulldown' }).first().click();
  await card('Lat Pulldown').waitFor();
  check('swap Pull-up → Lat Pulldown', (await card('Lat Pulldown').count()) === 1 && (await card('Pull-up').count()) === 0);
  await logSet('Lat Pulldown', 39, 7);
  await card('Lat Pulldown').getByRole('button', { name: '+ Add set' }).click();
  await loggedRows(card('Lat Pulldown')).nth(1).waitFor();
  const carried = loggedRows(card('Lat Pulldown')).nth(1);
  const carriedValues = `${await carried.locator('input[aria-label="weight"]').inputValue()} × ${await carried.locator('input[aria-label="reps"]').inputValue() || '–'}`;
  check('+ Add set keeps the working weight, reps left blank', carriedValues === '39 × –', carriedValues);
  await carried.locator('input[aria-label="reps"]').fill('7');
  await page.waitForTimeout(150);
  let duration = await finish('18:00', '19:12');
  check('past session (yesterday) saved with correct duration', duration === '1h 12m', duration);
  const torsoExercises = await detailExercises();
  check('skipped exercises left out', JSON.stringify(torsoExercises) === JSON.stringify(['Flat Dumbbell Bench Press', 'Lat Pulldown']), torsoExercises.join(', '));

  // --- Legs ---
  await startWorkout('Legs');
  check('Legs starts with 5 exercises', (await page.locator('.exercise-card').count()) === 5);
  await logSet('Hack Squat', 80, 10);
  duration = await finish('07:00', '08:05');
  check('Legs finished with correct duration', duration === '1h 5m', duration);

  // --- Shoulders & Arms ---
  await startWorkout('Shoulders & Arms');
  check('Shoulders & Arms starts with 8 exercises', (await page.locator('.exercise-card').count()) === 8);
  await logSet('Seated Dumbbell Overhead Press', 17.5, 9);
  duration = await finish('20:00', '21:00');
  check('Shoulders & Arms finished with correct duration', duration === '1h', duration);

  // --- Torso again: no rows until you add them; last session's sets sit beside them in Previous ---
  await startWorkout('Torso');
  const bench = card('Flat Dumbbell Bench Press');
  check('no sets listed until added (no ghost rows)', (await loggedRows(bench).count()) === 0);
  await logSet('Flat Dumbbell Bench Press', 22.5, 8);
  await logSet('Flat Dumbbell Bench Press', 22.5, 9);
  const previousColumn = await bench.locator('.set-prev').allTextContents();
  check('Previous column shows last session’s matching sets', JSON.stringify(previousColumn) === '["22.5 × 8","22.5 × 9"]', previousColumn.join(', '));
  // Typing reps and ticking ✓ on the last exercise, scrolled to the bottom, never moves the row (no mis-taps).
  const lastCard = page.locator('.exercise-card').last();
  await lastCard.getByRole('button', { name: '+ Add set' }).click();
  const lastRow = loggedRows(lastCard).last();
  await lastRow.waitFor();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const repsInput = lastRow.locator('input[aria-label="reps"]');
  const tops = new Set();
  const measure = async () => tops.add(Math.round((await repsInput.boundingBox()).y));
  await measure();
  await lastRow.locator('input[aria-label="weight"]').fill('31');
  await measure();
  for (const reps of ['0', '1', '12', '', '10']) {
    await repsInput.fill(reps);
    await page.waitForTimeout(100);
    await measure();
  }
  await lastRow.locator('.done-button').click();
  await page.waitForTimeout(100);
  await measure();
  check('logging a set never shifts the row under your thumb', tops.size === 1, [...tops].join(', '));
  await menu(lastRow.getByRole('button', { name: /options$/ }), 'Delete set');
  // Deleting is only in the set's menu, never next to the inputs.
  await bench.getByRole('button', { name: '+ Add set' }).click();
  await loggedRows(bench).nth(2).waitFor();
  await menu(loggedRows(bench).nth(2).getByRole('button', { name: 'Set 3 options' }), 'Delete set');
  await page.waitForTimeout(200);
  check('delete a set from its menu', (await loggedRows(bench).count()) === 2 && (await loggedRows(lastCard).count()) === 0);
  duration = await finish('21:10', '21:55');
  check('second Torso finished with correct duration', duration === '45m', duration);

  // --- Edit a past session ---
  await go('#/history');
  const historyRows = await page.locator('.history-row').count();
  check('history lists all 4 sessions', historyRows === 4, `${historyRows}`);
  await page.locator('.history-row', { hasText: 'Legs' }).click();
  await page.getByRole('link', { name: 'Edit session' }).click();
  await page.locator('.times-editor input[type="time"]').nth(1).fill('08:35');
  await logSet('Hack Squat', 85, 8);
  await page.locator('.workout-bar').getByRole('button', { name: 'Done' }).click();
  await page.waitForURL(/#\/history\//);
  const edited = (await page.locator('.detail-summary .stat-value').first().textContent()).trim();
  const editedSets = (await page.locator('.detail-summary .stat-value').nth(1).textContent()).trim();
  check('edit past session: new end time and extra set saved', edited === '1h 35m' && editedSets === '2', `${edited}, ${editedSets} sets`);

  // ===== Phase 2 =====

  // --- Warm-up helper and top-set comparison ---
  await startWorkout('Torso');
  const bench3 = card('Flat Dumbbell Bench Press');
  const warmChip = (await bench3.locator('.warmup-hint').textContent()) ?? '';
  await bench3.locator('.warmup-hint').click();
  const warm = (await page.locator('.action-sheet').textContent()) ?? '';
  await page.locator('.action-sheet').getByRole('button', { name: 'Done' }).click();
  check(
    'warm-up helper: 40 / 65 / 75% of last work weight, rounded to the step (chip, details on tap)',
    warmChip.includes('10 · 15 · 17.5') && warm.includes('from 22.5 kg each') &&
      warm.includes('10 kg each× 6–1040%') && warm.includes('15 kg each× 4–865%') && warm.includes('17.5 kg each× 2–475%'),
    `${warmChip} / ${warm}`,
  );
  const toBeat = (await bench3.locator('.top-set-compare').textContent()) ?? '';
  check('top set to beat shown before logging', toBeat.includes('Top set to beat · 22.5 × 9'), toBeat);
  check('no "Go up" hint when set 1 missed the top of the range', (await bench3.locator('.progression-hint').count()) === 0);
  await logSet('Flat Dumbbell Bench Press', 22.5, 12);
  const compare = (await bench3.locator('.top-set-compare').textContent()) ?? '';
  check('top set compared with last session', compare.includes('Beat last time · 22.5 × 12 vs 22.5 × 9'), compare);
  await finish();

  // --- Progression hint next time ---
  await startWorkout('Torso');
  const goUpChip = card('Flat Dumbbell Bench Press').locator('.progression-hint');
  const chipText = (await goUpChip.textContent()) ?? '';
  await goUpChip.click();
  const hint = (await page.locator('.action-sheet').textContent()) ?? '';
  await page.locator('.action-sheet').getByRole('button', { name: 'Done' }).click();
  check('"Go up" chip after set 1 hit the top of the range, reasoning on tap',
    chipText === '↑ Try 25 kg' && hint.includes('hit 12 reps') && hint.includes('try 25 kg each'), `${chipText} / ${hint}`);
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
