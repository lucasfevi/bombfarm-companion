/**
 * The two places the top bar was regrouped, driven through the real app: Settings behind the gear
 * at the end of the bar's actions, and Skill Tree and Collections as the two pages of one
 * Progression tab. Unit tests prove which controls render and how the shell maps a screen to a
 * tab; only a launched window proves a press reaches the screen, the "current" marks follow it,
 * and the gear is still on the bar when the actions have folded behind the overflow button.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

const FARM_TAB_INDEX = 1;
const PROGRESSION_TAB_INDEX = 7;
/** Narrow enough that the actions have folded behind the overflow button (a bar of 760px). */
const ACTIONS_COLLAPSED_WINDOW = 860;
const WIDE_WINDOW = 1600;

function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`settings-gear-and-progression.spec.mjs: could not find copy key "${key}"`);
  return match[1];
}

async function launchApp(userDataDir) {
  const app = await electron.launch({
    executablePath: path.join(
      desktopRoot,
      'node_modules',
      'electron',
      'dist',
      process.platform === 'win32' ? 'electron.exe' : 'electron',
    ),
    args: [desktopRoot, '--lang=en'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_OFFLINE_FIXTURE,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: userDataDir,
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  const consentModal = page.getByTestId('consent-modal');
  await expect(consentModal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(consentModal).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('nav[aria-label="Main"] button')).toHaveCount(9, { timeout: 30_000 });
  return { app, page };
}

/** Resizes the real `BrowserWindow`, lifting the minimum first so a narrow width can be asked for. */
async function resize(app, page, width, height = 800) {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.setMinimumSize(200, 200);
      win?.setSize(size.width, size.height);
    },
    { width, height },
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(180);
}

function strip(page) {
  return page.locator('nav[aria-label="Main"] button');
}

function pageTab(page, labelKey) {
  return page.getByRole('tab', { name: en(labelKey), exact: true });
}

test.describe('top bar — the Settings gear and the Progression tab', () => {
  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-gear-progression-'));
    ({ app, page } = await launchApp(path.join(runDir, 'user-data')));
    await resize(app, page, WIDE_WINDOW);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  test('pressing the gear shows Settings and marks only the gear current, and pressing Farm gives both back', async () => {
    const gear = page.getByTestId('shell-settings');
    await expect(gear).toHaveAccessibleName(en('settingsNavLabel'));
    await expect(gear).not.toHaveAttribute('aria-current', 'page');
    await expect(strip(page).filter({ hasText: en('settingsNavLabel') })).toHaveCount(0);

    await gear.click();
    await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 20_000 });
    await expect(gear).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('nav[aria-label="Main"] button[aria-current="page"]')).toHaveCount(0);

    await strip(page).nth(FARM_TAB_INDEX).click();
    await expect(page.getByTestId('farm-view')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('settings-view')).toHaveCount(0);
    await expect(gear).not.toHaveAttribute('aria-current', 'page');
    await expect(strip(page).nth(FARM_TAB_INDEX)).toHaveAttribute('aria-current', 'page');
  });

  test('the gear is reached with the keyboard and opens Settings on Enter', async () => {
    await strip(page).nth(FARM_TAB_INDEX).click();
    await expect(page.getByTestId('farm-view')).toBeVisible({ timeout: 20_000 });

    const gear = page.getByTestId('shell-settings');
    await gear.focus();
    await expect(gear).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 20_000 });
    await expect(gear).toHaveAttribute('aria-current', 'page');
  });

  test('Progression opens on the Skill Tree, remembers Collections across a tab change, and stays current on both', async () => {
    const progression = strip(page).nth(PROGRESSION_TAB_INDEX);
    await expect(progression).toHaveAccessibleName(en('progressionNavLabel'));

    await progression.click();
    await expect(page.getByTestId('skills-view')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('collections-view')).toHaveCount(0);
    await expect(page.getByRole('group', { name: en('progressionSwitchLabel') })).toBeVisible();
    await expect(pageTab(page, 'skillsNavLabel')).toHaveAttribute('aria-selected', 'true');
    await expect(progression).toHaveAttribute('aria-current', 'page');
    // Settings was showing before this press, so the gear must have let go.
    await expect(page.getByTestId('shell-settings')).not.toHaveAttribute('aria-current', 'page');

    await pageTab(page, 'collectionsNavLabel').click();
    await expect(page.getByTestId('collections-view')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('skills-view')).toHaveCount(0);
    await expect(progression).toHaveAttribute('aria-current', 'page');

    await strip(page).nth(FARM_TAB_INDEX).click();
    await expect(page.getByTestId('farm-view')).toBeVisible({ timeout: 20_000 });
    await expect(progression).not.toHaveAttribute('aria-current', 'page');

    await progression.click();
    await expect(page.getByTestId('collections-view')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('skills-view')).toHaveCount(0);
    await expect(pageTab(page, 'collectionsNavLabel')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('nav[aria-label="Main"] button[aria-current="page"]')).toHaveCount(1);
    await expect(progression).toHaveAttribute('aria-current', 'page');
  });

  test('the Skill Tree page sits below its switch, leaving the tab drawn once and pressable, in both directions twice', async () => {
    await strip(page).nth(PROGRESSION_TAB_INDEX).click();
    const skillsTab = pageTab(page, 'skillsNavLabel');
    const collectionsTab = pageTab(page, 'collectionsNavLabel');

    for (let round = 0; round < 2; round += 1) {
      await skillsTab.click();
      await expect(page.getByTestId('skills-view')).toBeVisible({ timeout: 20_000 });
      await expect(skillsTab).toHaveAttribute('aria-selected', 'true');

      // The page's own panel title is the same words in a different case; it must not share the
      // tab's box. The screen's top edge is the line it may not cross.
      const geometry = await page.evaluate(() => {
        const group = document.querySelector('[data-testid="progression-page"] [role="group"]');
        const view = document.querySelector('[data-testid="skills-view"]');
        if (!group || !view) return null;
        return {
          tablists: group.querySelectorAll('[role="tablist"]').length,
          switchBottom: group.getBoundingClientRect().bottom,
          viewTop: view.getBoundingClientRect().top,
        };
      });
      expect(geometry, 'the switch and the page are both on screen').not.toBeNull();
      expect(geometry.tablists).toBe(1);
      expect(geometry.viewTop, 'the Skill Tree page starts under the switch').toBeGreaterThanOrEqual(geometry.switchBottom);
      await expect(page.getByRole('tab', { name: en('skillsNavLabel'), exact: true })).toHaveCount(1);

      await collectionsTab.click();
      await expect(page.getByTestId('collections-view')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('skills-view')).toHaveCount(0);
      await expect(collectionsTab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('with the actions folded behind the overflow button the gear is still a visible button of its own', async () => {
    await resize(app, page, ACTIONS_COLLAPSED_WINDOW);

    const gear = page.getByTestId('shell-settings');
    await expect(page.getByTestId('shell-overflow')).toBeVisible();
    await expect(page.getByTestId('shell-coffee')).toHaveCount(0);
    await expect(gear).toBeVisible();
    await expect(gear).toHaveAccessibleName(en('settingsNavLabel'));

    await page.getByTestId('shell-overflow').click();
    const menu = page.getByTestId('shell-overflow-menu');
    await expect(menu).toBeVisible({ timeout: 10_000 });
    await expect(menu.getByTestId('shell-settings'), 'the gear was folded into the overflow menu').toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    await strip(page).nth(FARM_TAB_INDEX).click();
    await expect(page.getByTestId('farm-view')).toBeVisible({ timeout: 20_000 });
    await gear.click();
    await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 20_000 });
    await expect(gear).toHaveAttribute('aria-current', 'page');
  });
});
