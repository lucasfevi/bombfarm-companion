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
 * it expands while the split below it keeps its shape, the tally's quiet-rung collapsing, the word
 * the header shows while a run is between rolls, the result heading, and the return to a collapsed
 * rail.
 *
 * The screen is sized by its content, so what the layout promises here is not that nothing
 * scrolls — the page is free to be taller than the window. It is that the bag is as tall as the
 * item and plan panels beside it, that the column holding those two never scrolls inside itself,
 * that the bag table is the one scroller on the screen, and that opening the ledger only ever
 * adds height below what is already drawn.
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
  await page.waitForSelector('[data-testid="inventory-table-row"]', { timeout: 20_000 });
}

/** The fixture's first worn piece: narrow to a hero, then the top row is what that hero wears. */
async function selectFirstWornPiece(page) {
  await page.getByRole('combobox', { name: 'Filter by hero' }).click();
  await page.getByRole('option').nth(1).click();
  await expect(page.getByTestId('forge-hero-hint')).toBeVisible();
  await page.getByTestId('inventory-table-row').first().click();
  const itemPanel = page.getByTestId('forge-item-panel');
  await expect(itemPanel).toHaveAttribute('data-state', 'item');
  await expect(itemPanel.getByTestId('forge-item-name')).not.toBeEmpty();
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

/** Long enough to be worth a word — the renderer's own threshold is 1.5s. */
const LONG_PAUSE_MS = 9_000;

function scriptedPause(ms) {
  return { type: 'pause', runId: RUN_ID, ms };
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

/** Where every other figure in the running header sits, so the word that comes and goes between
 *  rolls can be proved to move none of them. */
function headerBoxes(page) {
  return page.evaluate(() => {
    const box = (testid) => {
      const element = document.querySelector(`[data-testid="${testid}"]`);
      if (element === null) return null;
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width) };
    };
    return {
      level: box('forge-rail-level'),
      target: box('forge-rail-target'),
      rolls: box('forge-rail-rolls'),
      spent: box('forge-rail-spent'),
      wallet: box('forge-rail-wallet'),
      cancel: box('forge-rail-cancel'),
    };
  });
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

function boxesOf(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    // Measured down the page, not down the viewport: clicking the ledger's trigger scrolls
    // `<main>`, which moves every viewport-relative `top` on the screen without moving anything.
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (element === null) return null;
      return {
        pageTop: Math.round(element.getBoundingClientRect().top) + (main?.scrollTop ?? 0),
        height: Math.round(element.getBoundingClientRect().height),
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        offsetWidth: element.offsetWidth,
        clientWidth: element.clientWidth,
      };
    };
    return {
      view: box('[data-testid="forge-view"]'),
      split: box('[data-testid="forge-split"]'),
      bag: box('[data-testid="forge-bag-panel"]'),
      aside: box('[data-testid="forge-aside"]'),
      scroller: box('[data-testid="inventory-table-scroll"]'),
      mainScroll: main === null ? null : main.scrollHeight,
    };
  });
}

/** The floor the screen puts under the split so an unpicked bag is still worth reading. */
const SPLIT_MIN_HEIGHT = 460;

/**
 * The column beside the bag grows to exactly what it draws — no scroller of its own, and no
 * scrollbar narrowing it — and the bag panel is as tall as that column, floored so an unpicked
 * bag is still worth reading. Polled rather than slept through: the column animates to its new
 * height, and a hidden window takes its time about it.
 */
async function splitFollowsTheAside(page) {
  const settled = {
    asideHoldsItsContent: true,
    asideKeepsItsFullWidth: true,
    bagIsTheRowHeight: true,
    rowFollowsTheAside: true,
  };
  await expect
    .poll(
      async () => {
        const { bag, aside, split } = await boxesOf(page);
        if (bag === null || aside === null || split === null) return null;
        return {
          asideHoldsItsContent: aside.scrollHeight <= aside.clientHeight + 1,
          asideKeepsItsFullWidth: aside.clientWidth === aside.offsetWidth,
          bagIsTheRowHeight: bag.height === split.height,
          rowFollowsTheAside: split.height === Math.max(aside.height, SPLIT_MIN_HEIGHT),
        };
      },
      { timeout: 15_000 },
    )
    .toEqual(settled);
}

/** The bag is the one thing on this screen that scrolls inside itself. */
async function theBagScrolls(page) {
  const { scroller } = await boxesOf(page);
  expect(scroller).not.toBeNull();
  expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
}

/** The screen is sized by its content now, so the page is free to be taller than the window —
 *  but only downwards. Opening the ledger adds to what `<main>` scrolls and moves nothing above
 *  it, which is the promise the old "nothing scrolls anywhere" rule was standing in for. */
async function openingTheLedgerOnlyAdds(page, ledger) {
  const trigger = ledger.getByRole('button', { name: 'Run ledger' });
  const before = await boxesOf(page);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await boxesOf(page)).view.height).toBeGreaterThan(before.view.height);
  const after = await boxesOf(page);
  expect(after.split).toEqual(before.split);
  expect(after.mainScroll).toBeGreaterThanOrEqual(before.mainScroll);
  await splitFollowsTheAside(page);

  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await boxesOf(page)).view.height).toBe(before.view.height);
  expect((await boxesOf(page)).split).toEqual(before.split);
}

