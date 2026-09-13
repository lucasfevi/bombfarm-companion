import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { formatCompactNumber } from '@bombfarm/ui/format-number';
import { seedLocalStorage } from './fixtures/seed';

/** The committed 13-hero capture: 221 item rows, phase 51, a max phase, no player name or id. */
const thirteenHeroSave = path.join(
  process.cwd(),
  '../../packages/domain/tests/fixtures/sheet-math/save-20260823-13heroes-crit-points.json',
);

/** One quote for a gear key the save holds eight tradable copies of, so the total is priced. */
const MARKET_SNAPSHOT = {
  schemaVersion: 3,
  generatedUtc: '2026-09-01T12:00:00.000Z',
  appId: 4892010,
  baseCurrency: 'USD',
  nativeCurrencies: ['BRL'],
  fx: { BRL: 5 },
  entries: [
    {
      hashName: 'Coal Pants (Rare)',
      name: 'Coal Pants',
      key: 'coal_calca#2',
      defId: 'coal_calca',
      kind: 'equipment',
      category: 'equip',
      set: 'coal',
      slot: 'calca',
      rarityIdx: 2,
      level: 10,
      act: null,
      lowestUsd: 2,
      lowestNative: { BRL: 10 },
      listings: 4,
      iconUrl: null,
      fetchedUtc: '2026-09-01T12:00:00.000Z',
      nativeQuotedUtc: '2026-09-01T06:00:00.000Z',
    },
  ],
  index: { 'coal_calca#2': 0 },
  alternates: {},
  unlisted: [],
  anomalies: [],
  coverage: {
    marketRows: 1,
    keyedRows: 1,
    pricedRows: 1,
    unkeyedRows: 0,
    catalogKeys: 1,
    matchedCatalogKeys: 1,
    searchCalls: 1,
  },
};

const card = (page: Page, name: string) => page.getByRole('article', { name, exact: true });
const needsCards = (page: Page) => page.locator('article[data-home-card-state="needs"]');
const navLinks = (page: Page) =>
  page.getByRole('navigation', { name: 'Main sections' }).getByRole('link');
const openSection = (page: Page, label: string) =>
  navLinks(page).filter({ hasText: new RegExp(`^${label}$`) }).click();

async function openEmptyHome(page: Page): Promise<void> {
  await seedLocalStorage(page, { heroes: [], lang: 'en' });
  await page.goto('/');
}

async function importThirteenHeroes(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(thirteenHeroSave);
  await expect(page.getByRole('dialog').getByText('Jon')).toBeVisible();
  await page.getByRole('button', { name: /import \d+ hero/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

const digitsOf = (text: string) => Number(text.replace(/[^\d]/g, ''));

test.describe('Home', () => {
  test('a first visit shows the import block and five cards that still need a save', async ({
    page,
  }) => {
    await openEmptyHome(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Your account, at a glance' })).toBeVisible();
    await expect(page.getByTestId('home-first-visit')).toBeVisible();
    await expect(page.getByTestId('home-status-strip')).toHaveCount(0);
    await expect(page.getByRole('article')).toHaveCount(6);
    await expect(needsCards(page)).toHaveCount(5);
    await expect(card(page, 'Download')).toHaveAttribute('data-home-card-state', 'ready');

    await expect(navLinks(page).first()).toHaveText('Home');
    await expect(navLinks(page).first()).toHaveAttribute('aria-current', 'page');
    await expect(navLinks(page).nth(1)).not.toHaveAttribute('aria-current', 'page');

    await page.getByTestId('home-first-visit').getByRole('button', { name: 'Import your save' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('an imported save fills the strip and every data card', async ({ page }) => {
    await openEmptyHome(page);
    await importThirteenHeroes(page);

    await expect(page.getByTestId('home-status-strip-text')).toHaveText(
      'Unknown player · no account id · 13 heroes · 221 items · save imported just now',
    );
    await expect(page.getByTestId('home-first-visit')).toHaveCount(0);
    await expect(page.getByRole('article')).toHaveCount(6);
    await expect(needsCards(page)).toHaveCount(0);
  });

  test("the planner card's first row is the farm page's first row", async ({ page }) => {
    await openEmptyHome(page);
    await importThirteenHeroes(page);

    await openSection(page, 'Farm');
    const boardRow = page.locator('tbody tr[data-testid^="farm-row-"]').first();
    await expect(boardRow).toHaveAttribute('aria-current', 'true');
    await boardRow.click();
    const farmRow = page.locator('tbody tr[aria-label]').first();
    await expect(farmRow).toBeVisible();
    const heroName = await farmRow.getAttribute('aria-label');
    const farmDps = digitsOf(await farmRow.locator('td').last().innerText());
    expect(heroName).not.toBeNull();
    expect(farmDps).toBeGreaterThan(0);

    await openSection(page, 'Home');
    const cardRow = card(page, 'Planner').locator('tbody tr').first();
    await expect(cardRow.locator('td').first()).toContainText(heroName!);
    await expect(cardRow.locator('td').nth(2)).toHaveText(formatCompactNumber(farmDps, 'en'));
  });

  test("the farm card's tiles are the board's current and best phases", async ({ page }) => {
    await openEmptyHome(page);
    await importThirteenHeroes(page);

    await expect(page.getByTestId('home-farm-current-phase')).toContainText('#51');
    const bestPhase = /#(\d+)/.exec(await page.getByTestId('home-farm-best-phase').innerText())?.[1];
    expect(bestPhase).toMatch(/^\d+$/);

    await openSection(page, 'Farm');
    const boardRow = page.locator('tbody tr[data-testid^="farm-row-"]').first();
    await expect(boardRow).toHaveAttribute('data-testid', `farm-row-${bestPhase}`);
  });

  test("the account card's total is the account page's total", async ({ page }) => {
    await page.route('**/market-prices.json', (route) => route.fulfill({ json: MARKET_SNAPSHOT }));
    await openEmptyHome(page);
    await importThirteenHeroes(page);

    await openSection(page, 'Account');
    const pageTotal = page.getByTestId('account-holdings-total');
    await expect(pageTotal).not.toHaveText('not listed');
    await expect(pageTotal).not.toHaveText(/^\D*0[.,]00$/);
    const total = await pageTotal.innerText();

    await openSection(page, 'Home');
    await expect(page.getByTestId('home-account-total')).toHaveText(total);
  });

  test('the grid folds from two rows to one column without a page-level scrollbar', async ({
    page,
  }) => {
    await openEmptyHome(page);
    await importThirteenHeroes(page);
    const planner = card(page, 'Planner');
    const farm = card(page, 'Farm');
    const tiles = () =>
      Promise.all([
        page.getByTestId('home-farm-current').boundingBox(),
        page.getByTestId('home-farm-best').boundingBox(),
      ]);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('home-farm-best')).toBeVisible();
    const [plannerWide, farmWide] = await Promise.all([planner.boundingBox(), farm.boundingBox()]);
    expect(plannerWide?.y).toBe(farmWide?.y);
    const [currentWide, bestWide] = await tiles();
    expect(currentWide?.y).toBe(bestWide?.y);

    await page.setViewportSize({ width: 1000, height: 800 });
    await expect
      .poll(async () => {
        const [top, next] = await Promise.all([planner.boundingBox(), farm.boundingBox()]);
        return top != null && next != null && next.y > top.y;
      })
      .toBe(true);

    await page.setViewportSize({ width: 600, height: 800 });
    await expect
      .poll(async () => {
        const [current, best] = await tiles();
        return current != null && best != null && best.y > current.y;
      })
      .toBe(true);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });
});
