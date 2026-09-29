import { test, expect, type Locator, type Page } from '@playwright/test';
import { AUTOSAVE_MS } from '../src/shared/stores/persistence/debounced-writer';
import { importedRoster, rosterBoard, seedLocalStorage, type SeededState } from './fixtures/seed';

/**
 * Deleting a hero, end to end: the confirmation, what each of its two answers does to the roster
 * the reader can see, and what is left once the last hero goes.
 *
 * The 700ms draft autosave is what makes this a browser question rather than a store one — the
 * roster write and the draft write race, and only a running app has both.
 */
const AUTOSAVE_SETTLE_MS = AUTOSAVE_MS + 500;

function heroStrip(page: Page): Locator {
  return page.getByRole('region', { name: /herói atual|current hero/i });
}

function emptyWorkspace(page: Page): Locator {
  return page.getByRole('region', { name: /nenhum herói adicionado|no heroes added yet/i });
}

/** The rail beside the planner — the roster a reader actually sees, in its own drawn order. */
function rosterRailIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-testid^="heroes-roster-row-"]')
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).dataset.testid?.replace('heroes-roster-row-', '') ?? ''),
    );
}

async function openPlanner(page: Page, state: SeededState): Promise<void> {
  await seedLocalStorage(page, state);
  await page.goto('/heroes');
  await expect(heroStrip(page)).toBeVisible();
}

async function openDeleteConfirm(page: Page, heroName: string): Promise<Locator> {
  await heroStrip(page).getByRole('button', { name: /excluir herói|delete hero/i }).click();
  const dialog = page.getByRole('dialog', { name: /excluir herói|delete hero/i });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(new RegExp(heroName));
  return dialog;
}

function confirmButton(dialog: Locator): Locator {
  return dialog.getByRole('button', { name: /^excluir$|^delete$/i });
}

function cancelButton(dialog: Locator): Locator {
  return dialog.getByRole('button', { name: /^(cancelar|cancel)$/i });
}

/**
 * A second page in the same context, which shares the origin's storage and carries none of the
 * seed helper's init script.
 *
 * `page.reload()` cannot answer whether a delete persisted: the seed re-writes the heroes key on
 * every navigation, so a reload restores the seeded roster whatever storage holds. A fresh page
 * boots from what the app actually wrote.
 */
async function bootFromStoredState(page: Page, assert: (fresh: Page) => Promise<void>): Promise<void> {
  const fresh = await page.context().newPage();
  try {
    await fresh.goto('/heroes');
    await assert(fresh);
  } finally {
    await fresh.close();
  }
}

const BOARD_IDS = ['board-ayla', 'board-doran', 'board-shelved', 'board-nessa'];
const BOARD_IDS_WITHOUT_DORAN = ['board-ayla', 'board-shelved', 'board-nessa'];

const soleHero: SeededState = {
  ...importedRoster,
  heroes: [importedRoster.heroes[0]!],
  activeHeroId: 'seed-cora',
};

test.describe('Deleting a hero', () => {
  test('the confirmation names the hero it would delete', async ({ page }) => {
    await openPlanner(page, rosterBoard);

    const dialog = await openDeleteConfirm(page, 'Doran');
    await expect(dialog).toContainText(/não pode ser desfeito|cannot be undone/i);
    await expect(confirmButton(dialog)).toBeVisible();
    await expect(cancelButton(dialog)).toBeVisible();
    await expect(cancelButton(dialog), 'only one control answers to the cancel name').toHaveCount(1);
  });

  test('cancelling leaves the hero in the roster and in the strip', async ({ page }) => {
    await openPlanner(page, rosterBoard);

    const dialog = await openDeleteConfirm(page, 'Doran');
    await cancelButton(dialog).click();
    await expect(dialog).toBeHidden();

    expect(await rosterRailIds(page)).toEqual(BOARD_IDS);

    // A cancel that merely deferred the delete onto the autosave would still look right here, so
    // the roster has to survive the window rather than only outlive the dialog.
    await page.waitForTimeout(AUTOSAVE_SETTLE_MS);
    expect(await rosterRailIds(page)).toEqual(BOARD_IDS);
    await expect(heroStrip(page).getByText('Doran')).toBeVisible();
  });

  test('confirming removes the hero and hands the strip the first one still in the roster', async ({ page }) => {
    await openPlanner(page, rosterBoard);

    const dialog = await openDeleteConfirm(page, 'Doran');
    await confirmButton(dialog).click();
    await expect(dialog).toBeHidden();

    await expect.poll(() => rosterRailIds(page)).toEqual(BOARD_IDS_WITHOUT_DORAN);
    await expect(heroStrip(page).getByText('Ayla')).toBeVisible();
    await expect(heroStrip(page).getByText('Doran')).toHaveCount(0);
  });

  test('a deleted hero is still gone when the app boots again from stored state', async ({ page }) => {
    await openPlanner(page, rosterBoard);

    const dialog = await openDeleteConfirm(page, 'Doran');
    await confirmButton(dialog).click();
    await expect.poll(() => rosterRailIds(page)).toEqual(BOARD_IDS_WITHOUT_DORAN);

    await bootFromStoredState(page, async (fresh) => {
      await expect(heroStrip(fresh)).toBeVisible();
      expect(await rosterRailIds(fresh)).toEqual(BOARD_IDS_WITHOUT_DORAN);
    });
  });

  test('deleting the last hero shows the import invitation and drops the strip', async ({ page }) => {
    await openPlanner(page, soleHero);

    const dialog = await openDeleteConfirm(page, 'Cora');
    await confirmButton(dialog).click();

    await expect(emptyWorkspace(page)).toBeVisible();
    await expect(
      emptyWorkspace(page).getByRole('button', { name: /importar seu save|import your save/i }),
    ).toBeVisible();
    await expect(heroStrip(page)).toHaveCount(0);
    expect(await rosterRailIds(page)).toEqual([]);
  });

  test('an emptied roster stays empty — the reset draft is never autosaved as a new hero', async ({ page }) => {
    await openPlanner(page, soleHero);

    const dialog = await openDeleteConfirm(page, 'Cora');
    await confirmButton(dialog).click();
    await expect(emptyWorkspace(page)).toBeVisible();

    // Deleting the last hero resets the draft, which is exactly the change that arms the draft
    // autosave; the window has to elapse before a fresh boot can say it wrote nothing.
    await page.waitForTimeout(AUTOSAVE_SETTLE_MS);

    await bootFromStoredState(page, async (fresh) => {
      await expect(emptyWorkspace(fresh)).toBeVisible();
      expect(await rosterRailIds(fresh)).toEqual([]);
    });
  });
});
