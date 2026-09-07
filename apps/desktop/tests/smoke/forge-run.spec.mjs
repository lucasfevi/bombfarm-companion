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
 * it expands while the split below it keeps its shape, the tally's quiet-rung collapsing, the
 * mark the chart holds open while a roll is in flight, the result heading, and the return to a
 * collapsed rail.
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

/** An ordinary gap between rolls; the screen holds the next roll's place whatever its length. */
const GAP_MS = 900;

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

/** Where the pending roll's mark stands and where the last real mark stands, in the chart's own
 *  coordinates — the ghost holds the slot the next mark will take, so it sits past the last one. */
function markPositions(page) {
  return page.evaluate(() => {
    const cx = (node) => (node === null ? null : Number(node.getAttribute('cx')));
    const marks = [...document.querySelectorAll('[data-testid="forge-chart"] circle[data-outcome]')];
    return {
      ghost: cx(document.querySelector('[data-testid="forge-chart-ghost"] circle')),
      lastMark: cx(marks[marks.length - 1] ?? null),
    };
  });
}

/** The rail is a full-width band between the toolbar and the split, so its box has to line up
 *  with the split's on both edges — not with the bag column inside it. */
/**
 * The whole run band sits inside the scroll region, which is what starting a run promises: a reader
 * who confirmed a spend sees the run, wherever the page happened to be scrolled.
 *
 * Asserted as a property of the end state rather than as a scroll offset. How far a clipped band
 * moves — and that a band already wholly on screen moves not at all — is `scrollDeltaIntoView`'s
 * own unit tests, which measure it exactly. A smoke that pinned `scrollTop` to a literal instead
 * asserted its own precondition without establishing it, and failed on a runner whose window left
 * the band three pixels short of fitting, where the feature had correctly scrolled those three
 * pixels.
 *
 * Skipped on a hidden run, for the same reason `shoot` is: a window that is never shown drives no
 * layout for the band's own `ResizeObserver`, so its animated height stays 0 and there is no
 * geometry to judge. Every other assertion around a running rail reads its DOM and holds either
 * way; CI runs the visible form, which is where this one earns its place.
 */
async function theRunBandIsInView(page) {
  if (process.env.BFC_HIDE_WINDOWS === '1') return;
  // Polled, never read once after a wait: the scroll is smooth, so a band that starts off screen
  // arrives over a few hundred milliseconds and any single read can catch it mid-journey. That is
  // how this failed twice — first as an exact offset caught 3px in, then as a geometry check
  // caught 187px in. The band ending up in view is the promise; when it gets there is not.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const main = document.querySelector('main');
          const rail = document.querySelector('[data-testid="forge-rail"]');
          if (main === null || rail === null) return 'no band';
          const port = main.getBoundingClientRect();
          const band = rail.getBoundingClientRect();
          if (Math.round(band.height) === 0) return 'collapsed';
          const above = Math.round(band.top - port.top);
          const below = Math.round(port.bottom - band.bottom);
          if (above < 0) return `${String(-above)}px above the top`;
          // A band taller than the port stops at aligning its top, which is what the scroll
          // promises and all it can promise; anything shorter must fit whole.
          if (below < 0 && band.height < port.height) return `${String(-below)}px below the bottom`;
          return 'in view';
        }),
      { timeout: 10_000 },
    )
    .toBe('in view');
}

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
      await theRunBandIsInView(page);
      await railSpansTheRow(page);
      await splitFollowsTheAside(page);
      await shoot(page, testInfo, 'forge-run-running.png');

      // --- Between rolls: the chart holds the next roll's place rather than the header saying a
      //     word. There is no threshold to clear — an ordinary gap gets the mark too — and the
      //     header keeps the word it never had. -------------------------------------------------
      const ghost = page.getByTestId('forge-chart-ghost');
      await expect(ghost).toHaveCount(0);
      await expect(rail.getByTestId('forge-rail-pausing')).toHaveCount(0);

      expect(await inject(page, [scriptedPause(GAP_MS)])).toEqual({ ok: true });
      await expect(ghost).toBeVisible();
      const { ghost: ghostX, lastMark } = await markPositions(page);
      expect(ghostX).toBeGreaterThan(lastMark);

      // And the roll the gap was waiting for takes the slot the ghost was holding.
      expect(await inject(page, [scriptedSteps(itemId)[7]])).toEqual({ ok: true });
      await expect(ghost).toHaveCount(0);

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
      await expect(ledger.getByTestId('forge-ledger-summary')).toHaveText('0 runs');
      await expect(ledger.getByTestId('forge-ledger-summary-gold')).toHaveText('0 gold');
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
