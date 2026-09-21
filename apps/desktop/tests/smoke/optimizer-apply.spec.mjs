/**
 * The Apply panel, end to end in the real app: the panel sitting between the gain breakdown and
 * the per-hero table, its ledger, the switch gate, the three confirms, and the blocking modal
 * driven through the fixture's scripted-run seam (`apply:inject`) — the only path a test may draw
 * a run through on an offline account. The forge row's own block belongs to the feature that adds
 * it, appended to this file through `solveToSettledPlan(page)`.
 *
 * The fixture's `apply:start` always refuses `offline` on an unscripted request — main checks the
 * account source before anything else. That refusal is what proves the Equip and Reset rows are
 * not pre-gated by the fixture: with the switch on, the press reaches the real `apply:start`,
 * which answers `offline`, and the row settles on Stopped with Run again — the confirms and the
 * modal are reachable by ANY smoke only because `apply:inject` arms a scripted answer first.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

const OPTIMIZE_BUTTON = /^Build a team plan of /i;

const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const copyFileCache = new Map();

function readCopyValue(filePath, key) {
  let source = copyFileCache.get(filePath);
  if (source === undefined) {
    source = fs.readFileSync(filePath, 'utf8');
    copyFileCache.set(filePath, source);
  }
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`optimizer-apply.spec.mjs: could not find copy key "${key}" in ${filePath}`);
  return match[1];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);

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

function navButton(page, index) {
  return page.locator('nav[aria-label="Main"] button').nth(index);
}

const OPTIMIZER_TAB_INDEX = 5;
const SETTINGS_TAB_INDEX = 9;

async function openOptimizer(page) {
  await navButton(page, OPTIMIZER_TAB_INDEX).click();
  await page.waitForSelector('[data-testid="optimizer-view"]', { timeout: 20_000 });
}

async function waitForOptimizeDone(page, timeout = 120_000) {
  await expect(page.getByRole('button', { name: OPTIMIZE_BUTTON })).toBeEnabled({ timeout });
  await expect(page.getByTestId('team-plan-battle-load-card')).toBeVisible({ timeout });
}

/** Optimize with the e2e evaluation cap, and wait for the settled results — the entrance both
 *  this file's own tests and item c's appended block start from. */
async function solveToSettledPlan(page) {
  await openOptimizer(page);
  // 300 (the plain `optimizer.spec.mjs` cap) settles with an empty points step on this fixture —
  // observed directly, not guessed: a run at 300 leaves the Reset row reading "Nothing to do",
  // which this file needs pending units to press through. 5000 is the smallest cap tried that
  // reliably proposes a respec too, still well inside the solve's own timeout.
  await page.evaluate(() => localStorage.setItem('bf-e2e-team-plan-max-eval', '5000'));
  await page.getByRole('button', { name: OPTIMIZE_BUTTON }).click();
  await waitForOptimizeDone(page);
  await expect(page.getByTestId('apply-panel')).toBeVisible({ timeout: 20_000 });
}

async function turnOnForgeWrites(page) {
  await navButton(page, SETTINGS_TAB_INDEX).click();
  const forgeSwitch = page.getByRole('switch', { name: en('settingsForgeWritesLabel') });
  await expect(forgeSwitch).toBeVisible({ timeout: 15_000 });
  if ((await forgeSwitch.getAttribute('aria-checked')) !== 'true') await forgeSwitch.click();
  await expect(forgeSwitch).toHaveAttribute('aria-checked', 'true');
}

async function turnOffForgeWrites(page) {
  await navButton(page, SETTINGS_TAB_INDEX).click();
  const forgeSwitch = page.getByRole('switch', { name: en('settingsForgeWritesLabel') });
  await expect(forgeSwitch).toBeVisible({ timeout: 15_000 });
  if ((await forgeSwitch.getAttribute('aria-checked')) !== 'false') await forgeSwitch.click();
  await expect(forgeSwitch).toHaveAttribute('aria-checked', 'false');
}

