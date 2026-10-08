import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

/**
 * The Farm board's three controls, driven on a running app: the phase a player picks off the
 * ranking, the heroes in the rotation pool, and the return bonus the whole table is priced under.
 *
 * The screen was asserted visible and nothing more, which left the part that actually breaks
 * untested — the board, the explorer below it and the stored view are three holders of the same
 * selection, and a change that reaches two of them looks right on screen and comes back wrong on
 * the next launch. So each test here changes a control, waits the recompute out, leaves the tab,
 * returns, and then reads the stored view directly.
 *
 * Two things this deliberately does not re-assert, because other specs own them: the Optimize
 * button's label and the tab switch behind it, and that `farm-view` is drawn at all.
 *
 * Three facts about the screen shape every assertion below:
 *
 * - The table is virtualized, so a row for a phase outside the scroll window is not in the DOM at
 *   all. Every row this spec touches is read off the DOM at runtime; nothing is a literal phase.
 * - The board auto-picks the best phase on a fresh load and that pick is deliberately NOT stored,
 *   so only a row that was actually CLICKED can be expected to survive. The first test clicks one.
 * - The explorer's Map select is a `Select` over the maps of one difficulty band, and its trigger
 *   draws the map's own name rather than the phase number — so the phase is read back from the
 *   board's `aria-current` row and from the stored view, and the Map trigger is used only to show
 *   that the explorer followed the board.
 */
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
const FARM_COPY_PATH = path.join(desktopRoot, '..', '..', 'packages', 'farm', 'src', 'copy', 'en.ts');

/** Copy out of a shipped `en.ts`, whichever quote style that file is written in — the shell's copy
 *  uses single quotes and the farm package's uses double, and a reader that knew only one would
 *  throw on half the keys this spec asserts. */
function copyIn(file, key) {
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(
    new RegExp(`\\b${key}:\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`),
  );
  if (!match) throw new Error(`farm-board.spec.mjs: could not find copy key "${key}" in ${file}`);
  return match[1] ?? match[2];
}

function en(key) {
  return copyIn(EN_COPY_PATH, key);
}

function farm(key) {
  return copyIn(FARM_COPY_PATH, key);
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
      // SAFETY: keeps the token reader away from any real session.cfg on this machine — see
      // i18n.spec.mjs for the full reasoning.
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FIXTURE,
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

function navTab(page, labelKey) {
  return page.locator('nav[aria-label="Main"]').getByRole('button', { name: en(labelKey), exact: true });
}

/** The board marks itself busy while a compute runs rather than unmounting, so every read after a
 *  control change waits that out instead of racing it. */
async function settled(page) {
  await expect(page.getByTestId('farm-view')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 60_000,
  });
}

async function openFarm(page) {
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  await navTab(page, 'farmNavLabel').click();
  await expect(page.getByTestId('farm-view')).toBeVisible({ timeout: 30_000 });
  // The board arrives a paint after its container and a recompute follows the first open, so the
  // rows are what this waits for, not the screen.
  await page.waitForSelector('[data-testid="farm-ranking-table"] tr[aria-current="true"]', {
    timeout: 60_000,
  });
  await settled(page);
}

/** The phases whose rows are currently mounted. `farm-row-<phase>` and `farm-row-gold-<phase>`
 *  share a prefix, so the row ids are matched whole rather than by `^=`. */
async function mountedPhases(page) {
  const ids = await page
    .locator('[data-testid="farm-ranking-table"] tr[data-testid]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-testid') ?? ''));
  return ids
    .map((id) => /^farm-row-(\d+)$/.exec(id))
    .filter((match) => match !== null)
    .map((match) => Number(match[1]));
}

async function currentPhase(page) {
  const id = await page
    .locator('[data-testid="farm-ranking-table"] tr[aria-current="true"]')
    .first()
    .getAttribute('data-testid');
  return Number(/^farm-row-(\d+)$/.exec(id ?? '')?.[1]);
}

function storedFarmView(page) {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('bfc-farm-view');
    return raw === null ? null : JSON.parse(raw);
  });
}

