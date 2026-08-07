import { expect, type Page } from '@playwright/test';

export const E2E_MAX_EVAL_KEY = 'bf-e2e-gear-plan-max-eval';
export const E2E_FORCE_ERROR_KEY = 'bf-e2e-gear-plan-force-error';
const ACCOUNT_KEY = 'bf-hp-account-v1';
const HEROES_KEY = 'bf-hp-heroes-v1';
const ACTIVE_KEY = 'bf-hp-active-hero-v1';
const INVENTORY_KEY = 'bf-hp-inventory-v1';

const PLANNER_STORAGE_KEYS = [HEROES_KEY, ACCOUNT_KEY, INVENTORY_KEY, ACTIVE_KEY] as const;

export async function gotoGearPlan(page: Page) {
  await page.goto('/gear-plan');
  await expect(page.getByRole('region', { name: /Roster gear plan/i })).toBeVisible();
}

export function scopePanel(page: Page) {
  return page
    .getByRole('heading', { name: /^Hero scope$/i, level: 2 })
    .locator('xpath=ancestor::section[1]');
}

export function disclosuresPanel(page: Page) {
  return page
    .getByRole('heading', { name: /^Assumptions & limits$/i, level: 2 })
    .locator('xpath=ancestor::section[1]');
}

export async function clickOptimize(page: Page) {
  const button = page.getByRole('button', { name: /Run the roster gear search/i });
  await expect(button).toBeEnabled();
  await button.click();
}

export async function waitForOptimizeDone(page: Page, timeout = 120_000) {
  await expect(page.getByRole('button', { name: /Run the roster gear search/i })).toBeEnabled({
    timeout,
  });
  await expect(page.getByText(/^Regime:/i)).toBeVisible({ timeout });
}

export async function setE2eMaxEvaluations(page: Page, maxEvaluations: number | null) {
  await page.addInitScript(
    ({ key, value }) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    },
    { key: E2E_MAX_EVAL_KEY, value: maxEvaluations },
  );
}

export async function setE2eForceError(page: Page, enabled: boolean) {
  await page.addInitScript(
    ({ key, value }) => {
      if (value) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    },
    { key: E2E_FORCE_ERROR_KEY, value: enabled },
  );
}

export async function setAccountForgeFloor(page: Page, forgeFloor: number) {
  await page.goto('/gear-plan');
  await page.evaluate(
    ({ key, floor }) => {
      const raw = localStorage.getItem(key);
      const account = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      account.forgeFloor = floor;
      localStorage.setItem(key, JSON.stringify(account));
    },
    { key: ACCOUNT_KEY, floor: forgeFloor },
  );
}

export async function readForgeFloorValue(page: Page): Promise<string> {
  const value = page
    .getByRole('heading', { name: /^Forge floor$/i, level: 2 })
    .locator('xpath=ancestor::section[1]//b')
    .first();
  await expect(value).toBeVisible();
  return (await value.textContent()) ?? '';
}

export async function snapshotHeroesJson(page: Page): Promise<string> {
  return page.evaluate((key) => localStorage.getItem(key) ?? '', HEROES_KEY);
}

/** Re-applies the current planner keys after navigation so addInitScript seeds do not clobber writes. */
export async function pinPlannerStorageForNavigation(page: Page) {
  const snapshot = await page.evaluate((keys) => {
    return Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)]));
  }, [...PLANNER_STORAGE_KEYS]);

  await page.addInitScript((data) => {
    for (const [key, value] of Object.entries(data)) {
      if (value !== null) localStorage.setItem(key, value);
    }
  }, snapshot);
}

export async function waitForAccountForgeFloor(page: Page, floor: number) {
  await page.waitForFunction(
    ({ key, expected }) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const account = JSON.parse(raw) as { forgeFloor?: number };
      return account.forgeFloor === expected;
    },
    { key: ACCOUNT_KEY, expected: floor },
    { timeout: 5_000 },
  );
}
