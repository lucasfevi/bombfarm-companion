import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { teamPlanFixtureSeed, teamPlanRichSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage, selectSavedHero } from './fixtures/seed';
import {
  clickOptimize,
  gotoTeamPlan,
  readForgeFloorValue,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

const sampleSave = path.join(process.cwd(), 'e2e/fixtures/sample-save.json');

/** The ledger's own title, so a stale-but-not-broken plan (a control change alone) leaves no
 *  reader-visible trace and a genuinely broken one does. */
const LEDGER_TITLE = /Your account changed since this plan was built/i;

function seedWithForgeFloor(floor: number) {
  const base = teamPlanFixtureSeed('en');
  return { ...base, account: { ...base.account!, forgeFloor: floor } };
}

/** Deleting a hero the plan placed BREAKS the plan, unlike a control change, which only changes
 *  it — the ledger only ever draws once something does. */
async function deleteHero(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('link', { name: /^heroes$|^heróis$/i }).click();
  await selectSavedHero(page, name);
  await page.getByRole('button', { name: 'Delete hero' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
}

test.describe('Team plan min forge', () => {
  test('stepper increments min forge in the UI', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    const increment = page.getByRole('button', { name: /Min forge \(\+\) \+/i });
    for (let i = 0; i < 5; i++) await increment.click();
    await expect(await readForgeFloorValue(page)).toBe('15');
  });

  test('loads persisted min forge and clamps out of range', async ({ page }) => {
    await seedLocalStorage(page, seedWithForgeFloor(15));
    await gotoTeamPlan(page);
    await expect(await readForgeFloorValue(page)).toBe('15');

    await seedLocalStorage(page, seedWithForgeFloor(99));
    await page.goto('/optimizer');
    await expect(await readForgeFloorValue(page)).toBe('15');

    await seedLocalStorage(page, seedWithForgeFloor(-1));
    await page.goto('/optimizer');
    await expect(await readForgeFloorValue(page)).toBe('0');
  });

  test('changing min forge marks the plan stale, but only a breaking change surfaces the ledger', async ({ page }) => {
    // The seven-hero capture: every hero is in scope and uniquely named, so the first one is a
    // hero the plan placed and the picker's row resolves to exactly one avatar.
    const seed = teamPlanRichSeed('en');
    await seedLocalStorage(page, seed);
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    await page.getByRole('button', { name: /Min forge \(\+\) \+/i }).click();
    // A control change alone only changes the plan — the results stay as they were, and the
    // ledger stays unmounted.
    await expect(page.getByText(LEDGER_TITLE)).toHaveCount(0);

    await deleteHero(page, seed.heroes[0]!.name);
    // Back to the optimizer in-page: a reload would drop what the plan was solved from, and with
    // that gone the screen can only say the inputs moved, not what broke.
    await page.getByRole('navigation', { name: 'Main sections' }).getByRole('link', { name: /^Optimizer$/ }).click();
    await expect(page.getByText(LEDGER_TITLE)).toBeVisible();
  });

  test('import does not reset min forge', async ({ page }) => {
    await seedLocalStorage(page, seedWithForgeFloor(12));
    await gotoTeamPlan(page);
    await expect(await readForgeFloorValue(page)).toBe('12');

    await page.getByRole('button', { name: /^Import/i }).click();
    await page.locator('input[type="file"]').setInputFiles(sampleSave);
    await page.getByRole('button', { name: /import \d+ hero/i }).click();
    await page.goto('/optimizer');
    await expect(await readForgeFloorValue(page)).toBe('12');
  });
});
