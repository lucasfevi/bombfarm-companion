import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

/**
 * A forge run drawn end to end in the real app, without a server. The offline fixture cannot
 * roll — main refuses a run against a fixture account, and this spec relies on that — so the run
 * arrives through `forge:inject`, the test-only channel that pushes a scripted sequence through
 * the same `forge:event` seam the real service uses. What is proved here is everything on the
 * renderer's side of that seam: the rail's states in order, that the rail spans the whole row as
 * it expands and that the screen never grows a scrollbar doing it, the tally's quiet-rung
 * collapsing, the result heading, and the return to a collapsed rail.
 *
 * `forge:inject` deliberately writes no ledger row — only a real run through the service does —
 * so the ledger at the foot of the screen stays empty through all three phases, and that is what
 * the last phase asserts. A ledger row for an injected run would mean the test channel had
 * reached further than the event seam it is meant to stop at.
 *
 * The Settings switch is turned on through the real UI first, so the screen is in the state a
 * player who can forge would see it in — the fixture rule still outranks it for a real start.
 */
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function launchApp(env) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      ELECTRON_ENABLE_LOGGING: '1',
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

/** The shipped Switch keeps no test id of its own, so the control is reached the way a reader
 *  would: the one switch on the screen whose name is the Forge setting's label. */
async function turnOnForgeWrites(page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const forgeSwitch = page.getByRole('switch', { name: /Let Forge spend gold/ });
  await expect(forgeSwitch).toBeVisible({ timeout: 15_000 });
  await forgeSwitch.click();
  await expect(forgeSwitch).toHaveAttribute('aria-checked', 'true');
}

async function goToForge(page) {
  await page.getByRole('button', { name: 'Forge' }).click();
  await page.waitForSelector('[data-testid="forge-view"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid="forge-table-row"]', { timeout: 20_000 });
}

/** The fixture's first worn piece: narrow to a hero, then the top row is what that hero wears. */
async function selectFirstWornPiece(page) {
  await page.getByRole('combobox', { name: 'Filter by hero' }).click();
  await page.getByRole('option').nth(1).click();
  await expect(page.getByTestId('forge-hero-hint')).toBeVisible();
  await page.getByTestId('forge-table-row').first().click();
  const itemPanel = page.getByTestId('forge-item-panel');
  await expect(itemPanel).toHaveAttribute('data-state', 'item');
  await expect(itemPanel.getByTestId('forge-item-whereabouts')).toContainText('worn by');
  return itemPanel.getAttribute('data-item-id');
}

