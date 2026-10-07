import { test, expect, type Locator, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero } from './fixtures/seed';

const GEAR_TAB = /^gear$|^equipamento$/i;
const COMBAT_TAB = /^combat$|^combate$/i;
const ITEM_LEVEL = /^(?:item level|nível do item)$/i;
const ITEM_RARITY = /^(?:item rarity|raridade do item)$/i;
const FORGE_LEVEL = /^(?:forge level|forja)$/i;
const CLEAR_SLOT = /^(?:clear|limpar)$/i;
const COPY_GEAR = /^(?:copy current gear|copiar equipamento atual)$/i;
const APPLY_TO_CURRENT = /^(?:apply to current|aplicar no atual)$/i;
const GEAR_TOTALS = /^(?:totals|totais)$/i;
const EMPTY_SLOT = /— (?:empty|vazio)$/;
const SCOREBOARD = /(?:sustained dps|dps efetivo) · hit/i;
const SUSTAINED_METRIC = /sustained dps|dps efetivo/i;
const CURRENT_SIDE = /current|atual/i;
const CLONE_SIDE = /clone/i;
const LEVEL_100 = /(?:level|nível) 100(?!\d)/i;
const EPIC = /^(?:epic|épico)$/i;

/** The catalog's slot order, which is the order both gear grids draw. */
const SLOT_ORDER = ['arma', 'elmo', 'anel', 'amuleto', 'peito', 'calca', 'luva', 'bota'];

const SLOT_EDITOR = '(?:edit gear by slot|editar equipamento por slot)';
const CURRENT_GRID = new RegExp(`^${SLOT_EDITOR} · (?:current|atual)$`, 'i');
const CLONE_GRID = new RegExp(`^${SLOT_EDITOR} · clone$`, 'i');

const CORA = 'seed-cora';

type StoredItem = { defId: string; rarityIdx: number; level: number; upgrade: number } | null;

function activePanel(page: Page) {
  return page.locator('[data-slot="tabs-panel"][data-state="active"]');
}

async function openTab(page: Page, name: RegExp) {
  await page.getByRole('tab', { name }).click();
}

/** An editable gear grid, addressed by the loadout it edits rather than by where it is drawn. */
function gearGrid(page: Page, name: RegExp): Locator {
  return activePanel(page).getByRole('group', { name });
}

function currentSlot(page: Page, slot: string): Locator {
  return gearGrid(page, CURRENT_GRID).locator(`[data-gear-slot="${slot}"]`);
}

/** The compare clone's card for a slot — drawn only while a clone exists. */
function cloneSlot(page: Page, slot: string): Locator {
  return gearGrid(page, CLONE_GRID).locator(`[data-gear-slot="${slot}"]`);
}

async function slotsIn(page: Page, name: RegExp): Promise<(string | null)[]> {
  return gearGrid(page, name)
    .locator('[data-gear-slot]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-gear-slot')));
}

async function pick(page: Page, combobox: Locator, option: RegExp) {
  await combobox.click();
  await page.getByRole('option', { name: option }).click();
}

/**
 * Reads a locale-formatted figure as the integer of its digits.
 *
 * The planner groups thousands with `.` in Portuguese and `,` in English, so parsing the text as
 * a decimal needs to know the language; comparing two readings of the SAME card does not, because
 * `formatBreakdownValue` pins that card's decimal count. Digits alone are therefore monotone in
 * both languages, which is what every comparison below needs.
 */
function digits(text: string): number {
  const onlyDigits = text.replace(/\D/g, '');
  if (onlyDigits === '') throw new Error(`no digits to read in ${JSON.stringify(text)}`);
  return Number(onlyDigits);
}

async function readBreakdownCard(page: Page, id: string): Promise<number> {
  const value = activePanel(page).locator(
    `[data-breakdown-card="${id}"] [data-testid="breakdown-value"]`,
  );
  await expect(value, id).toBeVisible();
  await expect(value, id).not.toHaveText('');
  return digits(await value.innerText());
}

async function storedLoadoutItem(page: Page, heroId: string, slot: string): Promise<StoredItem> {
  const raw = await page.evaluate(() => localStorage.getItem('bf-hp-heroes-v1'));
  const heroes = JSON.parse(raw ?? '[]') as { id: string; loadout?: Record<string, StoredItem> }[];
  return heroes.find((hero) => hero.id === heroId)?.loadout?.[slot] ?? null;
}

function scoreboard(page: Page) {
  return activePanel(page).getByRole('group', { name: SCOREBOARD });
}

