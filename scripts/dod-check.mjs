// Phase 1 + 2 "definition of done", run end to end against the production build
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
const loggedRows = (c) => c.locator('.set-row:not(.is-ghost)');

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
  await card('Pull-up').locator('.exercise-name').click();
  await page.locator('.sheet .list-row', { hasText: 'Lat Pulldown' }).first().click();
  await card('Lat Pulldown').waitFor();
  check('swap Pull-up → Lat Pulldown', (await card('Lat Pulldown').count()) === 1 && (await card('Pull-up').count()) === 0);
  await logSet('Lat Pulldown', 39, 7);
  await card('Lat Pulldown').getByRole('button', { name: 'Copy last set' }).click();
  await page.waitForTimeout(200);
  const pulldownSets = await loggedRows(card('Lat Pulldown')).count();
  check('copy last set', pulldownSets === 2, `${pulldownSets} sets`);
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

  // --- Torso again: last session's sets as ghosts, copy previous session's sets ---
  await startWorkout('Torso');
  const bench = card('Flat Dumbbell Bench Press');
  const ghosts = await bench.locator('.set-row.is-ghost').count();
  check('last session shows as ghost rows', ghosts === 2, `${ghosts} ghosts`);
  await bench.getByRole('button', { name: /Copy previous session/ }).click();
  await bench.locator('.set-row.is-ghost').first().waitFor({ state: 'detached' });
  await page.waitForTimeout(300);
  const copied = await loggedRows(bench).locator('input[aria-label="weight"]').evaluateAll((els) => els.map((e) => e.value));
  check('copy previous session’s sets', JSON.stringify(copied) === '["22.5","22.5"]', copied.join(', '));
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
  const warm = (await bench3.locator('.warmup-hint').textContent()) ?? '';
  check(
    'warm-up helper: 40 / 65 / 75% of last work weight, rounded to the step',
    warm.includes('from 22.5 last time') && warm.includes('10 × 6–10') && warm.includes('15 × 4–8') && warm.includes('17.5 × 2–4'),
    warm,
  );
  check('no "Go up" hint when set 1 missed the top of the range', (await bench3.locator('.progression-hint').count()) === 0);
  await logSet('Flat Dumbbell Bench Press', 22.5, 12);
  const compare = (await bench3.locator('.top-set-compare').textContent()) ?? '';
  check('top set compared with last session', compare.includes('beats last time (22.5 × 9)'), compare);
  await finish();

  // --- Progression hint next time ---
  await startWorkout('Torso');
  const hint = (await card('Flat Dumbbell Bench Press').locator('.progression-hint').textContent()) ?? '';
  check('"Go up" hint after set 1 hit the top of the range', hint.includes('hit 12 reps') && hint.includes('try 25 kg each'), hint);
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