async function withFarm(run) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-farm-board-'));
  try {
    const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
    try {
      await openFarm(page);
      await run(page);
    } finally {
      await app.close().catch(() => undefined);
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

test.describe('farm board smoke — a phase, a rotation pool and a return bonus, driven and remembered', () => {
  test('a phase clicked on the ranking becomes the current row, moves the explorer with it, and survives a tab switch in the stored view', async () => {
    await withFarm(async (page) => {
      const phases = await mountedPhases(page);
      const autoPicked = await currentPhase(page);
      expect(
        phases.length,
        `the ranking mounted no rows at all, so there is nothing to click. Mounted row ids: ` +
          `{${phases.join(', ')}}`,
      ).toBeGreaterThan(1);
      expect(
        Number.isInteger(autoPicked),
        `no row carried aria-current, so "the phase moved" cannot be told from "the phase was ` +
          `never set". Mounted phases: {${phases.join(', ')}}`,
      ).toBe(true);

      const target = phases.find((phase) => phase !== autoPicked);
      expect(
        target,
        `every mounted row is the one already current (${String(autoPicked)}), so clicking one ` +
          `would prove nothing. Mounted phases: {${phases.join(', ')}}`,
      ).not.toBeUndefined();

      const mapLabel = farm('phasesMapLabel');
      const mapBefore = (await page.getByRole('combobox', { name: mapLabel }).textContent()) ?? '';

      await page.getByTestId(`farm-row-${String(target)}`).click();
      await settled(page);

      await expect(page.getByTestId(`farm-row-${String(target)}`)).toHaveAttribute('aria-current', 'true', {
        timeout: 20_000,
      });
      await expect(page.getByTestId(`farm-row-${String(autoPicked)}`)).not.toHaveAttribute('aria-current', 'true');

      // The explorer under the board reads the same phase, so its map has to have moved with it.
      // Its trigger draws the map's name rather than the number, which is why this asserts the
      // change rather than the value. The trigger is required to still be there first: polling its
      // text alone would read a vanished control as a changed one.
      const mapTrigger = page.getByRole('combobox', { name: mapLabel });
      await expect(mapTrigger).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(async () => (await mapTrigger.textContent()) ?? '', {
          message:
            'the explorer still names the map it named before the row was clicked, so it did not ' +
            'follow the board to the phase that is now current',
          timeout: 20_000,
        })
        .not.toBe(mapBefore);
      await expect(mapTrigger).toBeVisible();

      // The in-memory snapshot store survives a tab switch on its own, so the localStorage read is
      // what tells a real write apart from a value the renderer merely still had in hand.
      expect(
        (await storedFarmView(page))?.selectedPhase,
        `the stored farm view did not record the phase that was clicked (${String(target)}). An ` +
          `auto-picked phase is deliberately not stored; a clicked one is, and without it the next ` +
          `launch silently re-picks today's best map`,
      ).toBe(target);

      await navTab(page, 'liveNavLabel').click();
      await expect(page.getByTestId('farm-view')).toHaveCount(0, { timeout: 20_000 });
      await navTab(page, 'farmNavLabel').click();
      await expect(page.getByTestId('farm-view')).toBeVisible({ timeout: 30_000 });
      await settled(page);

      await expect(page.getByTestId(`farm-row-${String(target)}`)).toHaveAttribute('aria-current', 'true', {
        timeout: 30_000,
      });
      expect((await storedFarmView(page))?.selectedPhase).toBe(target);
    });
  });

  test('a hero switched out of the rotation pool stays out across a tab switch, and the override is in the stored view', async () => {
    await withFarm(async (page) => {
      await expect(page.getByTestId('farm-pool')).toBeVisible({ timeout: 20_000 });
      const heroIds = await page
        .locator('[data-testid="farm-pool"] [data-testid^="farm-pool-hero-"]')
        .evaluateAll((cards) =>
          cards.map((card) => (card.getAttribute('data-testid') ?? '').replace('farm-pool-hero-', '')),
        );
      expect(
        heroIds.length,
        'the rotation pool drew no hero cards, so there is no switch to drive. Under this fixture ' +
          'the heroes whose spent points could not be recovered are dropped upstream and named in ' +
          'the left-out banner, and the rest are the pool',
      ).toBeGreaterThan(0);
      // The same fixture that shortens the pool is what raises that banner, so this is the
      // precondition stated rather than a condition skipped on.
      await expect(page.getByTestId('farm-left-out')).toBeVisible();

      const heroId = heroIds[0];
      const toggle = page.getByTestId(`farm-pool-hero-${heroId}`).getByRole('switch');
      await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });

      await toggle.click();
      await settled(page);
      await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 20_000 });

      expect(
        (await storedFarmView(page))?.farmPoolOverrides?.[heroId],
        `the stored farm view carries no override for ${heroId}. Pool hero ids on screen: ` +
          `{${heroIds.join(', ')}}`,
      ).toBe(false);

      await navTab(page, 'liveNavLabel').click();
      await expect(page.getByTestId('farm-view')).toHaveCount(0, { timeout: 20_000 });
      await navTab(page, 'farmNavLabel').click();
      await expect(page.getByTestId('farm-view')).toBeVisible({ timeout: 30_000 });
      await settled(page);

      await expect(
        page.getByTestId(`farm-pool-hero-${heroId}`).getByRole('switch'),
      ).toHaveAttribute('aria-checked', 'false', { timeout: 30_000 });
    });
  });

  test('turning the return bonus on recomputes the gold rates and records the mode in the stored view, while the Pass shows the state it read', async () => {
    await withFarm(async (page) => {
      const label = farm('farmRankingReturnBonusLabel');
      const control = page.getByTestId('farm-return-bonus');
      await expect(control).toBeVisible({ timeout: 20_000 });
      const bonus = control.getByRole('switch', { name: label });
      await expect(bonus).toHaveAttribute('aria-checked', 'false');

      // The Pass carries the other half of the bonus and is NOT a control here: the desktop reads
      // it from the account's `vip_until` and supplies no setter, so the board draws its state
      // instead of a switch. This fixture's account has no Pass, and that is the claim — a switch
      // in this slot would mean the desktop had started inventing a value the account decides.
      const pass = page.getByTestId('farm-pass');
      await expect(pass).toBeVisible({ timeout: 20_000 });
      await expect(pass.getByTestId('farm-pass-state')).toHaveAttribute('data-pass', 'off');
      expect(
        await pass.getByRole('switch').count(),
        'the Pass is drawn as a switch, so this screen is offering to set a value it is supposed ' +
          'to read from the account',
      ).toBe(0);

      const before = await page
        .locator('[data-testid="farm-ranking-table"] [data-testid^="farm-row-gold-"]')
        .evaluateAll((cells) =>
          Object.fromEntries(
            cells.map((cell) => [cell.getAttribute('data-testid') ?? '', (cell.textContent ?? '').trim()]),
          ),
        );
      expect(
        Object.keys(before).length,
        'the ranking mounted no gold cells, so a recompute could not be seen in them',
      ).toBeGreaterThan(0);

      await bonus.click();
      await settled(page);
      await expect(bonus).toHaveAttribute('aria-checked', 'true', { timeout: 20_000 });

      // The bonus multiplies gold and XP, so turning it on has to move the gold column
      // of every row that earns anything. Reported as the set that did NOT move, since a control
      // that writes its own label and recomputes nothing is the failure worth naming.
      await expect
        .poll(
          async () => {
            const after = await page
              .locator('[data-testid="farm-ranking-table"] [data-testid^="farm-row-gold-"]')
              .evaluateAll((cells) =>
                Object.fromEntries(
                  cells.map((cell) => [cell.getAttribute('data-testid') ?? '', (cell.textContent ?? '').trim()]),
                ),
              );
            // A row whose cell left the virtualized window reads as absent, not as moved: counting
            // it as moved would let a re-sort stand in for a recompute.
            return Object.keys(before).filter((id) => after[id] === undefined || after[id] === before[id]).length;
          },
          {
            message:
              `none of the ${String(Object.keys(before).length)} gold figures the board printed with the ` +
              'return bonus off changed after it was turned on, so the control moved itself and the ' +
              'rates behind it were never recomputed',
            timeout: 30_000,
          },
        )
        .toBeLessThan(Object.keys(before).length);

      expect(
        (await storedFarmView(page))?.farmReturnBonus,
        'the stored farm view did not record the return-bonus mode, so the next launch prices the ' +
          'whole table under a bonus the player turned off',
      ).toBe('on');

      await navTab(page, 'liveNavLabel').click();
      await expect(page.getByTestId('farm-view')).toHaveCount(0, { timeout: 20_000 });
      await navTab(page, 'farmNavLabel').click();
      await expect(page.getByTestId('farm-view')).toBeVisible({ timeout: 30_000 });
      await settled(page);

      await expect(
        page.getByTestId('farm-return-bonus').getByRole('switch', { name: label }),
      ).toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });
    });
  });
});
