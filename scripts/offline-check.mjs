// Verifies the built app works offline: serve dist/, load it once so the
// service worker installs, stop the server, reload, and check the app still runs.
// Uses the locally installed Google Chrome with a throwaway profile.
// Usage: npm run build && npm run check:offline
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const PORT = 4174;
const URL = `http://localhost:${PORT}/`;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function startServer() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && resolve(server));
    server.on('exit', (code) => reject(new Error(`preview exited (${code})`)));
  });
}

const stopServer = (server) =>
  new Promise((resolve) => {
    server.once('exit', resolve);
    server.kill();
  });

const profile = await mkdtemp(join(tmpdir(), 'gym-offline-'));
const server = await startServer();
const context = await chromium.launchPersistentContext(profile, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 375, height: 812 },
});
let failed = false;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failed = true;
};

try {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(URL);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  check('service worker installed and controlling the page', true);

  const manifest = await page.evaluate(async () => {
    const res = await fetch(document.querySelector('link[rel=manifest]').href);
    return res.json();
  });
  check('manifest is valid', manifest.name === 'Gym Log' && manifest.display === 'standalone' && manifest.icons.length >= 3);

  await stopServer(server);
  const down = await fetch(URL).then(() => false, () => true);
  check('server stopped', down);

  await page.reload();
  await page.waitForSelector('h1', { timeout: 5000 });
  check('app loads offline', (await page.textContent('h1')) === 'Gym');

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Settings', null, { timeout: 3000 });
  check('Settings opens offline', true);

  if (process.argv.includes('--screenshot')) {
    await page.goto(URL + '#/');
    await page.screenshot({ path: process.argv[process.argv.indexOf('--screenshot') + 1] });
  }
} catch (err) {
  check('unexpected error', false, err.message);
} finally {
  await context.close();
  if (server.exitCode === null) await stopServer(server);
  await rm(profile, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
