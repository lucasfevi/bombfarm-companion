import { test, expect, type Locator, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero } from './fixtures/seed';

/**
 * The Abilities & auras section on the Combat tab: every team aura the game has, each behind a
 * switch unless it is the hero's own; a switch prices the aura at its cap and reaches every
 * planner figure that reads the pipeline, and nothing on the Farm page.
 *
 * War Cry and Miner's Breath are the auras asserted on. The seed roster stores crit in save
 * units, so Deadly Omen's delta is not a figure to pin here.
 */
const TEAM_AURA_IDS = ['grito_guerra', 'pressagio_mortal', 'marcha_acelerada', 'folego_mineiro', 'brecha', 'passagem_bastao'] as const;

/** Lorne carries War Cry at rank 12; Cora carries no team aura at all. */
const roster = {
  ...importedRoster,
  lang: 'en' as const,
  heroes: importedRoster.heroes.map((h) =>
    h.id === 'seed-lorne' ? { ...h, abilities: { ...h.abilities, grito_guerra: 12 } } : h,
  ),
};

async function openCombatTab(page: Page) {
  await page.getByRole('tab', { name: /^combat$/i }).click();
}

async function openPointsTab(page: Page) {
  await page.getByRole('tab', { name: /^points$/i }).click();
}

function activePanel(page: Page) {
  return page.locator('[data-slot="tabs-panel"][data-state="active"]');
}

function auraSection(page: Page) {
  return activePanel(page).getByTestId('abilities-auras');
}

/** The strip's Sustained DPS, at full precision from the figure's own tooltip. */
async function stripSustainedDps(page: Page): Promise<number> {
  const strip = page.getByRole('region', { name: /current hero/i });
  const value = strip.getByText(/^Sustained DPS$/i).locator('xpath=../strong');
  const title = await value.getAttribute('title');
  return Number((title ?? '').replace(/,/g, ''));
}

/** The Combat tab's Sustained DPS figure — the Effective panel's card, which the tab states once. */
async function combatSustainedDps(page: Page): Promise<number> {
  const card = activePanel(page).locator('[data-breakdown-card="sustainedDps"] [data-testid="breakdown-value"]');
  const text = (await card.innerText()).replace(/,/g, '');
  const match = /(\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!match) throw new Error(`no figure in "${text}"`);
  return Number(match[1]);
}

async function promisedDeltaPct(row: Locator): Promise<number> {
  const text = await row.getByTestId('team-aura-delta').innerText();
  const match = /([+−-])(\d+(?:\.\d+)?)%/.exec(text);
  if (!match) throw new Error(`no delta in "${text}"`);
  return (match[1] === '+' ? 1 : -1) * Number(match[2]);
}

/**
 * Both figures print integers (the strip's tooltip and the Combat row), so the observed move
 * carries each one's rounding on top of the row's one-decimal display precision.
 */
function moveTolerancePct(before: number, after: number): number {
  return 0.05 + 100 * (0.5 / before + 0.5 / after);
}

async function energyRankingText(page: Page): Promise<string> {
  await openPointsTab(page);
  const panel = activePanel(page).locator('section, div').filter({
    has: page.getByRole('heading', { name: /^Next point$/i, level: 2 }),
  });
  const text = await panel.first().innerText();
  const match = /Energy\s*\n?\s*([+−-]\d+(?:\.\d+)?%)/.exec(text);
  if (!match) throw new Error(`no Energy row in "${text}"`);
  return match[1];
}

