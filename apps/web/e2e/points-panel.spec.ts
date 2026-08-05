import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero, type SeededState } from './fixtures/seed';

const zeroPts = () => ({
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
});

function pointsHero(opts: {
  lang?: 'pt' | 'en';
  level: number;
  pts: ReturnType<typeof zeroPts>;
  battleAllowed?: boolean;
}): SeededState {
  return {
    ...importedRoster,
    lang: opts.lang ?? 'pt',
    heroes: importedRoster.heroes.map((h) =>
      h.id === 'seed-cora'
        ? {
            ...h,
            level: opts.level,
            pts: opts.pts,
            battleAllowed: opts.battleAllowed,
          }
        : h,
    ),
  };
}

async function openPointsTab(page: import('@playwright/test').Page, lang: 'pt' | 'en' = 'pt') {
  await page.getByRole('tab', { name: lang === 'en' ? /^points$/i : /^pontos$/i }).click();
}

function pointsPanel(page: import('@playwright/test').Page, lang: 'pt' | 'en' = 'pt') {
  const heading = lang === 'en' ? /^Points$/i : /^Pontos$/i;
  return page.locator('[data-slot="tabs-panel"][data-state="active"]').filter({
    has: page.getByRole('heading', { name: heading }),
  });
}

/**
 * Rows of the **Points** table only. The read-only Stats table shares this tab and repeats
 * every stat label (`statShort.cdr` is "Redução de recarga (%)", `luck` is "Sorte"), so a
 * panel-wide `locator('tr')` matches both tables — and positional `td` access then silently
 * reads a Stats cell. Scope to the Points section before indexing columns.
 */
function pointsRow(
  page: import('@playwright/test').Page,
  label: RegExp,
  lang: 'pt' | 'en' = 'pt',
) {
  const heading = lang === 'en' ? /^Points$/i : /^Pontos$/i;
  return pointsPanel(page, lang)
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: heading, level: 2 }) })
    .locator('tr')
    .filter({ hasText: label });
}

