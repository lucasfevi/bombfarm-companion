/**
 * The Heroes screen's share card in the real app, drawn from the fixture account: the dialog
 * opens on the player's name, its DPS follows the searchable phase picker, the picker's name
 * filter and rarity chips narrow the list without touching the card, a hero taken off the picker
 * leaves the card, and Copy as image leaves a PNG of the card, at twice its size, on the system
 * clipboard — read back through main, since that is the clipboard a chat app pastes from.
 *
 * The committed fixture carries no identity, so this run's copy of it is given an invented one.
 * `SHARE_CARD_ARTIFACT_DIR`, when set, keeps a screenshot of the dialog and the copied PNG —
 * visible runs only, since a hidden window cannot be screenshotted.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');
const PLAYER_NAME = 'Tester';
const ARTIFACT_DIR = process.env.SHARE_CARD_ARTIFACT_DIR;

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

const HEROES_TAB_INDEX = 2;

async function openHeroes(page) {
  await page.locator('nav[aria-label="Main"] button').nth(HEROES_TAB_INDEX).click();
  await page.waitForSelector('[data-testid="heroes-view"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid^="heroes-roster-row-"]', { timeout: 60_000 });
}

async function resize(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(180);
}

/** Every DPS figure on the card, by hero id. */
function cardDps(page) {
  return page.locator('[data-testid^="share-card-dps-"]').evaluateAll((nodes) =>
    Object.fromEntries(
      nodes.map((node) => [node.getAttribute('data-testid')?.replace('share-card-dps-', ''), node.textContent]),
    ),
  );
}

/** Through the searchable picker the Optimizer and the Combat tab use: open it, type, pick. */
async function setPhase(page, phase) {
  await page.getByTestId('share-card-phase').getByRole('combobox', { name: 'Phase' }).click();
  await expect(page.getByPlaceholder('Hard, Normal 2-1, or 151')).toBeFocused();
  await page.keyboard.type(String(phase));
  await page.getByRole('option', { name: `(#${String(phase)})`, exact: false }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.getByTestId('share-card-phase')).toContainText(`(#${String(phase)})`);
  await expect(page.getByTestId('share-card-footer-phase')).toContainText(`phase ${String(phase)}`);
  await expect(page.getByTestId('share-card-subtitle')).toContainText(`Current phase ${String(phase)}`);
}

/** The hero ids the picker lists right now. */
function listedHeroes(page) {
  return page.locator('[data-testid^="share-card-pick-hero-"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-testid')?.replace('share-card-pick-hero-', '')),
  );
}

/** The hero ids on the card right now. */
function cardHeroes(page) {
  return page
    .locator('[data-testid^="share-card-featured-"], [data-testid^="share-card-rest-"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-testid')?.replace(/^share-card-(featured|rest)-/, ''))
        .filter((id) => id !== undefined && id !== '' && id !== 'rest'),
    );
}