test.describe('forge run smoke', () => {
  test('draws an injected run through running and finished and back to a collapsed rail, spanning the row while the bag stays as tall as the column beside it', async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    await withForge(async (page) => {
      // The whole bag, before the hero filter narrows it: the table is the screen's one scroller.
      await theBagScrolls(page);

      const itemId = await selectFirstWornPiece(page);
      expect(itemId).toBeTruthy();

      const rail = page.getByTestId('forge-rail');
      const ledger = page.getByTestId('forge-ledger');
      await expect(rail).toHaveAttribute('data-state', 'collapsed');
      await expect(ledger).toHaveAttribute('data-state', 'empty');
      await splitFollowsTheAside(page);
      await openingTheLedgerOnlyAdds(page, ledger);

      // --- Running: the rail expands across the whole row, and the split keeps its shape ------
      // A band that is already wholly on screen must not move the page under the reader when the
      // run starts. How far a clipped one moves is `scrollDeltaIntoView`'s own unit tests.
      const scrollBefore = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0);
      expect(await inject(page, scriptedSteps(itemId))).toEqual({ ok: true });
      await expect(rail).toHaveAttribute('data-state', 'running');
      await expect(rail.getByTestId('forge-rail-level')).toHaveText('+12');
      await expect(rail.getByTestId('forge-tally-rung')).toHaveText(['+9…+11', '+12']);
      const tallyRows = rail.getByTestId('forge-tally-row');
      await expect(tallyRows.nth(0).getByTestId('forge-tally-rolls')).toHaveText('6');
      await expect(tallyRows.nth(1).getByTestId('forge-tally-rolls')).toHaveText('2');
      await expect(tallyRows.nth(1).getByTestId('forge-tally-fails')).toHaveText('1');
      await expect(page.getByTestId('forge-button')).toHaveText('Cancel after this roll');
      await expect(rail.getByTestId('forge-rail-cancel')).toBeEnabled();
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => document.querySelector('main')?.scrollTop ?? 0)).toBe(scrollBefore);
      await railSpansTheRow(page);
      await splitFollowsTheAside(page);
      await shoot(page, testInfo, 'forge-run-running.png');

      // --- Between rolls: a run paces itself, and a long gap says so rather than looking frozen.
      //     The header's own figures are measured either side of it: the word is drawn all along
      //     and only made visible, so nothing beside it may move as it appears or goes. ---------
      const pausing = rail.getByTestId('forge-rail-pausing');
      await expect(pausing).toBeHidden();
      const headerBefore = await headerBoxes(page);
      expect(await inject(page, [scriptedPause(LONG_PAUSE_MS)])).toEqual({ ok: true });
      await expect(pausing).toBeVisible();
      await expect(pausing).toHaveText('pausing...');
      expect(await headerBoxes(page)).toEqual(headerBefore);

      // A gap short enough to pass for the roll itself says nothing at all, and puts the header
      // back exactly where it was.
      expect(await inject(page, [scriptedPause(900)])).toEqual({ ok: true });
      await expect(pausing).toBeHidden();
      expect(await headerBoxes(page)).toEqual(headerBefore);

      // And the roll the gap was waiting for clears the word.
      expect(await inject(page, [scriptedPause(LONG_PAUSE_MS)])).toEqual({ ok: true });
      await expect(pausing).toBeVisible();
      expect(await inject(page, [scriptedSteps(itemId)[7]])).toEqual({ ok: true });
      await expect(pausing).toBeHidden();

      // --- Cancelled: main honours it between rolls, so the press has to be visible at once ----
      await rail.getByTestId('forge-rail-cancel').click();
      await expect(rail.getByTestId('forge-rail-cancel')).toHaveText('Cancelling after this roll…');
      await expect(rail.getByTestId('forge-rail-cancel')).toBeDisabled();
      await expect(page.getByTestId('forge-button')).toHaveText('Cancelling after this roll…');
      await expect(page.getByTestId('forge-button')).toBeDisabled();
      await expect(page.getByTestId('forge-button-reason')).toHaveText(
        'Cancelling — waiting for the roll in flight to settle',
      );

      // --- Finished: the result block, still spanning the row above an unchanged split --------
      expect(await inject(page, [scriptedDone(itemId)])).toEqual({ ok: true });
      await expect(rail).toHaveAttribute('data-state', 'finished');
      await expect(rail.getByTestId('forge-result-heading')).toHaveText('Reached +12');
      await expect(rail.getByTestId('forge-result-climb')).toHaveText('+8 → +12');
      await page.waitForTimeout(400);
      await railSpansTheRow(page);
      await splitFollowsTheAside(page);
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
      await splitFollowsTheAside(page);
      await shoot(page, testInfo, 'forge-run-collapsed.png');

      const history = await page.evaluate(() => window.bfc.invoke('forge:history'));
      expect(history.rows).toEqual([]);
      expect(history.totals.runs).toBe(0);
    });
  });
});