async function withForge(run) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-forge-run-'));
  try {
    const { app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_OFFLINE_FIXTURE,
      BFC_USER_DATA_DIR: userDataDir,
    });
    try {
      await acceptConsent(page);
      await turnOnForgeWrites(page);
      await goToForge(page);
      await run(page);
      await app.close();
    } finally {
      await app.close().catch(() => undefined);
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

const RUN_ID = 'smoke-forge-run';

/** From +8 toward +12: three landings, a miss back to the floor, three landings, the top. */
function scriptedSteps(itemId) {
  const path = [
    [8, 9, 'success'],
    [9, 10, 'success'],
    [10, 11, 'success'],
    [11, 8, 'fail'],
    [8, 9, 'success'],
    [9, 10, 'success'],
    [10, 11, 'success'],
    [11, 12, 'success'],
  ];
  return path.map(([from, to, outcome], index) => ({
    type: 'step',
    runId: RUN_ID,
    itemId,
    attempt: index + 1,
    kind: 'roll',
    target: outcome === 'fail' ? from + 1 : to,
    from,
    to,
    outcome,
    cost: 1_000,
    spent: 1_000 * (index + 1),
    wallet: 222_054_630 - 1_000 * (index + 1),
  }));
}

function scriptedDone(itemId) {
  return {
    type: 'done',
    runId: RUN_ID,
    result: {
      itemId,
      from: 8,
      to: 12,
      target: 12,
      stop: 'target',
      reached: true,
      rolls: 8,
      fails: 1,
      crits: 0,
      safeJumps: 0,
      spent: 8_000,
      walletAfter: 222_054_630 - 8_000,
      durationMs: 14_000,
    },
  };
}

function inject(page, events) {
  return page.evaluate((scripted) => window.bfc.invoke('forge:inject', scripted), events);
}

/**
 * A window that was never shown hands the compositor no frames once the page settles, and
 * `page.screenshot` waits for one — so on the quiet run the capture hangs until it times out,
 * on whichever phase happens to settle first. That is a property of `BFC_HIDE_WINDOWS=1`, not of
 * anything this spec asserts: every assertion around these calls runs either way, and the visible
 * run — the one CI takes — still writes all three pictures. This spec is the only one in the
 * suite that screenshots at all, which is why the flag's own notes do not mention it.
 */
async function shoot(page, testInfo, name) {
  if (process.env.BFC_HIDE_WINDOWS === '1') return;
  await page.screenshot({ path: testInfo.outputPath(name) });
}

/** The rail is a full-width band between the toolbar and the split, so its box has to line up
 *  with the split's on both edges — not with the bag column inside it. */
async function railSpansTheRow(page) {
  const rail = await page.getByTestId('forge-rail').boundingBox();
  const split = await page.getByTestId('forge-split').boundingBox();
  expect(rail).not.toBeNull();
  expect(split).not.toBeNull();
  expect(Math.round(rail.x)).toBe(Math.round(split.x));
  expect(Math.round(rail.width)).toBe(Math.round(split.width));
}

/** `<main>` is the app's one scroll region, and this screen is supposed to fill it and scroll
 *  only inside the bag table — so an expanding rail must not hand `<main>` anything to scroll. */
async function nothingScrolls(page) {
  const metrics = await page.evaluate(() => {
    const main = document.querySelector('main');
    return main === null
      ? null
      : {
          mainScroll: main.scrollHeight,
          mainClient: main.clientHeight,
          docScroll: document.documentElement.scrollHeight,
          docClient: document.documentElement.clientHeight,
        };
  });
  expect(metrics).not.toBeNull();
  expect(metrics.mainScroll).toBeLessThanOrEqual(metrics.mainClient + 1);
  expect(metrics.docScroll).toBeLessThanOrEqual(metrics.docClient + 1);
}

test.describe('forge run smoke', () => {
  test('draws an injected run through running and finished and back to a collapsed rail, spanning the row and never scrolling the screen', async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    await withForge(async (page) => {
      const itemId = await selectFirstWornPiece(page);
      expect(itemId).toBeTruthy();

      const rail = page.getByTestId('forge-rail');
      const ledger = page.getByTestId('forge-ledger');
      await expect(rail).toHaveAttribute('data-state', 'collapsed');
      await expect(ledger).toHaveAttribute('data-state', 'empty');
      await nothingScrolls(page);

      // --- Running: the rail expands across the whole row, and the screen still fits ----------
      expect(await inject(page, scriptedSteps(itemId))).toEqual({ ok: true });
      await expect(rail).toHaveAttribute('data-state', 'running');
      await expect(rail.getByTestId('forge-rail-level')).toHaveText('+12');
      await expect(rail.getByTestId('forge-tally-rung')).toHaveText(['+9…+11', '+12']);
      const tallyRows = rail.getByTestId('forge-tally-row');
      await expect(tallyRows.nth(0).getByTestId('forge-tally-rolls')).toHaveText('6');
      await expect(tallyRows.nth(1).getByTestId('forge-tally-rolls')).toHaveText('2');
      await expect(tallyRows.nth(1).getByTestId('forge-tally-fails')).toHaveText('1');
      await expect(page.getByTestId('forge-button')).toHaveText('Cancel after this roll');
      await page.waitForTimeout(400);
      await railSpansTheRow(page);
      await nothingScrolls(page);
      await shoot(page, testInfo, 'forge-run-running.png');

      // --- Finished: the result block, still spanning the row and still fitting ---------------
      expect(await inject(page, [scriptedDone(itemId)])).toEqual({ ok: true });
      await expect(rail).toHaveAttribute('data-state', 'finished');
      await expect(rail.getByTestId('forge-result-heading')).toHaveText('Reached +12');
      await expect(rail.getByTestId('forge-result-climb')).toHaveText('+8 → +12');
      await page.waitForTimeout(400);
      await railSpansTheRow(page);
      await nothingScrolls(page);
      await shoot(page, testInfo, 'forge-run-finished.png');

      // --- Done: the rail collapses to nothing, and the ledger below it is opened to show that
      //     it is STILL empty — `forge:inject` stops at the event seam and never writes a row, so
      //     a run through the real service is the only thing that fills this table. ------------
      await rail.getByTestId('forge-done').click();
      await expect(rail).toHaveAttribute('data-state', 'collapsed', { timeout: 5_000 });
      await expect(ledger).toHaveAttribute('data-state', 'empty');
      await expect(ledger.getByTestId('forge-ledger-summary')).toHaveText('0 runs · 0 gold');
      await ledger.getByRole('button', { name: 'Run ledger' }).click();
      await expect(ledger.getByText('No runs yet')).toBeVisible();
      await expect(ledger.getByTestId('forge-ledger-body')).toHaveCount(0);
      await page.waitForTimeout(400);
      await nothingScrolls(page);
      await shoot(page, testInfo, 'forge-run-collapsed.png');

      const history = await page.evaluate(() => window.bfc.invoke('forge:history'));
      expect(history.rows).toEqual([]);
      expect(history.totals.runs).toBe(0);
    });
  });
});
