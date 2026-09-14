/**
 * The Optimizer tab, end to end in the real app: the tab, the worker, the snapshot's staleness
 * and the persistence of its controls. Every unit test in `renderer/lib/optimizer` and
 * `renderer/app/optimizer` proves a piece of this in isolation; only a launched Electron window
 * proves they were wired to each other, and that the worker chunk really does load and run over
 * `app://bundle/`.
 *
 * No package test-ids exist on the screens this draws from (`@bombfarm/team-plan/components`
 * carries none — the twelve web e2e specs select by role, heading text and `aria-label`, and so
 * does this file.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const RENDERER_OUT_CHUNKS = path.join(desktopRoot, 'renderer', 'out', '_next', 'static', 'chunks');

/** The stable prefix of the package's own main-thread-fallback sentence — not read from the
 *  package's copy module, which an `.mjs` spec cannot import; a `.spec.mjs` file lives outside
 *  the TypeScript program these packages are typechecked and bundled under. */
const MAIN_THREAD_FALLBACK_TEXT = /ran on the main page because the background worker was unavailable/i;
const OPTIMIZE_BUTTON = /^Build a team plan of /i;

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

// Desktop-owned strings, read from source the same way `i18n.spec.mjs`'s `readCopyValue` does —
// a `.mjs` smoke cannot import a `.ts` module without a build step, and hardcoding would drift
// silently from a reword. The team-plan package's own dictionary is a third file this spec does
// not read from; its headings are matched by stable regex instead, the same way the web's own
// e2e specs do.
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const PT_BR_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'pt-BR.ts');
const copyFileCache = new Map();

function readCopyValue(filePath, key) {
  let source = copyFileCache.get(filePath);
  if (source === undefined) {
    source = fs.readFileSync(filePath, 'utf8');
    copyFileCache.set(filePath, source);
  }
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) {
    throw new Error(`optimizer.spec.mjs: could not find copy key "${key}" in ${filePath}`);
  }
  return match[1];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);
const pt = (key) => readCopyValue(PT_BR_COPY_PATH, key);

async function launchApp(env) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

async function acceptConsent(page) {
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

function navButton(page, index) {
  return page.locator('nav[aria-label="Main"] button').nth(index);
}

const FORGE_TAB_INDEX = 4;
const OPTIMIZER_TAB_INDEX = 5;
const SETTINGS_TAB_INDEX = 7;

async function openOptimizer(page) {
  await navButton(page, OPTIMIZER_TAB_INDEX).click();
  await page.waitForSelector('[data-testid="optimizer-view"]', { timeout: 20_000 });
}

/** Resizes the real `BrowserWindow` — Playwright's Electron support has no viewport emulation —
 *  lifting the minimum first so a width below it can also be asked for, as `top-bar-density.spec.mjs`
 *  does. */
async function resize(app, page, width, height = 800) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(180);
}

/** Same idiom `auto-recompute.spec.mjs`'s `dropOneGearItemAtomically` uses: write a sibling file
 *  then rename over the original, so a tick reading mid-write can never observe a torn file. */
