/**
 * The PVP tab, end to end in the real app: the replayed live source serves the committed duel
 * bodies through the same decoder the real tap uses, main keeps them in the account database, and
 * the tab lists them — then still lists them after a relaunch on the same user data. The unit
 * tests under `src/main/pvp` and `renderer/lib/pvp` prove each piece; only a launched window
 * proves they were wired to each other. A PVP tab that stays empty while the app has seen a duel
 * is the failure this file exists to catch.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const PVP_FIXTURE = path.join(desktopRoot, 'src', 'main', 'live-source', 'fixtures', 'pvp-duels-offline.json');

const PVP_TAB_INDEX = 6;

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
    throw new Error(`pvp.spec.mjs: could not find copy key "${key}" in ${filePath}`);
  }
  return match[1];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);

/** The bodies the replay serves, read from the same file main reads — so the assertions below
 *  follow the fixture rather than restating it. */
function fixtureDuels() {
  const { bodies } = JSON.parse(fs.readFileSync(PVP_FIXTURE, 'utf8'));
  return bodies.filter((body) => typeof body.venceu === 'boolean');
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

async function openPvp(page) {
  await navButton(page, PVP_TAB_INDEX).click();
  await page.waitForSelector('[data-testid="pvp-view"]', { timeout: 20_000 });
}

test.describe('PVP tab — every duel the replayed tap saw settle, kept and listed', () => {
  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;
  let launchEnv;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-pvp-'));
    const fixtureFile = path.join(runDir, 'account.json');
    fs.copyFileSync(ACCOUNT_OFFLINE_FIXTURE, fixtureFile);
    launchEnv = {
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: fixtureFile,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: path.join(runDir, 'user-data'),
    };
    ({ app, page } = await launchApp(launchEnv));
    await acceptConsent(page);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  test('the tab is named PVP and lists both fixture duels, newest first, with the film kept on the one that had it', async () => {
    await expect(navButton(page, PVP_TAB_INDEX)).toHaveAccessibleName(en('pvpNavLabel'));
    await openPvp(page);

    const duels = fixtureDuels();
    expect(duels).toHaveLength(2);
    const [filmed, filmless] = duels;

    const rows = page.getByTestId('pvp-duel-row');
    await expect(rows).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByTestId('pvp-history')).toHaveAttribute('data-state', 'duels');

    // The filmless duel was served last, so it is the newest and sits on top.
    await expect(rows.nth(0)).toHaveAttribute('data-film-stored', 'false');
    await expect(rows.nth(0).getByTestId('pvp-opponent')).toHaveText(filmless.defensor.nome);
    await expect(rows.nth(0).getByTestId('pvp-result')).toHaveText(en('pvpResultLost'));
    await expect(rows.nth(0).getByTestId('pvp-film')).toHaveText(en('pvpFilmMissing'));
    await expect(rows.nth(0).getByTestId('pvp-prize')).toHaveText(en('pvpPrizeLost'));

    await expect(rows.nth(1)).toHaveAttribute('data-film-stored', 'true');
    await expect(rows.nth(1).getByTestId('pvp-opponent')).toHaveText(filmed.defensor.nome);
    await expect(rows.nth(1).getByTestId('pvp-result')).toHaveText(en('pvpResultWon'));
    await expect(rows.nth(1).getByTestId('pvp-film')).toHaveText(en('pvpFilmStored'));
    await expect(rows.nth(1).getByTestId('pvp-phase')).toHaveText(String(filmed.fase));
    await expect(rows.nth(1).getByTestId('pvp-tier-floor')).toContainText(String(filmed.estado.fase));
    await expect(rows.nth(1).getByTestId('pvp-points')).toHaveText(`${filmed.pontos_antes} → ${filmed.pontos_depois}`);

    await expect(page.getByTestId('pvp-summary')).toHaveText('2 duels · 1 won · 1 films kept');
    await expect(page.getByTestId('pvp-quota')).toHaveText(
      `${filmless.duelos_restantes} of ${filmless.duelos_max} duels left`,
    );
  });

  test('the duels survive a relaunch on the same user data, and the replay serving them again adds nothing', async () => {
    await app.close();
    ({ app, page } = await launchApp(launchEnv));
    await openPvp(page);

    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByTestId('pvp-summary')).toHaveText('2 duels · 1 won · 1 films kept');
  });
});
