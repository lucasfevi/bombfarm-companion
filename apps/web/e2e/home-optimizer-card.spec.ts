import { test, expect, type Locator, type Page } from '@playwright/test';
import { seedLocalStorage, selectSavedHero } from './fixtures/seed';
import { setE2eMaxEvaluations } from './fixtures/team-plan-e2e';
import { teamPlanRichSeed } from './fixtures/team-plan-seed';

const PLAN_KEY = 'bf-hp-team-plan-v1';
const HEROES_KEY = 'bf-hp-heroes-v1';
const HEADLINE = /^[+-]\d+([.,]\d)?% (gold \/ hour|DPS), whole roster$/;
const STALE_NOTICE = /Inputs changed since this plan was computed/i;

const card = (page: Page) => page.getByRole('article', { name: 'Optimizer', exact: true });
const headline = (page: Page) => page.getByTestId('home-optimizer-headline');
const optimizing = (page: Page) => page.getByTestId('home-optimizer-optimizing');
const seePlan = (page: Page) => page.getByTestId('home-optimizer-see-plan');
const results = (page: Page) => page.getByRole('region', { name: /^Team plan results$/i });
const staleNotice = (page: Page) => page.getByRole('status').filter({ hasText: STALE_NOTICE });
const optimizeButton = (page: Page) => page.getByRole('button', { name: /^Build a team plan of /i });

async function openSection(page: Page, label: string) {
  await page
    .getByRole('navigation', { name: 'Main sections' })
    .getByRole('link', { name: new RegExp(`^${label}$`) })
    .click();
}

async function cardState(page: Page, state: string, timeout = 60_000) {
  await expect(card(page)).toHaveAttribute('data-home-card-state', state, { timeout });
}

function workerChunkLoads(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('team-plan-worker')).length,
  );
}

async function waitForPersistedPlan(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), PLAN_KEY), { timeout: 5_000 })
    .not.toBeNull();
}

async function pickObjective(page: Page, optionName: RegExp) {
  await page.getByRole('combobox', { name: /^What this search scores a roster on$/i }).click();
  await page.getByRole('option', { name: optionName }).click();
}

function storedLevelOf(page: Page, name: string): Promise<number | null> {
  return page.evaluate(
    ({ key, heroName }) => {
      const heroes = JSON.parse(localStorage.getItem(key) ?? '[]') as { name: string; level: number }[];
      return heroes.find((hero) => hero.name === heroName)?.level ?? null;
    },
    { key: HEROES_KEY, heroName: name },
  );
}

async function levelUpAHero(page: Page, name: string) {
  await openSection(page, 'Heroes');
  await selectSavedHero(page, name);
  const before = await storedLevelOf(page, name);
  expect(before).not.toBeNull();
  await page.getByRole('button', { name: 'Level up', exact: true }).click();
  await expect.poll(() => storedLevelOf(page, name), { timeout: 5_000 }).toBe(before! + 1);
}

async function textOf(locator: Locator): Promise<string> {
  await expect(locator).toBeVisible();
  return (await locator.textContent()) ?? '';
}

/** Enough of a search for the gain to clear the worth-making floor, still well under a second. */
const EVALUATIONS = 400;

test.describe('Home optimizer card', () => {
  test.describe.configure({ timeout: 90_000 });
  const seed = teamPlanRichSeed('en');
  const heroToEdit = seed.heroes[0]!.name;

  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, seed);
    await setE2eMaxEvaluations(page, EVALUATIONS);
    await page.goto('/');
  });

  test('a first visit says it is building the plan, solves once, then shows the gain and the way to the full plan', async ({
    page,
  }) => {
    await cardState(page, 'optimizing');
    await expect(optimizing(page)).toHaveText('Building plan…');
    await cardState(page, 'plan');

    await expect(headline(page)).toBeVisible();
    await expect(headline(page)).toHaveText(HEADLINE);
    await expect(page.getByTestId('home-optimizer-scored-at')).toContainText(/^scored at /);
    await expect(seePlan(page)).toHaveText('See the full plan →');
    await expect(seePlan(page)).toHaveAttribute('href', '/optimizer');
    await waitForPersistedPlan(page);
    await page.waitForLoadState('networkidle');
    expect(await workerChunkLoads(page)).toBe(1);
  });

  test('the optimizer page opens on the plan the front page built, with no click', async ({
    page,
  }) => {
    await cardState(page, 'plan');
    await waitForPersistedPlan(page);

    await page.goto('/optimizer');

    await expect(results(page)).toBeVisible();
    await expect(optimizeButton(page)).toBeEnabled();
    await expect(staleNotice(page)).toHaveCount(0);
  });

  test('a reload shows the plan at once and starts no worker', async ({ page }) => {
    await cardState(page, 'plan');
    const before = await textOf(headline(page));
    await waitForPersistedPlan(page);

    await page.reload();

    await cardState(page, 'plan');
    await expect(optimizing(page)).toHaveCount(0);
    await expect(headline(page)).toHaveText(before);
    await page.waitForLoadState('networkidle');
    expect(await workerChunkLoads(page)).toBe(0);
  });

  test('a hero edit puts the old plan under Recalculating until the new solve lands', async ({
    page,
  }) => {
    await cardState(page, 'plan');
    const before = await textOf(headline(page));

    await levelUpAHero(page, heroToEdit);
    await openSection(page, 'Home');

    await cardState(page, 'recalculating');
    await expect(headline(page)).toHaveText(before);
    await expect(card(page)).toContainText('Recalculating…');
    await cardState(page, 'plan');
    await expect(headline(page)).toHaveText(HEADLINE);
  });

  test('a control change on the optimizer page clears the plan and the front page solves again', async ({
    page,
  }) => {
    await cardState(page, 'plan');
    await expect(headline(page)).toHaveText(/gold \/ hour/);

    await openSection(page, 'Optimizer');
    await pickObjective(page, /^DPS$/i);
    await openSection(page, 'Home');

    await cardState(page, 'optimizing');
    await cardState(page, 'plan');
    await expect(headline(page)).toHaveText(/^[+-]\d+([.,]\d)?% DPS, whole roster$/);
    await page.waitForLoadState('networkidle');
    expect(await workerChunkLoads(page)).toBe(2);
  });

  test('a plan made stale by a hero edit stays stale when the optimizer page is opened directly', async ({
    page,
  }) => {
    await cardState(page, 'plan');

    await levelUpAHero(page, heroToEdit);
    await openSection(page, 'Optimizer');

    await expect(results(page)).toBeVisible();
    await expect(staleNotice(page)).toBeVisible();
    await expect(optimizeButton(page)).toBeEnabled();
  });

  test('a plan cleared on the optimizer page does not come back when the page is reopened', async ({
    page,
  }) => {
    await cardState(page, 'plan');

    await openSection(page, 'Optimizer');
    await expect(results(page)).toBeVisible();
    await pickObjective(page, /^DPS$/i);
    await expect(results(page)).toHaveCount(0);

    await openSection(page, 'Heroes');
    await expect(page.getByRole('region', { name: /current hero/i })).toBeVisible();
    await openSection(page, 'Optimizer');

    await expect(optimizeButton(page)).toBeEnabled();
    await expect(results(page)).toHaveCount(0);
  });
});