function metricCell(page: Page, index: number) {
  return scoreboard(page).locator('> div').nth(index);
}

async function readMetric(page: Page, index: number): Promise<number> {
  const value = metricCell(page, index).locator('strong');
  await expect(value).not.toHaveText('');
  return digits(await value.innerText());
}

function metricDelta(page: Page, index: number) {
  return metricCell(page, index).locator('span').last();
}

async function openPlannerOnCora(page: Page) {
  await seedLocalStorage(page, importedRoster);
  await page.goto('/heroes');
  await selectSavedHero(page, 'Cora');
}

/** Equips the seeded weapon slot from empty: a level-100 common piece, forge +0. */
async function equipLevel100Weapon(page: Page) {
  await pick(page, currentSlot(page, 'arma').getByRole('combobox', { name: ITEM_LEVEL }), LEVEL_100);
  await expect(currentSlot(page, 'arma')).not.toHaveAttribute('aria-label', EMPTY_SLOT);
}

test.describe('gear slot editing on the planner', () => {
  test('equipping a weapon on an empty slot raises the Sustained DPS the Combat tab derives, and clearing the slot puts it back', async ({
    page,
  }) => {
    await openPlannerOnCora(page);

    await openTab(page, COMBAT_TAB);
    const bareDps = await readBreakdownCard(page, 'sustainedDps');
    const bareAttack = await readBreakdownCard(page, 'attack');

    await openTab(page, GEAR_TAB);
    await expect(currentSlot(page, 'arma')).toHaveAttribute('aria-label', EMPTY_SLOT);
    await expect(activePanel(page).getByRole('region', { name: GEAR_TOTALS })).toHaveCount(0);
    expect(await slotsIn(page, CURRENT_GRID)).toEqual(SLOT_ORDER);
    await expect(gearGrid(page, CLONE_GRID)).toHaveCount(0);

    await equipLevel100Weapon(page);
    await expect(activePanel(page).getByRole('region', { name: GEAR_TOTALS })).toBeVisible();

    await openTab(page, COMBAT_TAB);
    const gearedAttack = await readBreakdownCard(page, 'attack');
    const gearedDps = await readBreakdownCard(page, 'sustainedDps');
    // The piece carries 2887.5 flat damage against a hero whose whole geared Attack is 1470.4,
    // so anything short of a doubling means the slot never reached the sheet.
    expect(gearedAttack, 'effective Attack after equipping a level-100 weapon').toBeGreaterThan(
      bareAttack * 2,
    );
    expect(gearedDps, 'sustained DPS after equipping a level-100 weapon').toBeGreaterThan(
      bareDps * 2,
    );

    await openTab(page, GEAR_TAB);
    await currentSlot(page, 'arma').getByRole('button', { name: CLEAR_SLOT }).click();
    await expect(currentSlot(page, 'arma')).toHaveAttribute('aria-label', EMPTY_SLOT);

    await openTab(page, COMBAT_TAB);
    expect(
      await readBreakdownCard(page, 'sustainedDps'),
      'sustained DPS after clearing the weapon back to empty',
    ).toBe(bareDps);
    expect(
      await readBreakdownCard(page, 'attack'),
      'effective Attack after clearing the weapon back to empty',
    ).toBe(bareAttack);
  });

  test('the equipped item is written to the roster and a fresh load rebuilds the same figures from it', async ({
    page,
  }) => {
    await openPlannerOnCora(page);
    await openTab(page, GEAR_TAB);

    const weapon = currentSlot(page, 'arma');
    await equipLevel100Weapon(page);
    await pick(page, weapon.getByRole('combobox', { name: ITEM_RARITY }), EPIC);
    await pick(page, weapon.getByRole('combobox', { name: FORGE_LEVEL }), /^\+5 ×1\.25$/);

    await expect
      .poll(() => storedLoadoutItem(page, CORA, 'arma'), {
        message: 'the weapon slot the draft autosave wrote to the roster',
        timeout: 5_000,
      })
      .toEqual({ defId: 'forest_arma', rarityIdx: 3, level: 100, upgrade: 5 });

    await openTab(page, COMBAT_TAB);
    const dpsBeforeReload = await readBreakdownCard(page, 'sustainedDps');

    // A literal `page.reload()` would prove nothing: `seedLocalStorage` re-applies its payload on
    // every navigation, so it would restore the gearless seed and erase the edit under test.
    // Re-seeding with what the app actually wrote is what exercises hydration.
    const written = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('bf-hp-heroes-v1') ?? '[]'),
    );
    await seedLocalStorage(page, { ...importedRoster, heroes: written });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');

    await openTab(page, GEAR_TAB);
    const reloadedWeapon = currentSlot(page, 'arma');
    await expect(reloadedWeapon.getByRole('combobox', { name: ITEM_LEVEL })).toHaveText(LEVEL_100);
    await expect(reloadedWeapon.getByRole('combobox', { name: ITEM_RARITY })).toHaveText(EPIC);
    await expect(reloadedWeapon.getByRole('combobox', { name: FORGE_LEVEL })).toHaveText(
      '+5 ×1.25',
    );

    await openTab(page, COMBAT_TAB);
    expect(
      await readBreakdownCard(page, 'sustainedDps'),
      'sustained DPS rebuilt from the stored loadout on a fresh load',
    ).toBe(dpsBeforeReload);
  });

  test('the compare clone starts level with current gear, a forge change on the clone moves the clone alone, and applying it moves current gear', async ({
    page,
  }) => {
    await openPlannerOnCora(page);
    await openTab(page, GEAR_TAB);
    await equipLevel100Weapon(page);

    await activePanel(page).getByRole('button', { name: COPY_GEAR }).click();
    await expect(activePanel(page).getByRole('button', { name: APPLY_TO_CURRENT })).toBeVisible();
    await expect(scoreboard(page)).toBeVisible();
    await expect(cloneSlot(page, 'arma')).toBeVisible();
    expect(
      await slotsIn(page, CLONE_GRID),
      'the clone grid draws the same eight slots the current grid does',
    ).toEqual(SLOT_ORDER);
    expect(await slotsIn(page, CURRENT_GRID)).toEqual(SLOT_ORDER);

    await expect(metricCell(page, 0)).toContainText(SUSTAINED_METRIC);
    await expect(metricCell(page, 0)).toContainText(CURRENT_SIDE);
    await expect(metricCell(page, 2)).toContainText(SUSTAINED_METRIC);
    await expect(metricCell(page, 2)).toContainText(CLONE_SIDE);
    // A clone copied verbatim from current gear is worth exactly what current gear is worth.
    await expect(metricDelta(page, 2)).toHaveText(/^\+0[.,]0%$/);
    expect(
      await readMetric(page, 2),
      'the copied clone prints the same DPS figure as current gear, not only the same delta',
    ).toBe(await readMetric(page, 0));
    expect(
      await readMetric(page, 3),
      'the copied clone prints the same hit figure as current gear',
    ).toBe(await readMetric(page, 1));

    const currentDps = await readMetric(page, 0);
    const copiedCloneDps = await readMetric(page, 2);
    await pick(
      page,
      cloneSlot(page, 'arma').getByRole('combobox', { name: FORGE_LEVEL }),
      /^\+10 ×1\.50$/,
    );

    await expect(cloneSlot(page, 'arma').getByRole('combobox', { name: FORGE_LEVEL })).toHaveText(
      '+10 ×1.50',
    );
    await expect(
      currentSlot(page, 'arma').getByRole('combobox', { name: FORGE_LEVEL }),
      'current gear is untouched by an edit made on the clone',
    ).toHaveText('+0 ×1.00');
    // Forge +10 multiplies the weapon's flat damage by 1.8, which carries most of this hero's
    // Attack, so a clone that moved by less than a third never re-priced the piece.
    expect(
      await readMetric(page, 2),
      'the clone DPS after forging the clone weapon to +10',
    ).toBeGreaterThan(copiedCloneDps * 1.3);
    expect(await readMetric(page, 0), 'the current DPS while only the clone was edited').toBe(
      currentDps,
    );
    await expect(metricDelta(page, 2)).toHaveText(/^\+[1-9]/);

    await activePanel(page).getByRole('button', { name: APPLY_TO_CURRENT }).click();
    await expect(currentSlot(page, 'arma').getByRole('combobox', { name: FORGE_LEVEL })).toHaveText(
      '+10 ×1.50',
    );
    const appliedDps = await readMetric(page, 0);
    expect(appliedDps, 'the current DPS after applying the clone to current gear').toBeGreaterThan(
      currentDps * 1.3,
    );
    await expect(metricDelta(page, 2)).toHaveText(/^\+0[.,]0%$/);

    await openTab(page, COMBAT_TAB);
    expect(
      await readBreakdownCard(page, 'sustainedDps'),
      'the Combat tab agrees with the compare scoreboard after applying the clone',
    ).toBe(appliedDps);
  });
});
