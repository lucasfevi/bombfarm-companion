/**
 * The Skill Tree tab, end to end in the real app: the fixture account's `skills` section reaches
 * the tab, the shared screen draws the tree's canvas and its recommendation panel, and the roster
 * is priced — in both languages. The unit tests under `renderer/app/skills` and
 * `renderer/lib/skills` prove each piece; only a launched window proves they were wired to each
 * other, and that the tenth tab reaches its screen at all.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

const SKILLS_TAB_INDEX = 7;

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
const PT_BR_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'pt-BR.ts');
const copyFileCache = new Map();

function readCopyValue(filePath, key) {
  let source = copyFileCache.get(filePath);
  if (source === undefined) {
    source = fs.readFileSync(filePath, 'utf8');
    copyFileCache.set(filePath, source);
  }
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) {
    throw new Error(`skills.spec.mjs: could not find copy key "${key}" in ${filePath}`);
  }
  return match[1];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);
const pt = (key) => readCopyValue(PT_BR_COPY_PATH, key);

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
async function openSkills(page) {
  await navButton(page, SKILLS_TAB_INDEX).click();
  await page.waitForSelector('[data-testid="skills-view"]', { timeout: 20_000 });
}

/** The shared screen names its canvas and heads its recommendation panel from the label bag the
 *  host builds, so the two are located by the words this app's copy gives them. */
async function expectScreenDrawn(page, copy) {
  const view = page.getByTestId('skills-view');
  await expect(view).toBeVisible();
  await expect(view.getByLabel(copy('skillsCanvasAria'))).toBeVisible({ timeout: 20_000 });
  await expect(view.getByRole('heading', { name: copy('skillsNextToBuy') })).toBeVisible();
  // The offline account carries every section the farm board prices from, so the recommendation
  // panel has figures rather than the "could not be priced" line.
  await expect(view).toHaveAttribute('data-pricing', 'priced', { timeout: 20_000 });
}

test.describe('Skill Tree tab — the fixture account\'s tree, drawn and priced', () => {
  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-skills-'));
    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_OFFLINE_FIXTURE,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: path.join(runDir, 'user-data'),
    }));
    await acceptConsent(page);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  test('the tab is named Skill Tree and draws the tree canvas and the next-to-buy panel, priced', async () => {
    await expect(navButton(page, SKILLS_TAB_INDEX)).toHaveAccessibleName(en('skillsNavLabel'));
    await openSkills(page);
    await expectScreenDrawn(page, en);
  });

  test('the same screen in Portuguese, through the top bar\'s language switch', async () => {
    await page.locator('[role="group"] button', { hasText: 'PT' }).click();
    await expect(navButton(page, SKILLS_TAB_INDEX)).toHaveAccessibleName(pt('skillsNavLabel'), { timeout: 10_000 });
    await openSkills(page);
    await expectScreenDrawn(page, pt);

    await page.locator('[role="group"] button', { hasText: 'EN' }).click();
    await expect(navButton(page, SKILLS_TAB_INDEX)).toHaveAccessibleName(en('skillsNavLabel'), { timeout: 10_000 });
  });
});
