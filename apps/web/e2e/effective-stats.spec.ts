import { test, expect, type Locator, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero } from './fixtures/seed';

async function openPointsTab(page: Page, lang: 'en' | 'pt') {
  const name = lang === 'en' ? /^points$/i : /^pontos$/i;
  await page.getByRole('tab', { name }).click();
}

/** The Effective panel lives on Combat, beside the figures it explains — Points keeps the rest. */
async function openCombatTab(page: Page, lang: 'en' | 'pt') {
  const name = lang === 'en' ? /^combat$/i : /^combate$/i;
  await page.getByRole('tab', { name }).click();
}

function activePanel(page: Page) {
  return page.locator('[data-slot="tabs-panel"][data-state="active"]');
}

function pointsStage(page: Page, lang: 'en' | 'pt') {
  const title = lang === 'en' ? /^Points$/i : /^Pontos$/i;
  return activePanel(page).filter({
    has: page.getByRole('heading', { name: title, level: 2 }),
  });
}

function effectivePanel(page: Page) {
  return activePanel(page).getByTestId('combat-breakdown');
}

function card(page: Page, id: string): Locator {
  return effectivePanel(page).locator(`[data-breakdown-card="${id}"]`);
}

function cardValue(page: Page, id: string): Locator {
  return card(page, id).getByTestId('breakdown-value');
}

/** The face of a card — the hover and focus target that opens its popover. */
function cardFace(page: Page, id: string): Locator {
  return card(page, id).locator('[data-slot="tooltip-trigger"]').first();
}

/** Every figure the pipeline draws: the seven sheet stats, six factors, five per-hit and cadence
 *  figures, two DPS figures. */
const CARD_IDS = [
  'attack',
  'energy',
  'speed',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
  'dmg',
  'mitF',
  'critFactor',
  'fuse',
  'fieldSeconds',
  'rest',
  'hit',
  'criticalHit',
  'avgHit',
  'bombsPerSecond',
  'uptime',
  'activeDps',
  'sustainedDps',
] as const;

const EN_CARD_LABELS: Record<(typeof CARD_IDS)[number], string> = {
  attack: 'Attack',
  energy: 'Energy',
  speed: 'Speed',
  critChance: 'Crit Chance',
  critDmg: 'Crit Damage',
  penetration: 'Penetration',
  cdr: 'Cooldown Red.',
  dmg: 'Damage multiplier',
  mitF: 'Mitigation factor',
  critFactor: 'Critical factor',
  fuse: 'Fuse',
  fieldSeconds: 'Field time',
  rest: 'Rest',
  hit: 'Hit',
  criticalHit: 'Critical Hit',
  avgHit: 'Average hit',
  bombsPerSecond: 'Bombs / s',
  uptime: 'Uptime',
  activeDps: 'Active DPS',
  sustainedDps: 'Sustained DPS',
};

/**
 * Cora with an own drain reduction, so the Field time card is reached by an own ability as well
 * as by the team's Fôlego.
 */
function withExtraBattery(base: typeof importedRoster) {
  return {
    ...base,
    heroes: base.heroes.map((h) =>
      h.id === 'seed-cora' ? { ...h, abilities: { ...h.abilities, bateria_extra: 5 } } : h,
    ),
  };
}

async function expectAllCardsVisible(page: Page) {
  for (const id of CARD_IDS) {
    await expect(cardValue(page, id), id).toBeVisible();
    await expect(cardValue(page, id), id).not.toHaveText('');
  }
}

