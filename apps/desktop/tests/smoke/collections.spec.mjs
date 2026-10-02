/**
 * The Collections tab, end to end in the real app: the replayed live source serves the committed
 * synthetic Collections body through the same decoder the real tap uses, main keeps it in the
 * account database, and the tab draws the ten bonus tiles and a row for every book — then opens
 * one book's detail. The unit tests under `renderer/app/collections` and `renderer/lib/collections`
 * prove each piece; only a launched window proves they were wired to each other. A Collections tab
 * that stays empty while the app has been served the state is the failure this file exists to
 * catch.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const COLLECTIONS_FIXTURE = path.join(
  desktopRoot,
  '..',
  '..',
  'packages',
  'game-api',
  'src',
  '__fixtures__',
  'collections-state.json',
);

const COLLECTIONS_TAB_INDEX = 8;

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const copyFileCache = new Map();

function readCopyValue(filePath, key) {
  let source = copyFileCache.get(filePath);
  if (source === undefined) {
    source = fs.readFileSync(filePath, 'utf8');
    copyFileCache.set(filePath, source);
  }
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) {
    throw new Error(`collections.spec.mjs: could not find copy key "${key}" in ${filePath}`);
  }
  return match[1];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);

/** The body the replay serves, read from the file main reads — so the assertions below follow the
 *  fixture rather than restating it. */
function fixtureBody() {
  return JSON.parse(fs.readFileSync(COLLECTIONS_FIXTURE, 'utf8'));
}

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

/** Every test opens the tab itself: a retried test runs in a fresh worker whose `beforeAll`
 *  relaunched the app on the Live tab, so nothing may lean on the previous test's navigation. */
async function openCollections(page) {
  await navButton(page, COLLECTIONS_TAB_INDEX).click();
  await page.waitForSelector('[data-testid="collections-view"]', { timeout: 20_000 });
}

test.describe('Collections tab — the state the replayed tap served, drawn as bonuses and books', () => {
  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-collections-'));
    const fixtureFile = path.join(runDir, 'account.json');
    fs.copyFileSync(ACCOUNT_OFFLINE_FIXTURE, fixtureFile);
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

  test('the tab is named Collections and draws the ten bonus tiles and a row for every book', async () => {
    await expect(navButton(page, COLLECTIONS_TAB_INDEX)).toHaveAccessibleName(en('collectionsNavLabel'));
    await openCollections(page);

    const { sets } = fixtureBody();
    expect(sets).toHaveLength(30);

    await expect(page.getByTestId('collections-axis')).toHaveCount(10, { timeout: 30_000 });
    await expect(page.getByTestId('collections-book-row')).toHaveCount(sets.length);
  });

  test('selecting a book opens its detail with the six rarity pages, and closing it puts the list back', async () => {
    await openCollections(page);
    const { sets } = fixtureBody();
    await expect(page.getByTestId('collections-book-row')).toHaveCount(sets.length, { timeout: 30_000 });
    await expect(page.getByTestId('collections-book-detail')).toHaveCount(0);

    const row = page.getByTestId('collections-book-row').first();
    const code = await row.getAttribute('data-set');
    await row.click();

    const detail = page.getByTestId('collections-book-detail');
    await expect(detail).toBeVisible();
    await expect(detail).toHaveAttribute('data-set', code);
    await expect(detail.getByTestId('collections-detail-page')).toHaveCount(6);

    await page.getByTestId('collections-detail-close').click();
    await expect(detail).toHaveCount(0);
  });
});