test.describe('abilities & auras section', () => {
  test('lists every team aura for a hero carrying none and for one carrying War Cry, which reads at its rank with no switch', async ({
    page,
  }) => {
    await seedLocalStorage(page, roster);
    await page.goto('/planner');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page);

    const section = auraSection(page);
    await expect(section.getByRole('heading', { name: /^Abilities & auras$/i, level: 2 })).toBeVisible();
    for (const id of TEAM_AURA_IDS.filter((aura) => aura !== 'passagem_bastao')) {
      const row = section.getByTestId(`team-aura-${id}`);
      await expect(row).toBeVisible();
      await expect(row.getByRole('switch')).not.toBeChecked();
      await expect(row.getByTestId('team-aura-priced-at')).toHaveText('—');
    }
    await expect(section.getByTestId('team-aura-grito_guerra').getByTestId('team-aura-delta')).toHaveText(/\+\d+\.\d% if on/);
    await expect(section.getByTestId('own-ability-detonacao_dupla')).toContainText(/×1\.\d\d dmg/);
    // Baton Pass is the sixth aura row. Cora carries it at rank 10, so it is her own — no switch —
    // priced at the team damage her own entry pulse carries, rank 10 × 4%.
    const batonPass = section.getByTestId('team-aura-passagem_bastao');
    await expect(batonPass.getByRole('switch')).toHaveCount(0);
    await expect(batonPass.getByTestId('team-aura-own')).toHaveText(/^own$/i);
    await expect(batonPass.getByTestId('team-aura-priced-at')).toHaveText(/\+40% dmg, pulse held up/);
    await expect(section.getByTestId('own-ability-passagem_bastao')).toHaveCount(0);

    await selectSavedHero(page, 'Lorne');
    const lorneSection = auraSection(page);
    const warCry = lorneSection.getByTestId('team-aura-grito_guerra');
    await expect(warCry.getByRole('switch')).toHaveCount(0);
    await expect(warCry.getByTestId('team-aura-own')).toHaveText(/^own$/i);
    await expect(warCry.getByTestId('team-aura-priced-at')).toHaveText(/\+12% attack/);
    await expect(warCry.getByTestId('team-aura-delta')).toHaveText(/−\d+\.\d% if off/);
    for (const id of TEAM_AURA_IDS.filter((aura) => aura !== 'grito_guerra')) {
      await expect(lorneSection.getByTestId(`team-aura-${id}`).getByRole('switch')).toHaveCount(1);
    }
    // Lorne carries no Baton Pass: its switch prices her own entry pulse at the cap, and the
    // Combat figure moves by what the row promised.
    const lorneBaton = lorneSection.getByTestId('team-aura-passagem_bastao');
    await expect(lorneBaton.getByTestId('team-aura-priced-at')).toHaveText('—');
    const promised = await promisedDeltaPct(lorneBaton);
    expect(promised).toBeGreaterThan(0);
    const before = await combatSustainedDps(page);
    await lorneBaton.getByRole('switch').click();
    await expect(lorneBaton.getByRole('switch')).toBeChecked();
    await expect(lorneBaton.getByTestId('team-aura-priced-at')).toHaveText(/\+80% dmg, pulse held up/);
    await expect.poll(() => combatSustainedDps(page)).toBeGreaterThan(before);
    const after = await combatSustainedDps(page);
    expect(Math.abs((after / before - 1) * 100 - promised)).toBeLessThanOrEqual(moveTolerancePct(before, after));
  });

  test('switching War Cry on moves the strip and the Combat figure by the row’s own promise, and the Farm page not at all', async ({
    page,
  }) => {
    await seedLocalStorage(page, roster);
    await page.goto('/planner');
    await selectSavedHero(page, 'Cora');

    // The Farm page's own hero panel, for the same hero, in the same session — read before and
    // after the switch through the app's own navigation so the store is the one the switch lives in.
    const mainNav = page.getByRole('navigation', { name: 'Main sections' });
    const farmPanel = page.locator('dt', { hasText: /^Sustained DPS$/i }).locator('xpath=following-sibling::dd[1]');
    await mainNav.getByRole('link', { name: /^Farm$/i }).click();
    await expect(page.getByRole('heading', { name: /^Your hero$/i, level: 2 })).toBeVisible();
    const farmBefore = await farmPanel.innerText();
    await mainNav.getByRole('link', { name: /^Planner$/i }).click();
    await openCombatTab(page);

    const stripBefore = await stripSustainedDps(page);
    const combatBefore = await combatSustainedDps(page);
    expect(combatBefore).toBe(Math.round(stripBefore));

    const row = auraSection(page).getByTestId('team-aura-grito_guerra');
    const promised = await promisedDeltaPct(row);
    expect(promised).toBeGreaterThan(0);

    await row.getByRole('switch').click();
    await expect(row.getByRole('switch')).toBeChecked();
    await expect(row.getByTestId('team-aura-priced-at')).toHaveText(/\+20% attack/);
    await expect(row.getByTestId('team-aura-delta')).toHaveText(/−\d+\.\d% if off/);

    await expect
      .poll(() => stripSustainedDps(page))
      .not.toBe(stripBefore);
    const stripAfter = await stripSustainedDps(page);
    const combatAfter = await combatSustainedDps(page);
    expect(combatAfter).toBe(Math.round(stripAfter));

    const moved = (stripAfter / stripBefore - 1) * 100;
    expect(Math.abs(moved - promised)).toBeLessThanOrEqual(moveTolerancePct(stripBefore, stripAfter));

    await mainNav.getByRole('link', { name: /^Farm$/i }).click();
    await expect(page.getByRole('heading', { name: /^Your hero$/i, level: 2 })).toBeVisible();
    await expect(farmPanel).toHaveText(farmBefore);
  });

  test('Miner’s Breath reaches the Points ranking, which reads the same pipeline', async ({ page }) => {
    await seedLocalStorage(page, roster);
    await page.goto('/planner');
    await selectSavedHero(page, 'Cora');

    const before = await energyRankingText(page);
    await openCombatTab(page);
    const row = auraSection(page).getByTestId('team-aura-folego_mineiro');
    await row.getByRole('switch').click();
    await expect(row.getByRole('switch')).toBeChecked();

    await expect.poll(() => energyRankingText(page)).not.toBe(before);
  });

  test('"Back to your current phase" clears the switches, and so does a reload', async ({ page }) => {
    await seedLocalStorage(page, roster);
    await page.goto('/planner');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page);

    const warCry = () => auraSection(page).getByTestId('team-aura-grito_guerra').getByRole('switch');
    await warCry().click();
    await expect(warCry()).toBeChecked();

    // A phase pick is what enables the button; clearing it drops the switches with it.
    const stage = activePanel(page);
    await stage.getByRole('combobox', { name: /which phase these numbers/i }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.type('Hard 1-1');
    await page.getByRole('option', { name: 'Hard 1-1 (#151)' }).click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    const back = stage.getByRole('button', { name: /^Back to your current phase$/i });
    await expect(back).toBeEnabled();
    await back.click();
    await expect(back).toBeDisabled();
    await expect(warCry()).not.toBeChecked();

    await warCry().click();
    await expect(warCry()).toBeChecked();
    await page.reload();
    await openCombatTab(page);
    await expect(warCry()).not.toBeChecked();
  });
});