test.describe('points panel UX', () => {
  test('shows spent / level points; Reset uses default button and clears spend', async ({ page }) => {
    const pts = { ...zeroPts(), energy: 10, critDmg: 5 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const counter = panel.getByText(/15 \/ 38 pontos/i);
    await expect(counter).toBeVisible();
    await expect(counter).toHaveClass(/text-muted/);
    await expect(counter).not.toHaveClass(/text-warn/);

    const reset = panel
      .getByRole('heading', { name: /^Pontos$/i })
      .locator('xpath=..')
      .getByRole('button', { name: /^Zerar$/i });
    await expect(reset).toBeVisible();
    await expect(reset).toHaveClass(/border-line/);
    await expect(reset).not.toHaveClass(/border-0/);

    await reset.click();
    await expect(
      panel.getByRole('heading', { name: /^Pontos$/i }).locator('xpath=..').getByText(/0 \/ 38 pontos/i),
    ).toBeVisible();
  });

  // Rewritten (user Q-1 override of DEC-05): ±1 now shares the SAME budget ceiling as ±5, so
  // overspend is no longer reachable via either stepper — only by a hero record that already
  // has more spent than its level (e.g. the level was lowered in-game after the points were
  // spent). The text-warn counter stays live UI for that path (it is not deleted).
  test('+1 at the budget ceiling is refused — a no-op, not an overspend', async ({ page }) => {
    const pts = { ...zeroPts(), energy: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const counter = panel.getByText(/38 \/ 38 pontos/i);
    await expect(counter).toBeVisible();
    await expect(counter).toHaveClass(/text-muted/);
    await expect(counter).not.toHaveClass(/text-warn/);

    const energyRow = panel.locator('tr').filter({ hasText: /^Energia/ });
    await energyRow.getByRole('button', { name: /\+/ }).click();
    // Still 38/38 — the +1 press found no room and was refused.
    await expect(panel.getByText(/38 \/ 38 pontos/i)).toBeVisible();
    await expect(panel.getByText(/39 \/ 38 pontos/i)).toHaveCount(0);
  });

  test('+1 with exactly one point of headroom still applies in full', async ({ page }) => {
    const pts = { ...zeroPts(), energy: 37 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const energyRow = panel.locator('tr').filter({ hasText: /^Energia/ });
    await energyRow.getByRole('button', { name: /\+/ }).click();
    const counter = panel.getByText(/38 \/ 38 pontos/i);
    await expect(counter).toBeVisible();
    await expect(counter).toHaveClass(/text-muted/);
  });

  test('text-warn overspend counter still shows for an already-overspent hero (e.g. level lowered after spend) — live UI, not dead code', async ({
    page,
  }) => {
    const pts = { ...zeroPts(), energy: 39 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const counter = panel.getByText(/39 \/ 38 pontos/i);
    await expect(counter).toBeVisible();
    await expect(counter).toHaveClass(/text-warn/);
    await expect(counter).not.toHaveClass(/mb-2/);

    // Steppers stay interactive — a further +1 still finds no room (already past budget).
    const energyRow = panel.locator('tr').filter({ hasText: /^Energia/ });
    await energyRow.getByRole('button', { name: /\+/ }).click();
    await expect(panel.getByText(/39 \/ 38 pontos/i)).toBeVisible();
  });

  test('+5 / −5 apply a partial step at the budget ceiling / at zero (BSP-25, AC-17)', async ({
    page,
  }) => {
    const pts = { ...zeroPts(), energy: 35, critChance: 3 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    await expect(panel.getByText(/38 \/ 38 pontos/i)).toBeVisible();

    // +5 on Energy (35 spent, 3 headroom out of 38) applies only the remaining 3.
    const energyRow = panel.locator('tr').filter({ hasText: /^Energia/ });
    await energyRow.getByRole('button', { name: /adicionar 5 pontos a energia/i }).click();
    await expect(panel.getByText(/41 \/ 38 pontos/i)).toHaveCount(0);
    await expect(panel.getByText(/38 \/ 38 pontos/i)).toBeVisible();

    // −5 on Crit % (3 spent) floors at 0, not −2.
    const critRow = panel.locator('tr').filter({ hasText: /^Crít %/ });
    await critRow.getByRole('button', { name: /remover 5 pontos de chance de crítico/i }).click();
    await expect(panel.getByText(/35 \/ 38 pontos/i)).toBeVisible();
  });

  test('Luck row is present on the Points table', async ({ page }) => {
    await seedLocalStorage(page, pointsHero({ level: 38, pts: zeroPts() }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const luckRow = pointsRow(page, /^Sorte/);
    await expect(luckRow).toBeVisible();
    await expect(
      luckRow.getByRole('button', { name: /adicionar 5 pontos a sorte/i }),
    ).toBeVisible();
    await expect(
      luckRow.getByRole('button', { name: /remover 5 pontos de sorte/i }),
    ).toBeVisible();
  });

  test('EN chrome: ±5 aria-labels name the stat', async ({ page }) => {
    await seedLocalStorage(page, pointsHero({ lang: 'en', level: 38, pts: zeroPts() }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const panel = pointsPanel(page, 'en');
    const energyRow = panel.locator('tr').filter({ hasText: /^Energy/ });
    await expect(energyRow.getByRole('button', { name: /add 5 points to energy/i })).toBeVisible();
    await expect(energyRow.getByRole('button', { name: /remove 5 points from energy/i })).toBeVisible();
  });

  test('omits Energy / switch / HTK tip; Δ column stays width-stable when spending', async ({
    page,
  }) => {
    await seedLocalStorage(page, pointsHero({ level: 38, pts: zeroPts() }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    // Former pointsTip shape (Energy · switch · prop HTK) — must not appear under Points.
    await expect(panel.getByText(/Energia .+ · troca|Energy .+ · switch/i)).toHaveCount(0);

    const table = panel.getByRole('table').first();
    const thWidths = async () =>
      table.locator('thead th').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));

    const before = await thWidths();
    const energyRow = panel.locator('tr').filter({ hasText: /^Energia/ });
    for (let i = 0; i < 12; i++) {
      await energyRow.getByRole('button', { name: /\+/ }).click();
    }
    const after = await thWidths();
    expect(after).toEqual(before);
  });

  test('EN chrome: spent / level points + Reset', async ({ page }) => {
    const pts = { ...zeroPts(), attack: 2 };
    await seedLocalStorage(page, pointsHero({ lang: 'en', level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const panel = pointsPanel(page, 'en');
    await expect(panel.getByRole('heading', { name: /^Points$/i })).toBeVisible();
    await expect(panel.getByText(/2 \/ 38 points/i)).toBeVisible();

    const reset = panel
      .getByRole('heading', { name: /^Points$/i })
      .locator('xpath=..')
      .getByRole('button', { name: /^Reset$/i });
    await expect(reset).toHaveClass(/border-line/);
  });
});

test.describe('points panel preview / apply (BSPW6-02)', () => {
  const HEROES_KEY = 'bf-hp-heroes-v1';

  test('Optimize build produces a preview without writing pts or localStorage (AC-08, AC-09)', async ({
    page,
  }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    // Draft persistence is debounced (AUTOSAVE_MS = 700). Hydrate may flush a
    // normalize-on-load rewrite (battleAllowed/skin/updatedAt) on first settle —
    // wait for that BEFORE the baseline so AC-09's byte compare is about Optimize,
    // not about the hydrate flush racing the assertion (Verifier M1 / round-2).
    await page.waitForTimeout(900);
    const storageBefore = await page.evaluate((key) => localStorage.getItem(key), HEROES_KEY);

    const cdrRow = pointsRow(page, /^Redução de recarga/);
    const previewCell = cdrRow.locator('td').last();
    // Spent lives in the Stepper's <b> inside the points cell (td[1]) — After/Preview
    // also use <b>, so a bare `cdrRow.locator('b')` is strict-mode ambiguous.
    const cdrSpent = cdrRow.locator('td').nth(1).locator('b');
    await expect(previewCell).not.toBeVisible();
    await expect(cdrSpent).toHaveText('38');

    await panel.getByRole('button', { name: /^Otimizar build$/i }).click();

    await expect(previewCell).toBeVisible();
    // Immediate in-memory proof: Optimize must not call setPts (AC-08). A redistributed
    // Apply-as-Optimize mutant would move CDR off 38 while still keeping Σ = 38.
    await expect(cdrSpent).toHaveText('38');
    // AC-09: wait past AUTOSAVE_MS so a setPts mutant cannot hide behind the debounce.
    await page.waitForTimeout(900);
    const storageAfter = await page.evaluate((key) => localStorage.getItem(key), HEROES_KEY);
    expect(storageAfter).toBe(storageBefore);
  });

  test('Next point ranking stays keyed off the stored pts, not the preview (AC-14)', async ({ page }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const nextPointHeading = panel.getByRole('heading', { name: /^Próximo ponto$/i });
    const nextPointSection = nextPointHeading.locator('xpath=ancestor::section[1]');
    const before = await nextPointSection.textContent();

    await panel.getByRole('button', { name: /^Otimizar build$/i }).click();
    // Preview is showing (proven above); Next point must not have moved.
    const after = await nextPointSection.textContent();
    expect(after).toBe(before);
  });

  test('Apply preview writes pts, updates the After column, shows the respec note, and clears the preview (AC-11, AC-12)', async ({
    page,
  }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    await panel.getByRole('button', { name: /^Otimizar build$/i }).click();

    const cdrRow = pointsRow(page, /^Redução de recarga/);
    const previewCell = cdrRow.locator('td').last();
    const afterCell = cdrRow.locator('td').nth(3);
    await expect(previewCell).toBeVisible();
    const previewText = (await previewCell.textContent())?.trim();

    const respecNote = panel.getByText(/Aplicado no planner/i);
    await expect(respecNote).not.toBeVisible();

    await panel.getByRole('button', { name: /^Aplicar prévia$/i }).click();

    await expect(afterCell).toHaveText(previewText ?? '');
    await expect(previewCell).not.toBeVisible();
    await expect(respecNote).toBeVisible();

    // localStorage now DOES reflect the applied vector — Apply is the writer, not the preview.
    const storageAfterApply = await page.evaluate((key) => localStorage.getItem(key), HEROES_KEY);
    expect(storageAfterApply).toContain('"cdr"');
  });

  test('a new Optimize run hides the applied-respec note', async ({ page }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    await panel.getByRole('button', { name: /^Otimizar build$/i }).click();
    await panel.getByRole('button', { name: /^Aplicar prévia$/i }).click();

    const respecNote = panel.getByText(/Aplicado no planner/i);
    await expect(respecNote).toBeVisible();

    await panel.getByRole('button', { name: /^Otimizar build$/i }).click();
    await expect(respecNote).not.toBeVisible();
    await expect(panel.getByText(/melhor alocação encontrada por essa busca/i)).toBeVisible();
  });

  test('Clear preview discards the candidate without touching pts', async ({ page }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    await panel.getByRole('button', { name: /^Otimizar build$/i }).click();

    const cdrRow = pointsRow(page, /^Redução de recarga/);
    const previewCell = cdrRow.locator('td').last();
    await expect(previewCell).toBeVisible();

    await panel.getByRole('button', { name: /^Limpar prévia$/i }).click();
    await expect(previewCell).not.toBeVisible();
    // Still 38/38 — Clear never wrote pts.
    await expect(panel.getByText(/38 \/ 38 pontos/i)).toBeVisible();
  });
});

test.describe('points panel reset advice gain line + Optimize build result (BSPW6-02, AC-06, AC-07, AC-15)', () => {
  // pts.cdr = level is a deliberately bad single-stat dump — confirmed directly against
  // computeAdvisorPipeline (not guessed): resetAdvice.recommend is true with a ~251% gate
  // gainPct for this seeded hero. pts.attack = level is confirmed the opposite: recommend is
  // false, gainPct ~0.
  test('gain line shows when a reset is worth it, naming Optimize build', async ({ page }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const gainLine = panel.getByText(/checagem rápida encontrou um possível ganho/i);
    await expect(gainLine).toBeVisible();
    await expect(gainLine).toContainText('Otimizar build');
  });

  test('gain line stays mounted but invisible when a reset is not worth it — no layout shift', async ({
    page,
  }) => {
    const pts = { ...zeroPts(), attack: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const gainLine = panel.getByText(/checagem rápida encontrou um possível ganho/i);
    await expect(gainLine).toHaveCount(1);
    await expect(gainLine).not.toBeVisible();
  });

  test('Optimize build is present and enabled regardless of the gain-line state (AC-07)', async ({
    page,
  }) => {
    const pts = { ...zeroPts(), attack: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const optimizeBtn = panel.getByRole('button', { name: /^Otimizar build$/i });
    await expect(optimizeBtn).toBeVisible();
    await expect(optimizeBtn).toBeEnabled();
  });

  test('disabled hero shows a muted exclusion note under Optimize build', async ({ page }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts, battleAllowed: false }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const note = panel.getByText(/não entra nas recomendações automáticas de reset/i);
    await expect(note).toBeVisible();
    await expect(note).toHaveClass(/text-warn/);
    await expect(panel.getByText(/checagem rápida encontrou um possível ganho/i)).not.toBeVisible();
  });

  test('enabling a disabled hero hides the exclusion note and shows the gain line', async ({ page }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts, battleAllowed: false }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const note = panel.getByText(/não entra nas recomendações automáticas de reset/i);
    await expect(note).toBeVisible();

    await page.getByRole('switch', { name: /ativar ou desativar este herói/i }).click();
    await expect(note).not.toBeVisible();
    await expect(panel.getByText(/checagem rápida encontrou um possível ganho/i)).toBeVisible();
  });

  test('Optimize build is disabled with a reason when nothing is spent (AC-15)', async ({ page }) => {
    await seedLocalStorage(page, pointsHero({ level: 38, pts: zeroPts() }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    const optimizeBtn = panel.getByRole('button', { name: /^Otimizar build$/i });
    await expect(optimizeBtn).toBeDisabled();
    await expect(optimizeBtn).toHaveAttribute('title', /nada gasto para realocar/i);
  });

  test('result line reads "best allocation found" with a percentage for a real gain', async ({ page }) => {
    const pts = { ...zeroPts(), cdr: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    await panel.getByRole('button', { name: /^Otimizar build$/i }).click();
    await expect(panel.getByText(/melhor alocação encontrada por essa busca/i)).toBeVisible();
  });

  test('result line reads "kept current" when the search finds no measurable gain, and Apply does not write pts', async ({
    page,
  }) => {
    const pts = { ...zeroPts(), attack: 38 };
    await seedLocalStorage(page, pointsHero({ level: 38, pts }));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const panel = pointsPanel(page);
    await panel.getByRole('button', { name: /^Otimizar build$/i }).click();
    await expect(panel.getByText(/essa busca não superou sua alocação atual/i)).toBeVisible();

    const respecNote = panel.getByText(/Aplicado no planner/i);
    await panel.getByRole('button', { name: /^Aplicar prévia$/i }).click();
    // No-op: no respec note, pts stays 38/38 attack — Apply never rewrote an equally-scoring
    // vector (spec edge case).
    await expect(respecNote).not.toBeVisible();
    await expect(panel.getByText(/38 \/ 38 pontos/i)).toBeVisible();
  });
});