test.describe('combat breakdown panel', () => {
  test('Points stacks Points / Next point / Stats; Effective sits last but for the aura section on Combat (EN + PT)', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const stage = pointsStage(page, 'en');
    const headings = stage.getByRole('heading', { level: 2 });
    await expect(headings).toHaveCount(3);
    await expect(headings.nth(0)).toHaveText(/^Points$/);
    await expect(headings.nth(1)).toHaveText(/^Next point$/);
    await expect(headings.nth(2)).toHaveText(/^Stats$/);

    await openCombatTab(page, 'en');
    const combatHeadings = activePanel(page).getByRole('heading', { level: 2 });
    await expect(combatHeadings.nth(-2)).toHaveText(/^Effective stats$/);
    await expect(combatHeadings.last()).toHaveText(/^Abilities & auras$/);

    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'PT' }).click();
    await openPointsTab(page, 'pt');
    const stagePt = pointsStage(page, 'pt');
    const headingsPt = stagePt.getByRole('heading', { level: 2 });
    await expect(headingsPt).toHaveCount(3);
    await expect(headingsPt.nth(0)).toHaveText(/^Pontos$/);
    await expect(headingsPt.nth(1)).toHaveText(/^Próximo ponto$/);
    await expect(headingsPt.nth(2)).toHaveText(/^Atributos$/);

    await openCombatTab(page, 'pt');
    const combatHeadingsPt = activePanel(page).getByRole('heading', { level: 2 });
    await expect(combatHeadingsPt.nth(-2)).toHaveText(/^Atributos efetivos$/);
    await expect(combatHeadingsPt.last()).toHaveText(/^Habilidades e auras$/);
  });

  test('wide: all twenty figures are visible without a click, labelled, in four rows, and no accordion remains', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    await expectAllCardsVisible(page);
    for (const id of CARD_IDS) {
      await expect(card(page, id), id).toContainText(EN_CARD_LABELS[id]);
    }
    await expect(effectivePanel(page).locator('[data-breakdown-row]')).toHaveCount(4);
    await expect(activePanel(page).locator('[data-slot^="accordion"]')).toHaveCount(0);
    await expect(activePanel(page).getByRole('button', { name: /Show breakdown of/i })).toHaveCount(0);
    // The wires are drawn on the wide layout, and Speed's card feeds Bombs/s.
    const wires = effectivePanel(page).getByTestId('breakdown-wires');
    await expect(wires).toBeVisible();
    await expect(wires.locator('[data-edge-from="speed"][data-edge-to="bombsPerSecond"]')).toHaveCount(1);
  });

  test('narrow (380px): the same twenty figures stack one per row, still without a click', async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 900 });
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    await expectAllCardsVisible(page);
    await expect(effectivePanel(page).locator('[data-breakdown-row]')).toHaveCount(4);
    // Every card takes the panel's width: no two share a row.
    const boxes = await Promise.all(CARD_IDS.map((id) => card(page, id).boundingBox()));
    const tops = boxes.map((box) => box!.y);
    expect(new Set(tops).size).toBe(CARD_IDS.length);
    await expect(effectivePanel(page).getByTestId('breakdown-wires')).toBeHidden();
    // The panel fits the viewport; its matrix scrolls inside its own box rather than pushing it.
    const panelBox = await effectivePanel(page).boundingBox();
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(clientWidth);
  });

  test('hovering Hit lights the wires from Attack, Mitigation factor and Damage multiplier', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    const wires = effectivePanel(page).getByTestId('breakdown-wires');
    await expect(wires.locator('[data-lit="true"]')).toHaveCount(0);
    await cardFace(page, 'hit').hover();
    const lit = wires.locator('[data-lit="true"]');
    await expect(lit).toHaveCount(3);
    for (const from of ['attack', 'mitF', 'dmg']) {
      await expect(wires.locator(`[data-edge-from="${from}"][data-edge-to="hit"][data-lit="true"]`)).toHaveCount(1);
    }
    await expect(card(page, 'attack')).toHaveAttribute('data-lit', 'true');
    await expect(card(page, 'speed')).not.toHaveAttribute('data-lit', 'true');
    // The popover opens on the same hover, with every term of the substituted formula named.
    const popover = page.getByTestId('breakdown-popover-hit');
    await expect(popover).toBeVisible();
    await expect(popover.getByTestId('breakdown-formula')).toContainText(/attack/i);
    await expect(popover.getByTestId('breakdown-formula')).toContainText(/mitigation factor/i);
    await expect(popover.getByTestId('breakdown-formula')).toContainText(/damage multiplier/i);
  });

  test('the Field time popover names Energy, Extra Battery and Miner\'s Breath, on hover and on keyboard focus', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...withExtraBattery(importedRoster), lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    await cardFace(page, 'fieldSeconds').hover();
    const popover = page.getByTestId('breakdown-popover-fieldSeconds');
    await expect(popover).toBeVisible();
    const reads = popover.getByTestId('breakdown-reads');
    await expect(reads).toContainText('Energy');
    await expect(reads).toContainText('Extra Battery');
    await expect(reads).toContainText("Miner's Breath");
    await expect(popover.getByTestId('breakdown-formula')).toContainText(/energy/i);
    await expect(popover.getByTestId('breakdown-formula')).toContainText(/drain/i);

    await page.mouse.move(0, 0);
    await expect(popover).toBeHidden();
    // Keyboard focus: Fuse's card has no badge icons, so Tab from its face lands on Field time's.
    await cardFace(page, 'fuse').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('breakdown-popover-fieldSeconds')).toBeVisible();
  });

  test('narrow: the same Field time popover opens from the stacked card', async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 900 });
    await seedLocalStorage(page, { ...withExtraBattery(importedRoster), lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    // Keyboard focus: Fuse's card has no badge icons, so Tab from its face lands on Field time's.
    await cardFace(page, 'fuse').focus();
    await page.keyboard.press('Tab');
    const popover = page.getByTestId('breakdown-popover-fieldSeconds');
    await expect(popover).toBeVisible();
    await expect(popover.getByTestId('breakdown-reads')).toContainText("Miner's Breath");
  });

  test('a sheet card\'s popover is its ledger grouped by game line (EN + PT)', async ({ page }) => {
    // Crit Chance exercises all four lines at once: a sheet ability (Olho Clínico), gear, a tree
    // bonus, and the hero line.
    const naked = { attack: 200, energy: 300, speed: 50, critChance: 10, critDmg: 70, penetration: 5, cdr: 5, luck: 0 };
    const zero = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };
    function seeded(lang: 'en' | 'pt') {
      return {
        ...importedRoster,
        lang,
        heroes: importedRoster.heroes.map((h) =>
          h.id === 'seed-cora'
            ? { ...h, naked, gearedOverride: { ...naked, critChance: 15 }, abilities: { olho_clinico: 10, pressagio_mortal: 5 }, pts: zero }
            : h,
        ),
        account: { ...importedRoster.account!, tree: { ...importedRoster.account!.tree!, critChance: 6 } },
      };
    }

    await seedLocalStorage(page, seeded('en'));
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');
    await cardFace(page, 'critChance').hover();
    const ledger = page.getByTestId('breakdown-popover-critChance').getByTestId('breakdown-ledger');
    await expect(ledger.locator('[data-ledger-group="hero"]').first()).toContainText(/^Hero/);
    await expect(ledger.locator('[data-ledger-group="ability"]')).toContainText(/^Ability/);
    await expect(ledger.locator('[data-ledger-group="gear"]')).toContainText(/^Gear/);
    await expect(ledger.locator('[data-ledger-group="skillTree"]')).toContainText(/^Skill tree/);

    await seedLocalStorage(page, seeded('pt'));
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'pt');
    await cardFace(page, 'critChance').hover();
    const ledgerPt = page.getByTestId('breakdown-popover-critChance').getByTestId('breakdown-ledger');
    await expect(ledgerPt.locator('[data-ledger-group="hero"]').first()).toContainText(/^Herói/);
    await expect(ledgerPt.locator('[data-ledger-group="ability"]')).toContainText(/^Habilidade/);
    await expect(ledgerPt.locator('[data-ledger-group="gear"]')).toContainText(/^Itens/);
    await expect(ledgerPt.locator('[data-ledger-group="skillTree"]')).toContainText(/^Árvore/);
  });

  test('the matrix lists all seven sheet stats for a hero whose auras move none of them, with "off" where a switch is off', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    const matrix = effectivePanel(page).getByTestId('breakdown-matrix');
    await expect(matrix.locator('tbody tr')).toHaveCount(7);
    for (const label of ['Attack', 'Energy', 'Speed', 'Crit Chance', 'Crit Damage', 'Penetration', 'Cooldown Red.']) {
      await expect(matrix.getByRole('rowheader', { name: label })).toBeVisible();
    }
    await expect(matrix.getByRole('columnheader', { name: /^Aura ×$/ })).toBeVisible();
    // Cora carries no War Cry: the aura cell on Attack says the switch is off, Energy has none.
    await expect(matrix.locator('[data-matrix-row="attack"] [data-cell="off"]')).toHaveCount(1);
    await expect(matrix.locator('[data-matrix-row="energy"] [data-cell="off"]')).toHaveCount(0);
    await expect(matrix.getByRole('columnheader', { name: /Rune/ })).toHaveCount(0);
  });

  test('the seeded hero crits: the matrix prints her crit chance and crit damage in sheet units, and the Critical factor card is their product', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    const matrix = effectivePanel(page).getByTestId('breakdown-matrix');
    await expect(matrix.locator('[data-matrix-row="critChance"] [data-testid="breakdown-effective"]')).toHaveText('12.70%');
    await expect(matrix.locator('[data-matrix-row="critDmg"] [data-testid="breakdown-effective"]')).toHaveText('62.36%');
    await expect(matrix.locator('[data-matrix-row="cdr"] [data-testid="breakdown-effective"]')).toHaveText('3.14%');
    // 1 + 0.127 × 0.6236 = 1.0792
    await expect(cardValue(page, 'critFactor')).toHaveText('×1.079');
    await expect(cardValue(page, 'criticalHit')).not.toHaveText(await cardValue(page, 'hit').innerText());
  });

  test('a team aura reaches the panel only through its Combat tab switch: the Attack card lights the icon and the matrix prices it', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    const attackBefore = await cardValue(page, 'attack').innerText();
    await expect(card(page, 'attack').locator('[data-badge="grito_guerra"]')).toHaveAttribute('data-on', 'false');

    const auras = activePanel(page).getByTestId('abilities-auras');
    await auras.getByTestId('team-aura-grito_guerra').getByRole('switch').click();

    await expect(card(page, 'attack').locator('[data-badge="grito_guerra"]')).toHaveAttribute('data-on', 'true');
    await expect(cardValue(page, 'attack')).not.toHaveText(attackBefore);
    const matrix = effectivePanel(page).getByTestId('breakdown-matrix');
    await expect(matrix.locator('[data-matrix-row="attack"] [data-cell="off"]')).toHaveCount(0);
    await expect(matrix.locator('[data-matrix-row="attack"]')).toContainText('× 1.200');
  });

  test('the Mitigation factor card carries the penetration reading, and the hero panel no longer prints it', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');

    await expect(card(page, 'mitF').getByTestId('breakdown-penetration')).toHaveText(/nothing lost to mitigation|of each hit lost to mitigation/);
    const stage = activePanel(page);
    await expect(stage.getByText(/^Penetration vs phase$/i)).toHaveCount(0);
    await expect(stage.getByRole('columnheader', { name: /^Hits$/i })).toHaveCount(0);
  });

  test('Hit updates when points change', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await openCombatTab(page, 'en');
    const hitBefore = await cardValue(page, 'hit').innerText();

    await openPointsTab(page, 'en');
    const stage = pointsStage(page, 'en');
    const attackStepper = stage.locator('tr').filter({ hasText: /^Attack/ });
    await attackStepper.getByRole('button', { name: /\+/ }).click();

    await openCombatTab(page, 'en');
    await expect(cardValue(page, 'hit')).not.toHaveText(hitBefore);
  });

  test('Points tab soft-badges when setup incomplete; Effective stays neutral', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');

    const pointsTab = page.getByRole('tab', { name: /^points$/i });
    await expect(pointsTab.locator('[data-tab-badge="soft"]')).toBeVisible();
    await expect(pointsTab.getByText(/^setup$/i)).toHaveCount(0);

    await openCombatTab(page, 'en');
    const effective = effectivePanel(page);
    await expect(effective).not.toHaveClass(/shadow-\[inset_3px_0_0_var\(--accent\)\]/);
    await expect(effective).not.toHaveClass(/opacity-\[0\.78\]/);
  });
});
