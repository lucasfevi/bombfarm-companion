import { test, expect, type Page } from '@playwright/test';
import { AUTOSAVE_MS } from '../src/shared/stores/persistence/debounced-writer';
import type { HeroRecord } from '../src/shared/lib/storage';
import { importedRoster, seedLocalStorage, selectSavedHero } from './fixtures/seed';

/** Mirrors `src/shared/lib/storage.ts`, the same way `fixtures/seed.ts` does — keep in sync. */
const HEROES_KEY = 'bf-hp-heroes-v1';

const SEEDED_IDS = ['seed-cora', 'seed-lorne', 'seed-brenna'];
const EDITED_ID = 'seed-cora';

const explainTrigger = /^(How the math works|Como calculamos tudo)$/;
const levelUp = /^(Level up|Subir nível)$/;

function heroStrip(page: Page) {
  return page.getByRole('region', { name: /herói atual|current hero/i });
}

function levelField(page: Page) {
  return heroStrip(page).locator('[data-num-input]');
}

function rawRoster(page: Page): Promise<string> {
  return page.evaluate((key) => window.localStorage.getItem(key) ?? '[]', HEROES_KEY);
}

async function parsedRoster(page: Page): Promise<HeroRecord[]> {
  return JSON.parse(await rawRoster(page)) as HeroRecord[];
}

/**
 * The stored roster, once two reads more than one debounce window apart agree.
 *
 * Picking a hero is itself a draft change, so a snapshot taken straight after it races the write
 * that change scheduled. Waiting for agreement also fails a roster whose stored bytes keep
 * moving after the edit settled.
 *
 * This watches the bytes, not the array's identity: the reference contract `patchHeroInList`
 * holds is invisible from here, and `storage-patch-hero-in-list.test.ts` is what guards it.
 */
async function settledRoster(page: Page): Promise<HeroRecord[]> {
  let previous: string | null = null;
  await expect
    .poll(
      async () => {
        const current = await rawRoster(page);
        const agreed = current === previous;
        previous = current;
        return agreed;
      },
      {
        intervals: [AUTOSAVE_MS + 200],
        timeout: 15_000,
        message: 'the stored roster never stopped changing',
      },
    )
    .toBe(true);
  return JSON.parse(previous ?? '[]') as HeroRecord[];
}

function levelOf(roster: HeroRecord[], id: string): number | undefined {
  return roster.find((hero) => hero.id === id)?.level;
}

/** Every hero the edit did not touch, keyed by id, so a failure names the one that moved. */
function bystanders(roster: HeroRecord[]): Record<string, string> {
  return Object.fromEntries(
    roster.filter((hero) => hero.id !== EDITED_ID).map((hero) => [hero.id, JSON.stringify(hero)]),
  );
}

async function editLevelAndWaitForTheWrite(page: Page): Promise<void> {
  await heroStrip(page).getByRole('button', { name: levelUp }).click();
  await expect(levelField(page)).toHaveValue('48');
  await expect
    .poll(async () => levelOf(await parsedRoster(page), EDITED_ID), {
      timeout: 10_000,
      message: 'the debounced autosave never wrote the edited level',
    })
    .toBe(48);
}

test.describe('planner draft autosave, on the real clock', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await selectSavedHero(page, 'Cora');
    await expect(levelField(page)).toHaveCount(1);
  });

  test('a level edit reaches storage after the debounce, and a load that reads storage afresh shows it', async ({
    page,
    context,
  }) => {
    const before = await settledRoster(page);
    expect(before.map((hero) => hero.id)).toEqual(SEEDED_IDS);
    expect(levelOf(before, EDITED_ID)).toBe(47);

    await editLevelAndWaitForTheWrite(page);

    /**
     * A second page rather than `page.reload()`: the seed is an init script, so it re-asserts its
     * own roster on every navigation of the page it was added to and would erase the very edit
     * under test. A sibling page in the same context shares this origin's storage and carries no
     * init script, so it boots the planner from exactly what the autosave left behind.
     */
    const reopened = await context.newPage();
    await reopened.goto('/heroes');
    await expect(heroStrip(reopened).getByText('Cora')).toBeVisible();
    await expect(levelField(reopened)).toHaveCount(1);
    await expect(levelField(reopened)).toHaveValue('48');
    await reopened.close();
  });

  test('an open panel is still open once the debounced write lands, and the other heroes keep their stored bytes', async ({
    page,
  }) => {
    const before = await settledRoster(page);
    expect(levelOf(before, EDITED_ID)).toBe(47);

    const explain = page.getByRole('button', { name: explainTrigger });
    await explain.click();
    await expect(explain).toHaveAttribute('aria-expanded', 'true');

    await editLevelAndWaitForTheWrite(page);
    await expect(explain).toHaveAttribute('aria-expanded', 'true');

    const after = await settledRoster(page);
    await expect(explain).toHaveAttribute('aria-expanded', 'true');
    expect(after.map((hero) => hero.id)).toEqual(SEEDED_IDS);
    expect(bystanders(after)).toEqual(bystanders(before));
  });
});
