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
function fixtureBodies() {
  const { bodies } = JSON.parse(fs.readFileSync(PVP_FIXTURE, 'utf8'));
  return {
    duels: bodies.filter((body) => typeof body.venceu === 'boolean'),
    state: bodies.find((body) => typeof body.pontos === 'number' && Array.isArray(body.squad)),
    ranking: bodies.find((body) => body.by === 'pvp'),
  };
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

    const { duels } = fixtureBodies();
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
    await expect(page.getByTestId('pvp-prize')).toHaveCount(0);

    await expect(rows.nth(1)).toHaveAttribute('data-film-stored', 'true');
    await expect(rows.nth(1).getByTestId('pvp-opponent')).toHaveText(filmed.defensor.nome);
    await expect(rows.nth(1).getByTestId('pvp-result')).toHaveText(en('pvpResultWon'));
    await expect(rows.nth(1).getByTestId('pvp-open-replay')).toHaveText(en('pvpFilmReplay'));
    await expect(rows.nth(1).getByTestId('pvp-phase')).toHaveText(
      `${filmed.fase} (T${filmed.estado.faixa_num}, floor ${filmed.estado.fase})`,
    );
    await expect(rows.nth(1).getByTestId('pvp-points')).toHaveText(`${filmed.pontos_antes} → ${filmed.pontos_depois}`);

    await expect(page.getByTestId('pvp-summary')).toHaveText('2 duels · 1 won · 1 films kept');
  });

  test('the standing section shows the last state poll and the ranking the replay served', async () => {
    const { state, ranking } = fixtureBodies();
    expect(state).toBeDefined();
    expect(ranking).toBeDefined();
    await openPvp(page);

    await expect(page.getByTestId('pvp-standing')).toHaveAttribute('data-state', 'read');
    // The tile is its label and its figure; the figure is the number alone, never the wire's `r3`.
    await expect(page.getByTestId('pvp-standing-tier')).toHaveText(`${en('pvpStandingTier')}${state.faixa_num}`);
    await expect(page.getByTestId('pvp-standing-points')).toContainText(`${state.pontos} / ${state.faixa_prox}`);
    await expect(page.getByTestId('pvp-standing-duels')).toContainText(`${state.duelos_max - state.duelos_usados} of ${state.duelos_max}`);
    await expect(page.getByTestId('pvp-standing-slots')).toContainText(`${state.slots} of ${state.slots_max}`);
    await expect(page.getByTestId('pvp-standing-rank')).toContainText(`#${ranking.me.rank}`);
  });

  test('the opponent filter narrows the list to one rival and prints the record against them; the result filter narrows by outcome', async () => {
    const { duels } = fixtureBodies();
    const [filmed, filmless] = duels;
    await openPvp(page);
    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(2, { timeout: 20_000 });

    await page.getByRole('combobox', { name: en('pvpFilterOpponentLabel') }).click();
    await page.getByRole('option', { name: filmed.defensor.nome }).click();
    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(1);
    await expect(page.getByTestId('pvp-opponent')).toHaveText(filmed.defensor.nome);
    const rivalry = page.getByTestId('pvp-head-to-head');
    await expect(rivalry).toContainText(`Against ${filmed.defensor.nome}`);
    await expect(rivalry.getByTestId('pvp-head-to-head-duels')).toHaveText(`${en('pvpHeadToHeadDuels')}1`);
    await expect(rivalry.getByTestId('pvp-head-to-head-won')).toHaveText(`${en('pvpHeadToHeadWon')}1`);
    await expect(rivalry.getByTestId('pvp-head-to-head-lost')).toHaveText(`${en('pvpHeadToHeadLost')}0`);
    await expect(page.getByTestId('pvp-filter-count')).toHaveText('1 of 2');

    await page.getByRole('group', { name: en('pvpFilterResultLabel') }).getByRole('button', { name: en('pvpResultLost') }).click();
    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(0);
    await expect(page.getByTestId('pvp-filter-empty')).toBeVisible();
    await expect(page.getByTestId('pvp-filter-count')).toHaveText('0 of 2');
    // The record strip is the rivalry, not the rows under it: it does not change with the outcome filter.
    await expect(rivalry.getByTestId('pvp-head-to-head-won')).toHaveText(`${en('pvpHeadToHeadWon')}1`);
    await expect(rivalry.getByTestId('pvp-head-to-head-lost')).toHaveText(`${en('pvpHeadToHeadLost')}0`);

    await page.getByRole('combobox', { name: en('pvpFilterOpponentLabel') }).click();
    await page.getByRole('option', { name: en('pvpFilterOpponentAll') }).click();
    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(1);
    await expect(page.getByTestId('pvp-opponent')).toHaveText(filmless.defensor.nome);
    await expect(page.getByTestId('pvp-head-to-head')).toHaveCount(0);

    await page.getByRole('group', { name: en('pvpFilterResultLabel') }).getByRole('button', { name: en('pvpFilterResultAll') }).click();
    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(2);
  });

  test('the standing draws the tier meter and the points trend; the rivals panel, the squad column and the replay follow the fixture', async () => {
    const { duels, state } = fixtureBodies();
    const [filmed] = duels;
    await openPvp(page);
    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(2, { timeout: 20_000 });

    // A: the meter and its sentence, from the standing the replay served.
    await expect(page.getByTestId('pvp-tier-meter')).toBeVisible();
    const winsToGo = Math.ceil((state.faixa_prox - state.pontos) / 5);
    await expect(page.getByTestId('pvp-tier-eta')).toContainText(`${winsToGo} wins`);
    // B: two duels are enough for the trend to draw, with one mark per result.
    await expect(page.getByTestId('pvp-points-trend')).toHaveAttribute('data-state', 'drawn');
    await expect(page.locator('[data-sparkline-mark]')).toHaveCount(2);
    // C: two opponents, so the rivals table draws both, worst record first.
    await expect(page.getByTestId('pvp-rivals')).toHaveAttribute('data-state', 'rivals');
    const rivalRows = page.getByTestId('pvp-rival-row');
    await expect(rivalRows).toHaveCount(2);
    await expect(rivalRows.nth(0)).toHaveAttribute('data-opponent', duels[1].defensor.nome);
    // E: the fixture squads are five heroes of the offline roster, drawn as avatars.
    await expect(page.getByTestId('pvp-squad').first()).toHaveAttribute('data-count', String(filmed.estado.squad.length));
    await expect(page.getByTestId('pvp-squad').first().locator('img')).toHaveCount(filmed.estado.squad.length);

    // A rivals row click narrows the list to that opponent.
    await rivalRows.nth(1).click();
    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(1);
    await expect(page.getByTestId('pvp-head-to-head')).toBeVisible();
    await page.getByRole('combobox', { name: en('pvpFilterOpponentLabel') }).click();
    await page.getByRole('option', { name: en('pvpFilterOpponentAll') }).click();
    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(2);

    // D: the kept film opens as the replay, with the facts the fixture film settles.
    const rivalsScrollportHeight = await page
      .getByTestId('pvp-rivals-scroll')
      .evaluate((scroll) => parseFloat(getComputedStyle(scroll).maxHeight));
    await page.getByTestId('pvp-open-replay').click();
    await expect(page.getByTestId('pvp-replay')).toBeVisible();
    await expect(page.getByTestId('pvp-replay-chart')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('pvp-replay-facts')).toContainText('30 s');
    await expect(page.getByTestId('pvp-replay-facts')).toContainText('4%');
    // The axis reads compact figures, and the rivals table beside the replay keeps its own
    // ten-row height rather than taking the replay's.
    await expect(page.getByTestId('pvp-replay-chart')).toContainText('100k');
    await expect(page.getByTestId('pvp-rivals-scroll')).toHaveCSS('max-height', `${rivalsScrollportHeight}px`);
    // Moving the pointer over the plot names the second under it, in the chart and in the legend.
    const chart = page.getByTestId('pvp-replay-chart');
    const box = await chart.boundingBox();
    if (box === null) throw new Error('replay chart has no box');
    await chart.hover({ position: { x: box.width * (40 + 508 / 2) / 560, y: box.height / 2 } });
    await expect(chart).toHaveAttribute('data-hovered-second', '30');
    await expect(page.getByTestId('pvp-replay-cursor')).toBeVisible();
    await expect(page.getByTestId('pvp-replay-legend-at')).toHaveText('at 30 s');
    await page.mouse.move(0, 0);
    await expect(page.getByTestId('pvp-replay-cursor')).toHaveCount(0);
    // The close is the panel's corner icon, labelled, not a word.
    const close = page.getByTestId('pvp-replay-close');
    await expect(close).toHaveAttribute('aria-label', en('pvpReplayClose'));
    await expect(close).toHaveText('');
    await close.click();
    await expect(page.getByTestId('pvp-replay')).toHaveCount(0);
    await expect(page.getByTestId('pvp-rivals-scroll')).toHaveCSS('max-height', `${rivalsScrollportHeight}px`);
  });

  test('the duels survive a relaunch on the same user data, and the replay serving them again adds nothing', async () => {
    await app.close();
    ({ app, page } = await launchApp(launchEnv));
    await openPvp(page);

    await expect(page.getByTestId('pvp-duel-row')).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByTestId('pvp-summary')).toHaveText('2 duels · 1 won · 1 films kept');
  });
});