test.describe('the Heroes screen\'s share card', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;
  /** The developer's own clipboard, put back after the copy test overwrites it. */
  let savedClipboard;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-heroes-share-card-'));
    const fixture = JSON.parse(fs.readFileSync(ACCOUNT_OFFLINE_FIXTURE, 'utf8'));
    fixture.account = { ...fixture.account, player_name: PLAYER_NAME, account_id: 1 };
    const fixtureFile = path.join(runDir, 'account.json');
    fs.writeFileSync(fixtureFile, JSON.stringify(fixture));
    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: fixtureFile,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: path.join(runDir, 'user-data'),
    }));
    await acceptConsent(page);
    await resize(app, page, 1400, 1000);
    await openHeroes(page);
  });

  test.afterAll(async () => {
    if (savedClipboard) {
      await app
        ?.evaluate(({ clipboard, nativeImage }, saved) => {
          clipboard.clear();
          const image = saved.png ? nativeImage.createFromBuffer(Buffer.from(saved.png, 'base64')) : undefined;
          clipboard.write({ text: saved.text, html: saved.html, ...(image && !image.isEmpty() ? { image } : {}) });
        }, savedClipboard)
        .catch(() => undefined);
    }
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  test('Share opens the card on the player name, the squad and the account phase', async () => {
    await page.getByTestId('heroes-share-open').click();
    await expect(page.getByTestId('share-card-dialog')).toBeVisible();
    await expect(page.getByTestId('share-card-title')).toHaveText(PLAYER_NAME);
    await expect(page.getByTestId('share-card-subtitle')).toContainText('Current phase 51');
    await expect(page.getByTestId('share-card-subtitle')).toContainText('Max phase 137');
    await expect(page.getByTestId('share-card-subtitle')).not.toContainText('Account #');
    await expect(page.locator('[data-testid^="share-card-featured-"]')).toHaveCount(3);
    await expect(page.locator('[data-testid^="share-card-aura-"]')).toHaveCount(7);
  });

  test('picking a phase through the search moves the DPS, and the reset goes back', async () => {
    const before = await cardDps(page);
    const figured = Object.entries(before).filter(([, text]) => /\d/.test(text ?? ''));
    expect(figured.length).toBeGreaterThan(0);

    const reset = page.getByTestId('share-card-phase-reset');
    await expect(reset).toHaveText('Use my current phase (51)');
    await expect(reset).toBeDisabled();

    await setPhase(page, 137);
    await expect(reset).toBeEnabled();
    const after = await cardDps(page);
    expect(figured.some(([id, text]) => after[id] !== text)).toBe(true);

    await reset.click();
    await expect(page.getByTestId('share-card-subtitle')).toContainText('Current phase 51');
    await expect(page.getByTestId('share-card-phase')).toContainText('(#51)');
    await setPhase(page, 137);
  });

  test('the name filter and a rarity chip narrow the list, never the card', async () => {
    const everyone = await listedHeroes(page);
    const onCard = (await cardHeroes(page)).sort();
    expect(everyone.length).toBeGreaterThan(2);

    const filter = page.getByTestId('share-card-picker-filter');
    const firstName = (await page.locator('[data-testid="share-card-picker"] li').first().innerText()).split(/\s/)[0];
    await filter.fill(firstName);
    const byName = await listedHeroes(page);
    expect(byName.length).toBeGreaterThan(0);
    expect(byName.length).toBeLessThan(everyone.length);
    expect((await cardHeroes(page)).sort()).toEqual(onCard);
    await filter.fill('');
    await expect(page.locator('[data-testid^="share-card-pick-hero-"]')).toHaveCount(everyone.length);

    const chips = page.locator('[data-testid^="share-card-picker-rarity-"]');
    expect(await chips.count()).toBeGreaterThan(1);
    const chip = chips.first();
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    const byRarity = await listedHeroes(page);
    expect(byRarity.length).toBeGreaterThan(0);
    expect(byRarity.length).toBeLessThan(everyone.length);
    expect((await cardHeroes(page)).sort()).toEqual(onCard);
    await chip.click();
    await expect(page.locator('[data-testid^="share-card-pick-hero-"]')).toHaveCount(everyone.length);
  });

  test('a hero taken off the picker leaves the card', async () => {
    const featured = page.locator('[data-testid^="share-card-featured-"]').first();
    const heroId = (await featured.getAttribute('data-testid'))?.replace('share-card-featured-', '');
    expect(heroId).toBeTruthy();

    await page.getByTestId(`share-card-pick-hero-${heroId}`).uncheck();
    await expect(page.getByTestId(`share-card-featured-${heroId}`)).toHaveCount(0);
    await expect(page.getByTestId(`share-card-rest-${heroId}`)).toHaveCount(0);
  });

  test('Copy as image leaves a PNG of the card at twice its size on the clipboard', async () => {
    savedClipboard = await app.evaluate(({ clipboard }) => {
      const image = clipboard.readImage();
      const saved = {
        text: clipboard.readText(),
        html: clipboard.readHTML(),
        png: image.isEmpty() ? '' : image.toPNG().toString('base64'),
      };
      clipboard.clear();
      return saved;
    });
    const card = page.getByTestId('share-card');
    const size = await card.evaluate((node) => ({ width: node.offsetWidth, height: node.offsetHeight }));

    if (ARTIFACT_DIR) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'share-dialog.png') });
    }

    await page.getByTestId('share-card-copy').click();
    await expect(page.getByTestId('share-card-copy-status')).toHaveText('Copied', { timeout: 30_000 });
    await expect(page.getByTestId('share-card-copied-icon').locator('svg')).toBeVisible();

    const held = await app.evaluate(({ clipboard }) => {
      const image = clipboard.readImage();
      return { empty: image.isEmpty(), size: image.getSize(), png: image.toPNG().toString('base64') };
    });
    expect(held.empty).toBe(false);
    expect(held.size.width).toBe(size.width * 2);
    expect(Math.abs(held.size.height - size.height * 2)).toBeLessThanOrEqual(2);
    if (ARTIFACT_DIR) fs.writeFileSync(path.join(ARTIFACT_DIR, 'share-card-clipboard.png'), Buffer.from(held.png, 'base64'));
  });
});