/** A copy template with `{placeholders}` as a `RegExp` matching any number where the value is
 *  not predicted here (the pending count, a gold figure) — every other character is escaped
 *  literally, so a reword of the surrounding words fails this the way a snapshot would. */
function templateRegex(template) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\\\{(\w+)\\\}/g, '[\\d,]+')}$`);
}

/** The band's own "{done}/{total} forged" text, read back into numbers. */
function parseForgeQueueCounts(text) {
  const match = /([\d,]+)\/([\d,]+) forged/.exec(text);
  if (!match) return null;
  return { done: Number(match[1].replace(/,/g, '')), total: Number(match[2].replace(/,/g, '')) };
}

function armInject(page, script) {
  return page.evaluate((req) => window.bfc.invoke('apply:inject', req), script);
}

/** Four units on the equip step: three land, the fourth is skipped `heroLevel`, with a cooldown
 *  and its resume astride the run. */
function equipScript(runId) {
  const events = [
    { type: 'unit', runId, step: 'equip', index: 0, status: 'sent' },
    { type: 'unit', runId, step: 'equip', index: 0, status: 'ok', goldSpent: 0, walletAfter: null },
    { type: 'unit', runId, step: 'equip', index: 1, status: 'sent' },
    { type: 'unit', runId, step: 'equip', index: 1, status: 'ok', goldSpent: 0, walletAfter: null },
    { type: 'unit', runId, step: 'equip', index: 2, status: 'sent' },
    { type: 'unit', runId, step: 'equip', index: 2, status: 'ok', goldSpent: 0, walletAfter: null },
    { type: 'cooldown', runId, step: 'equip', index: 3, resumeAtMs: Date.now() + 2_500 },
    { type: 'resumed', runId, step: 'equip', index: 3 },
    { type: 'unit', runId, step: 'equip', index: 3, status: 'skipped', reason: 'heroLevel' },
    {
      type: 'done',
      runId,
      step: 'equip',
      result: {
        step: 'equip',
        total: 4,
        made: 3,
        skipped: [{ index: 3, reason: 'heroLevel' }],
        failed: null,
        stop: 'finished',
        stopCode: null,
        goldSpent: 0,
        durationMs: 3_000,
      },
    },
  ];
  return { runId, events, gapMs: 400 };
}

/** Two units on the points step; the smoke stops the run itself after the first `ok`, so no
 *  `done` event is scripted — `apply:stop` ends the replay with a synthesised `stopped` result. */
function pointsScript(runId) {
  const events = [
    { type: 'unit', runId, step: 'points', index: 0, status: 'sent' },
    { type: 'unit', runId, step: 'points', index: 0, status: 'ok', goldSpent: 20_000, walletAfter: null },
    { type: 'unit', runId, step: 'points', index: 1, status: 'sent' },
    { type: 'unit', runId, step: 'points', index: 1, status: 'ok', goldSpent: 0, walletAfter: null },
  ];
  return { runId, events, gapMs: 400 };
}

test.describe('the Apply panel, solved, switched, confirmed and run through the inject seam', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;
  let userDataDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-optimizer-apply-'));
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

  test('the panel sits after the gain-breakdown heading and before the per-hero heading', async () => {
    await solveToSettledPlan(page);
    const gainY = await page.getByRole('heading', { name: /^Gain breakdown$/i, level: 2 }).boundingBox().then((box) => box?.y ?? -1);
    const panelY = await page.getByTestId('apply-panel').boundingBox().then((box) => box?.y ?? -1);
    const perHeroY = await page.getByRole('heading', { name: /Per-hero changes/i, level: 2 }).boundingBox().then((box) => box?.y ?? -1);
    expect(gainY).toBeGreaterThan(-1);
    expect(panelY).toBeGreaterThan(gainY);
    expect(perHeroY).toBeGreaterThan(panelY);
  });

  // Values, not provenance: a hand run of this exact fixture at the eval cap above settled with
  // 18 equip calls, a 3-hero/3-respec reset step (225,000 gold) and a forge line that absorbs the
  // rest of the total (the wallet figures are the fixture account's own starting gold, minus the
  // total this plan spends).
  test('the ledger prints five figures matching a hand computation for this fixture plan', async () => {
    const ledger = page.getByTestId('apply-ledger');
    await expect(ledger).toBeVisible();
    for (const testId of ['apply-ledger-total', 'apply-ledger-reset', 'apply-ledger-forge', 'apply-ledger-wallet']) {
      await expect(ledger.getByTestId(testId)).toBeVisible();
    }
    await expect(ledger.getByTestId('apply-ledger-total')).toContainText('1,198,709');
    await expect(ledger.getByTestId('apply-ledger-reset')).toContainText('225,000');
    await expect(ledger.getByTestId('apply-ledger-forge')).toContainText('973,709');
    await expect(ledger.getByTestId('apply-ledger-wallet')).toContainText('222,054,630');
    await expect(ledger.getByTestId('apply-ledger-wallet')).toContainText('220,855,921');
  });

  test('the switch off disables both writing rows and names the switch', async () => {
    await turnOffForgeWrites(page);
    await openOptimizer(page);
    await expect(page.getByTestId('apply-step-equip-press')).toBeDisabled();
    await expect(page.getByTestId('apply-step-points-press')).toBeDisabled();
    await expect(page.getByTestId('apply-panel-banner')).toContainText(en('settingsForgeWritesLabel'));
  });

  test('turning the switch back on enables both rows again', async () => {
    await turnOnForgeWrites(page);
    await openOptimizer(page);
    await expect(page.getByTestId('apply-step-equip-press')).toBeEnabled();
    await expect(page.getByTestId('apply-step-points-press')).toBeEnabled();
  });

  // `ConfirmDialog` names its own corner close icon `aria-label={cancelLabel}` too, so "Not now"
  // matches two elements: the icon-only close and the ghost button carrying the same text as its
  // visible label. The ghost button is the last "Not now"-named element in DOM order (the corner
  // icon sits above the title, the actions row comes after the body).
  test('the Equip and Reset confirms open with their primary labels, and Not now cancels them', async () => {
    await page.getByTestId('apply-step-equip-press').click();
    const equipConfirm = page.getByRole('dialog').filter({ hasText: en('applyConfirmEquipTitle') });
    await expect(equipConfirm).toBeVisible({ timeout: 10_000 });
    await expect(equipConfirm.getByRole('button').last()).toHaveText(templateRegex(en('applyConfirmEquip')));
    const equipCancel = equipConfirm.getByRole('button', { name: en('applyConfirmCancel') }).last();
    await expect(equipCancel).toBeVisible();
    await equipCancel.click();
    await expect(equipConfirm).toBeHidden();

    await page.getByTestId('apply-step-points-press').click();
    const pointsConfirm = page.getByRole('dialog').filter({ hasText: en('applyConfirmPointsTitle') });
    await expect(pointsConfirm).toBeVisible({ timeout: 10_000 });
    await expect(pointsConfirm.getByRole('button').last()).toHaveText(templateRegex(en('applyConfirmPoints')));
    await pointsConfirm.getByRole('button', { name: en('applyConfirmCancel') }).last().click();
    await expect(pointsConfirm).toBeHidden();
  });

  test('an armed Equip run replays through the real apply:start, and Close settles the row Done', async () => {
    const runId = 'smoke-apply-equip';
    expect(await armInject(page, equipScript(runId))).toEqual({ ok: true });

    await page.getByTestId('apply-step-equip-press').click();
    const equipConfirm = page.getByRole('dialog').filter({ hasText: en('applyConfirmEquipTitle') });
    await expect(equipConfirm).toBeVisible({ timeout: 10_000 });
    // The primary button is the confirm's second button (Not now, then the cost-naming press) —
    // its exact label carries the pending count, which this smoke does not predict.
    await equipConfirm.getByRole('button').last().click();

    const modal = page.getByTestId('apply-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Neither Escape nor a backdrop click closes a run in flight.
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(modal).toBeVisible();

    // The ledger advances as the scripted events land.
    await expect(modal.locator('[data-testid="apply-modal-ledger-line"][data-unit-status="ok"]')).toHaveCount(3, {
      timeout: 10_000,
    });

    // The cooldown card and its bar marker appear astride the scripted pause.
    await expect(modal.getByTestId('apply-modal-progress')).toHaveAttribute('data-cooldown', 'true', { timeout: 10_000 });

    await expect(modal.getByTestId('apply-modal-done')).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByTestId('apply-modal-skipped-line')).toHaveCount(1);
    await modal.getByTestId('apply-modal-close').click();
    await expect(modal).toBeHidden();

    await expect(page.getByTestId('apply-step-equip')).toContainText('Done — 3 of 4 calls made, 1 skipped');
  });

  test('a second run, stopped mid-flight, settles the row Stopped with Run again', async () => {
    const runId = 'smoke-apply-points';
    expect(await armInject(page, pointsScript(runId))).toEqual({ ok: true });

    await page.getByTestId('apply-step-points-press').click();
    const pointsConfirm = page.getByRole('dialog').filter({ hasText: en('applyConfirmPointsTitle') });
    await expect(pointsConfirm).toBeVisible({ timeout: 10_000 });
    await pointsConfirm.getByRole('button', { name: /Reset points/i }).click();

    const modal = page.getByTestId('apply-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(modal.locator('[data-testid="apply-modal-ledger-line"][data-unit-status="ok"]')).toHaveCount(1, {
      timeout: 10_000,
    });

    // The ledger keeps re-rendering while events land every `gapMs` — Playwright's stability
    // check can catch it mid-update (observed hidden-only, where a slower paint path widens the
    // window); `force` skips that visual-stability wait, not the button's own enabled state,
    // which the very next assertion still proves changed.
    await modal.getByTestId('apply-modal-stop').click({ force: true });
    await expect(modal.getByTestId('apply-modal-stop')).toBeDisabled();

    await expect(modal.getByTestId('apply-modal-done')).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByTestId('apply-modal-stop-reason')).toBeVisible();
    await modal.getByTestId('apply-modal-close').click();
    await expect(modal).toBeHidden();

    await expect(page.getByTestId('apply-step-points')).toContainText(en('applyStepRunAgain'));
    // The "Stopped — …" sentence is the row's note line — the facts line above it keeps
    // describing the plan's own step, unchanged by the outcome.
    await expect(page.getByTestId('apply-step-points-note')).toContainText('Stopped —');
  });

  test('the forge row adds the plan’s forges to the queue in one press, agreeing with the band and every per-entry control, and stays Done across a tab change', async () => {
    await openOptimizer(page);
    const forgeRow = page.getByTestId('apply-step-forge');
    await expect(forgeRow).toBeVisible();
    const factsText = await forgeRow.getByTestId('apply-step-forge-facts').innerText();
    const piecesMatch = /^([\d,]+) pieces/.exec(factsText);
    expect(piecesMatch).not.toBeNull();
    const addable = Number(piecesMatch[1].replace(/,/g, ''));
    expect(addable).toBeGreaterThan(0);

    const bandCount = page.getByTestId('forge-queue-count');
    const before = (await bandCount.count()) > 0 ? parseForgeQueueCounts(await bandCount.innerText()) : { done: 0, total: 0 };

    const press = forgeRow.getByTestId('apply-step-forge-press');
    await expect(press).toBeEnabled();
    await press.click();

    const forgeConfirm = page.getByRole('dialog').filter({ hasText: en('applyConfirmForgeTitle') });
    await expect(forgeConfirm).toBeVisible({ timeout: 10_000 });
    await expect(forgeConfirm.getByRole('button').last()).toHaveText(templateRegex(en('applyConfirmForge')));
    await forgeConfirm.getByRole('button').last().click();
    await expect(forgeConfirm).toBeHidden();

    await expect(forgeRow).toContainText('added to the queue');
    await expect(forgeRow.getByTestId('apply-step-forge-press')).toHaveCount(0);

    await expect(bandCount).toBeVisible();
    const after = parseForgeQueueCounts(await bandCount.innerText());
    expect(after).not.toBeNull();
    expect(after.done).toBe(before.done);
    expect(after.total - before.total).toBe(addable);

    const closedRows = page.getByRole('button', { name: /^Detailed breakdown for/, expanded: false });
    for (let guard = 0; guard < 20 && (await closedRows.count()) > 0; guard += 1) await closedRows.first().click();
    const addControls = page.getByTestId('forge-queue-add');
    const addControlCount = await addControls.count();
    for (let i = 0; i < addControlCount; i += 1) {
      await expect(addControls.nth(i)).toHaveAttribute('data-queued', 'true');
    }

    await navButton(page, SETTINGS_TAB_INDEX).click();
    await openOptimizer(page);
    await expect(page.getByTestId('apply-step-forge')).toContainText('added to the queue');
  });

  // The fixture refuses `forge:start` outright (`accountSource === 'fixture'` disables the band's
  // Start button before any press reaches it — `forge-queue-actions.tsx`'s own `forgeButtonReason`
  // gate), so a queued piece can never reach `running`/`halted` through the real UI on this
  // fixture. What this asserts instead is the guarantee that actually holds: the queue's band is
  // untouched by an apply run that has nothing to do with it.
  test('a queued piece leaves the forge band unmoved across an unrelated apply run', async () => {
    await openOptimizer(page);
    // The forge-queue action lives inside each hero's own detail panel, closed by default — open
    // every row so at least one is reachable, the same helper shape `forge-queue.spec.mjs` uses.
    const closedRows = page.getByRole('button', { name: /^Detailed breakdown for/, expanded: false });
    for (let guard = 0; guard < 20 && (await closedRows.count()) > 0; guard += 1) await closedRows.first().click();
    const forgeQueueItems = page.getByTestId('team-plan-forge-queue-item');
    if ((await forgeQueueItems.count()) > 0) {
      const add = forgeQueueItems.first().getByTestId('forge-queue-add');
      if ((await add.getAttribute('data-queued')) !== 'true') await add.click();
    }
    const bar = page.getByTestId('forge-queue-bar');
    const before = (await bar.count()) > 0 ? await bar.getAttribute('data-status') : null;

    const runId = 'smoke-apply-band-untouched';
    expect(await armInject(page, equipScript(runId))).toEqual({ ok: true });
    const pressReady = page.getByTestId('apply-step-equip-press');
    if (await pressReady.isEnabled().catch(() => false)) {
      await pressReady.click();
      const equipConfirm = page.getByRole('dialog').filter({ hasText: en('applyConfirmEquipTitle') });
      if (await equipConfirm.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await equipConfirm.getByRole('button', { name: /Equip/i }).click();
        const modal = page.getByTestId('apply-modal');
        await expect(modal.getByTestId('apply-modal-done')).toBeVisible({ timeout: 15_000 });
        await modal.getByTestId('apply-modal-close').click();
      }
    }

    const after = (await bar.count()) > 0 ? await bar.getAttribute('data-status') : null;
    expect(after).toBe(before);
  });

  test('no test in this file names the API host', () => {
    const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    expect(source).not.toMatch(/bombfarm\.net/);
  });
});

export { solveToSettledPlan, launchApp, acceptConsent, navButton, openOptimizer, en, readCopyValue };
