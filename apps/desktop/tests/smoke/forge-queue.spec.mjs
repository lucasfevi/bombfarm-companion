import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

/**
 * The forge queue end to end in the real app, without a server: a piece added from an Optimizer
 * hero row reaches the band under the top bar and the Forge tab's list, Start — in the band and
 * on the Forge tab's panel alike — explains why a fixture account cannot start it in the same
 * words the Forge button uses, a piece removed on the Forge tab leaves both, and the queue is
 * still there after the app is closed and opened again.
 *
 * What is not proved here is a run starting: main refuses one against a fixture account, so the
 * chain from Start through main's `done` to the next piece is the queue store's own unit tests,
 * against a scripted bridge.
 */
const OPTIMIZE_BUTTON = /^Build a team plan of /i;
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

function readCopyValue(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`forge-queue.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
  return match[1];
}

function electronExecutable() {
  return path.join(desktopRoot, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
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

async function openOptimizer(page) {
  await page.locator('nav[aria-label="Main"]').getByRole('button', { name: 'Optimizer', exact: true }).click();
  await page.waitForSelector('[data-testid="optimizer-view"]', { timeout: 20_000 });
}

async function openForge(page) {
  await page.locator('nav[aria-label="Main"]').getByRole('button', { name: 'Forge', exact: true }).click();
  await page.waitForSelector('[data-testid="forge-view"]', { timeout: 20_000 });
}

/** Only the first hero's row opens on its own, and the fixture plan owes that hero no climb —
 *  the forge chores sit on the rows below it, so every row is opened before the entries are read. */
async function openEveryHeroRow(page) {
  const closed = page.getByRole('button', { name: /^Detailed breakdown for/, expanded: false });
  for (let guard = 0; guard < 20 && (await closed.count()) > 0; guard += 1) await closed.first().click();
}

async function optimizeUntilQueued(page) {
  await page.getByRole('button', { name: OPTIMIZE_BUTTON }).click();
  await expect(page.getByRole('button', { name: OPTIMIZE_BUTTON })).toBeEnabled({ timeout: 120_000 });
  await expect(page.getByTestId('team-plan-battle-load-card')).toBeVisible({ timeout: 120_000 });
  await openEveryHeroRow(page);
  const entries = page.getByTestId('team-plan-forge-queue-item');
  await expect(entries.first()).toBeVisible({ timeout: 20_000 });
  return entries;
}

/** Pictures on the visible run only: a window never shown hands the compositor no frame for
 *  `page.screenshot` to wait on, the same property `forge-run.spec.mjs` notes. */
async function shoot(page, testInfo, name) {
  if (process.env.BFC_HIDE_WINDOWS === '1') return;
  await page.screenshot({ path: testInfo.outputPath(name) });
}

test.describe('the forge queue, fed from the Optimizer', () => {
  test.describe.configure({ mode: 'serial' });

  let app;
  let page;
  let runDir;
  let userDataDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-forge-queue-'));
    userDataDir = path.join(runDir, 'user-data');
    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_OFFLINE_FIXTURE,
      BFC_USER_DATA_DIR: userDataDir,
    }));
    await acceptConsent(page);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  test('the band draws nothing while the queue is empty', async () => {
    await expect(page.getByTestId('forge-queue-bar')).toHaveCount(0);
  });

  test('a piece added on a hero row reaches the band, with Start explaining the fixture', async ({}, testInfo) => {
    await openOptimizer(page);
    const entries = await optimizeUntilQueued(page);

    const add = entries.first().getByTestId('forge-queue-add');
    await expect(add).toHaveText(readCopyValue('forgeQueueAdd'));
    await add.click();
    await expect(add).toHaveAttribute('data-queued', 'true');
    await expect(add).toHaveText(readCopyValue('forgeQueueAdded'));

    const bar = page.getByTestId('forge-queue-bar');
    await expect(bar).toBeVisible();
    await expect(bar.getByTestId('forge-queue-count')).toHaveText('0/1 forged');
    await expect(bar.getByTestId('forge-queue-start')).toBeDisabled();
    await expect(bar.getByTestId('forge-queue-reason')).toHaveText(readCopyValue('forgeReasonFixture'));

    // Pressing the same entry again changes nothing: one entry per piece.
    await add.click();
    await expect(bar.getByTestId('forge-queue-count')).toHaveText('0/1 forged');
    await add.scrollIntoViewIfNeeded();
    await shoot(page, testInfo, 'optimizer-queued.png');
  });

  test('a second piece joins behind the first, and the Forge tab lists both in order', async ({}, testInfo) => {
    const entries = page.getByTestId('team-plan-forge-queue-item');
    expect(await entries.count()).toBeGreaterThanOrEqual(2);
    await entries.nth(1).getByTestId('forge-queue-add').click();
    await expect(page.getByTestId('forge-queue-count')).toHaveText('0/2 forged');

    await openForge(page);
    const rows = page.getByTestId('forge-queue-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByTestId('forge-queue-remove')).toBeVisible();

    // The band's name is the way here from any tab: back to the Optimizer, then through it.
    await openOptimizer(page);
    await page.getByTestId('forge-queue-open-forge').click();
    await page.waitForSelector('[data-testid="forge-view"]', { timeout: 20_000 });

    // The panel carries the queue's own Start, gated the same way as the band's.
    const panelStart = page.getByTestId('forge-queue-panel').getByTestId('forge-queue-start');
    await expect(panelStart).toBeDisabled();
    await expect(page.getByTestId('forge-queue-panel').getByTestId('forge-queue-reason')).toHaveText(
      readCopyValue('forgeReasonFixture'),
    );
    await shoot(page, testInfo, 'forge-tab-queue.png');
  });

  test('the plan panel queues the piece in hand at the target it shows', async ({}, testInfo) => {
    await openForge(page);
    await page.waitForSelector('[data-testid="inventory-table-row"]', { timeout: 20_000 });
    const rows = page.getByTestId('forge-queue-row');
    const before = await rows.count();

    // The fixture's first unforged piece: narrow the bag to +0, then the top row is one with a
    // climb ahead of it.
    await page.getByRole('combobox', { name: 'Filter by forge level' }).click();
    await page.getByRole('option', { name: '+0 only', exact: true }).click();
    await page.getByTestId('inventory-table-row').first().click();
    const itemPanel = page.getByTestId('forge-item-panel');
    await expect(itemPanel).toHaveAttribute('data-state', 'item');
    const itemId = await itemPanel.getAttribute('data-item-id');

    const add = page.getByTestId('forge-plan-panel').getByTestId('forge-queue-add');
    await expect(add).toHaveText(readCopyValue('forgeQueueAdd'));
    await add.click();
    await expect(add).toHaveAttribute('data-queued', 'true');
    await expect(rows).toHaveCount(before + 1);
    await expect(rows.last()).toHaveAttribute('data-item-id', itemId);
    await expect(page.getByTestId('forge-queue-count')).toHaveText(`0/${String(before + 1)} forged`);

    // Stepping the target un-queues the button (the queue holds the old target) and pressing
    // it again moves the target rather than adding a second row.
    await page.getByRole('button', { name: 'Raise the target' }).click();
    await expect(add).not.toHaveAttribute('data-queued', 'true');
    await add.click();
    await expect(add).toHaveAttribute('data-queued', 'true');
    await expect(rows).toHaveCount(before + 1);
    await shoot(page, testInfo, 'forge-plan-queued.png');
  });

  test('removing a piece on the Forge tab takes it off the band, and the panel goes with the last one', async () => {
    await openForge(page);
    const rows = page.getByTestId('forge-queue-row');
    const before = await rows.count();
    expect(before).toBeGreaterThan(0);

    await rows.first().getByTestId('forge-queue-remove').click();
    await expect(rows).toHaveCount(before - 1);
    if (before - 1 === 0) {
      await expect(page.getByTestId('forge-queue-panel')).toHaveCount(0);
      await expect(page.getByTestId('forge-queue-bar')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('forge-queue-count')).toHaveText(`0/${String(before - 1)} forged`);
    }
  });

  test('the queue is still there after the app is closed and opened again, waiting', async () => {
    await openOptimizer(page);
    await openEveryHeroRow(page);
    const entries = page.getByTestId('team-plan-forge-queue-item');
    await expect(entries.first()).toBeVisible({ timeout: 20_000 });
    const add = entries.first().getByTestId('forge-queue-add');
    if ((await add.getAttribute('data-queued')) !== 'true') await add.click();
    const waiting = await page.getByTestId('forge-queue-count').textContent();

    await app.close();
    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_OFFLINE_FIXTURE,
      BFC_USER_DATA_DIR: userDataDir,
    }));

    const status = page.getByTestId('forge-queue-bar');
    await expect(status).toBeVisible({ timeout: 30_000 });
    await expect(status).toHaveAttribute('data-status', 'idle');
    await expect(status.getByTestId('forge-queue-count')).toHaveText(waiting ?? '');

    await openForge(page);
    await expect(page.getByTestId('forge-queue-row').first()).toBeVisible();
  });

  test('Clear on the panel empties the queue, and the band goes with it', async () => {
    await openForge(page);
    const panel = page.getByTestId('forge-queue-panel');
    await expect(panel.getByTestId('forge-queue-row').first()).toBeVisible();
    await panel.getByTestId('forge-queue-clear').click();
    await expect(page.getByTestId('forge-queue-panel')).toHaveCount(0);
    await expect(page.getByTestId('forge-queue-bar')).toHaveCount(0);
  });
});