function bumpFirstHeroLevelAtomically(fixtureFilePath) {
  const payload = JSON.parse(fs.readFileSync(fixtureFilePath, 'utf8'));
  const hero = payload.heroes?.[0];
  if (!hero) throw new Error('optimizer.spec.mjs: fixture copy has no first hero to bump');
  hero.level = hero.level + 1;

  const tmpPath = `${fixtureFilePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload));
  fs.renameSync(tmpPath, fixtureFilePath);
}

async function waitForOptimizeDone(page, timeout = 120_000) {
  await expect(page.getByRole('button', { name: OPTIMIZE_BUTTON })).toBeEnabled({ timeout });
  await expect(page.getByTestId('team-plan-battle-load-card')).toBeVisible({ timeout });
}

test.describe('the export ships the worker chunk', () => {
  test('the renderer export carries a chunk the runner can load', () => {
    expect(fs.existsSync(RENDERER_OUT_CHUNKS), `${RENDERER_OUT_CHUNKS} does not exist — build the renderer first`).toBe(true);
    const files = fs.readdirSync(RENDERER_OUT_CHUNKS).filter((name) => name.endsWith('.js'));
    const carriesChunk = files.some((name) => {
      if (name.includes('team-plan-worker')) return true;
      const content = fs.readFileSync(path.join(RENDERER_OUT_CHUNKS, name), 'utf8');
      return content.includes('runTeamPlan');
    });
    expect(carriesChunk, 'no chunk under renderer/out/_next/static/chunks names or carries the team-plan worker').toBe(true);
  });
});

test.describe('the Optimizer tab, solved, held stale, remembered and relaunched', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;
  let fixtureFile;
  let userDataDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-optimizer-'));
    fixtureFile = path.join(runDir, 'account.json');
    fs.copyFileSync(ACCOUNT_OFFLINE_FIXTURE, fixtureFile);
    userDataDir = path.join(runDir, 'user-data');

    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: fixtureFile,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: userDataDir,
    }));
    await acceptConsent(page);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  // The checked-in fixture already carries eight heroes a sheet-inversion mismatch blocks (see
  // `account-roster.test.ts`), so only five of its thirteen ever reach the scope board — the
  // other eight are named in the left-out banner instead.
  test('opens with the setup panel, five heroes in Optimize, and the account\'s age', async () => {
    await openOptimizer(page);

    await expect(page.getByRole('region', { name: /Optimizer/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Search setup$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Hero scope$/i, level: 2 })).toBeVisible();

    const optimizeColumn = page.locator('[data-scope-column="optimize"]');
    await expect(optimizeColumn.locator('article')).toHaveCount(5);
    await expect(page.locator('[data-scope-column="donate"] article')).toHaveCount(0);
    await expect(page.locator('[data-scope-column="leaveAlone"] article')).toHaveCount(0);

    await expect(page.getByTestId('optimizer-left-out')).toBeVisible();
    await expect(page.getByTestId('account-refresh-age')).toContainText('account read');
  });

  test('Optimize renders results off the main thread', async () => {
    await page.evaluate(() => localStorage.setItem('bf-e2e-team-plan-max-eval', '300'));

    const optimizeButton = page.getByRole('button', { name: OPTIMIZE_BUTTON });
    await expect(optimizeButton).toBeEnabled();
    await optimizeButton.click();
    await waitForOptimizeDone(page);

    await expect(page.getByRole('heading', { name: /^Plan results$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Search summary$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Gain breakdown$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Per-hero changes/i, level: 2 })).toBeVisible();

    await expect(page.getByText(MAIN_THREAD_FALLBACK_TEXT)).toHaveCount(0);
  });

  // The shell unmounts a tab the player leaves. The rows they had open and how far down they
  // were are both state of the visit, and a Forge round trip is the visit's normal shape.
  test('the open rows and the scroll offset survive a trip to the Forge tab and back', async () => {
    // With the OS animations on: the panels animate open on mount, which is the case the offset
    // restore has to hold through, and a machine that reduces motion would pass this vacuously.
    // Motion reads the preference once, as the renderer loads, so the page is reloaded under the
    // emulation and the plan solved again. A hidden window (`BFC_HIDE_WINDOWS=1`) still passes
    // vacuously: no animation frame runs there, so the panel is at its full height at once.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
    await openOptimizer(page);
    await page.getByRole('button', { name: OPTIMIZE_BUTTON }).click();
    await waitForOptimizeDone(page);
    const heroRows = () =>
      page
        .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
        .locator('xpath=ancestor::section[1]')
        .getByRole('button', { name: /^Detailed breakdown for/i });

    await expect(heroRows().first()).toHaveAttribute('aria-expanded', 'true');
    await heroRows().first().click();
    await heroRows().nth(1).click();
    await expect(heroRows().first()).toHaveAttribute('aria-expanded', 'false');
    await expect(heroRows().nth(1)).toHaveAttribute('aria-expanded', 'true');
    // The second row's panel animates open over 0.4s; the offset is read once it has settled.
    await page.waitForTimeout(600);

    const scrolledTo = await page.evaluate(() => {
      const main = document.querySelector('main');
      main.scrollTop = main.scrollHeight;
      return main.scrollTop;
    });
    expect(scrolledTo).toBeGreaterThan(0);

    await navButton(page, FORGE_TAB_INDEX).click();
    await page.waitForSelector('[data-testid="forge-view"]', { timeout: 20_000 });
    await expect(page.getByTestId('optimizer-view')).toHaveCount(0);

    await openOptimizer(page);
    await expect(heroRows().first()).toHaveAttribute('aria-expanded', 'false');
    await expect(heroRows().nth(1)).toHaveAttribute('aria-expanded', 'true');
    // The open panel animates in again on mount, so the offset is put back as the page grows and
    // is only expected once it has settled — a single set on the first frame would be clamped.
    await expect.poll(() => page.evaluate(() => document.querySelector('main').scrollTop), { timeout: 5_000 }).toBe(
      scrolledTo,
    );

    // Back to the default before the tests below read the first row.
    await heroRows().nth(1).click();
    await heroRows().first().click();
    await page.evaluate(() => {
      document.querySelector('main').scrollTop = 0;
    });
  });

  test('a live tick changes nothing; Refresh labels the plan stale', async () => {
    // The package's own stale-plan sentence — inlined the same way the main-thread-fallback
    // sentence above is, since the package's copy module lives outside what a `.mjs` spec reads.
    const STALE_NOTICE_TEXT = /Inputs changed since this plan was computed/i;

    bumpFirstHeroLevelAtomically(fixtureFile);
    // Twelve 50ms fixture ticks — long enough for the reader to pick up the rewrite, per the
    // same reasoning `auto-recompute.spec.mjs` measured.
    await page.waitForTimeout(600);

    await expect(page.getByRole('heading', { name: /^Plan results$/i, level: 2 })).toBeVisible();
    await expect(page.getByText(STALE_NOTICE_TEXT)).toHaveCount(0);
    await expect(page.getByTestId('account-refresh-age')).toContainText('out of date');

    await page.getByTestId('account-refresh').click();

    await expect(page.getByText(STALE_NOTICE_TEXT)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /^Plan results$/i, level: 2 })).toBeVisible();
  });

  test('Portuguese, per-card scope change clears the plan, and the choice survives a relaunch', async () => {
    await navButton(page, SETTINGS_TAB_INDEX).click();
    const select = page.getByRole('combobox', { name: en('settingsLanguageLabel') });
    await expect(select).toBeVisible({ timeout: 10_000 });
    await select.click();
    await page.getByRole('option', { name: en('settingsLanguageOptionPortuguese') }).click();

    await navButton(page, OPTIMIZER_TAB_INDEX).click();
    await expect(navButton(page, OPTIMIZER_TAB_INDEX)).toHaveAccessibleName(pt('optimizerNavLabel'));
    await expect(page.getByRole('heading', { name: /^Configurar busca$/i, level: 2 })).toBeVisible();

    await resize(app, page, 720, 800);

    const scopeHeading = page.getByRole('heading', { name: /^Escopo por herói$/i, level: 2 });
    const scopeSection = scopeHeading.locator('xpath=ancestor::section[1]');
    const firstCardSelect = scopeSection.getByRole('combobox').first();
    await firstCardSelect.click();
    await page.getByRole('option', { name: 'Doar', exact: true }).click();

    await expect(page.getByRole('heading', { name: /^Resultados do plano$/i, level: 2 })).toHaveCount(0);
    await expect(page.locator('[data-scope-column="donate"] article')).toHaveCount(1);

    // The runner still holds the plan the scope change cleared; a trip to another tab and back
    // must not hand it to the screen again.
    await navButton(page, FORGE_TAB_INDEX).click();
    await page.waitForSelector('[data-testid="forge-view"]', { timeout: 20_000 });
    await openOptimizer(page);
    await expect(page.getByRole('heading', { name: /^Escopo por herói$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Resultados do plano$/i, level: 2 })).toHaveCount(0);

    await resize(app, page, 1280, 800);
    await app.close();

    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: fixtureFile,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: userDataDir,
    }));
    // Consent and the Portuguese language choice were both already persisted to the same
    // profile, so no modal and no re-switch is expected here.
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
    await openOptimizer(page);
    await expect(page.locator('[data-scope-column="donate"] article')).toHaveCount(1);
  });

  test('forcing the worker factory to throw runs the same search on the main thread, labelled', async () => {
    // Switches back to English first — the fallback sentence and the optimize button are asserted in
    // one language rather than duplicating every regex for both; which language is active has
    // nothing to do with the worker-fallback mechanism under test here. This continues on the app
    // `Portuguese, per-card scope change…` relaunched — no relaunch of its own is needed, since
    // the worker knob is read live by `createOptimizerWorker()` on the next press.
    await navButton(page, SETTINGS_TAB_INDEX).click();
    const select = page.getByRole('combobox', { name: pt('settingsLanguageLabel') });
    await expect(select).toBeVisible({ timeout: 10_000 });
    await select.click();
    await page.getByRole('option', { name: pt('settingsLanguageOptionEnglish') }).click();
    await navButton(page, OPTIMIZER_TAB_INDEX).click();
    await expect(navButton(page, OPTIMIZER_TAB_INDEX)).toHaveAccessibleName(en('optimizerNavLabel'));

    await page.evaluate(() => {
      localStorage.setItem('bfc-e2e-optimizer-no-worker', '1');
      localStorage.setItem('bf-e2e-team-plan-max-eval', '300');
    });

    const optimizeButton = page.getByRole('button', { name: OPTIMIZE_BUTTON });
    await expect(optimizeButton).toBeEnabled({ timeout: 15_000 });
    await optimizeButton.click();
    await waitForOptimizeDone(page);

    await expect(page.getByText(MAIN_THREAD_FALLBACK_TEXT)).toBeVisible();
  });

  test('a corrupt stored view reads as the defaults', async () => {
    await page.evaluate(() => localStorage.setItem('bfc-optimizer-view', '{not json'));
    await app.close();

    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: fixtureFile,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: userDataDir,
    }));
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
    await openOptimizer(page);

    await expect(page.locator('[data-scope-column="optimize"] article')).toHaveCount(5);
    await expect(page.getByTestId('optimizer-view').locator('[role="alert"]')).toHaveCount(0);
  });
});

test.describe('a hero whose spent points the account read could not recover', () => {
  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;
  let fixtureFile;

  // The fixture already carries eight heroes a sheet-inversion mismatch blocks (see
  // `account-roster.test.ts`) — deleting Rowan's `stats` block adds a ninth, through the other
  // mechanism this fix also has to catch, leaving four in Optimize rather than the usual five.
  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-optimizer-left-out-'));
    fixtureFile = path.join(runDir, 'account.json');

    const payload = JSON.parse(fs.readFileSync(ACCOUNT_OFFLINE_FIXTURE, 'utf8'));
    const blockedHero = payload.heroes.find((hero) => hero.id === '71038');
    if (!blockedHero) throw new Error('optimizer.spec.mjs: fixture has no hero 71038 to block');
    delete blockedHero.stats;
    fs.writeFileSync(fixtureFile, JSON.stringify(payload));

    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: fixtureFile,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: path.join(runDir, 'user-data'),
    }));
    await acceptConsent(page);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  test('the banner names the hero, the scope board omits it, and Optimize still solves', async () => {
    await openOptimizer(page);

    const banner = page.getByTestId('optimizer-left-out');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Rowan');
    await expect(banner).toContainText(en('optimizerLeftOutTitle'));

    const optimizeColumn = page.locator('[data-scope-column="optimize"]');
    await expect(optimizeColumn.locator('article')).toHaveCount(4);
    await expect(optimizeColumn.getByText('Rowan')).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('bf-e2e-team-plan-max-eval', '300'));
    const optimizeButton = page.getByRole('button', { name: OPTIMIZE_BUTTON });
    await expect(optimizeButton).toBeEnabled();
    await optimizeButton.click();
    await waitForOptimizeDone(page);

    await expect(page.getByRole('heading', { name: /^Plan results$/i, level: 2 })).toBeVisible();
  });
});
