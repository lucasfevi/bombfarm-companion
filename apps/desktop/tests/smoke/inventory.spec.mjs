import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

/**
 * The Inventory screen, end to end in the real app.
 *
 * Everything below is asserted against a running Electron window rather than a component test,
 * because the screen's whole job is composition: the domain groups and stacks, `@bombfarm/game-art`
 * draws the card, and this shell supplies the words and the roster. Each layer has unit tests; only
 * a launched app proves they were wired to each other.
 *
 * Uses the offline fixture (221 items, 13 heroes) rather than `account-full.json`, because it is
 * the only committed fixture carrying every item kind — the classifier's six `category` codes are
 * all represented, and a screen that only ever saw gear would not have exercised the interesting
 * half.
 *
 * `BFC_FIXTURE_ACCOUNT_FILE` must be an OS-native absolute path (`path.join` gives one on every
 * platform). A POSIX-style path on Windows reaches `readFileSync` unchanged and throws inside the
 * reader tick, which reports `stale` and commits no account at all — the app then opens empty with
 * nothing on screen saying why.
 */
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function launchApp(env) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      ELECTRON_ENABLE_LOGGING: '1',
      // Same reasoning as the sibling specs: never let a real BombFarm process on the runner
      // machine make "game running" true, and never let a real session.cfg turn a test run into a
      // live authenticated request as a side effect.
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

async function goToInventory(page) {
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Inventory' }).click();
  await page.waitForSelector('[data-testid="inventory-view"]', { timeout: 20_000 });
}

/** Every card in the screen's grids, across all groups. */
function cards(page) {
  return page.getByTestId('inventory-card');
}

/**
 * Read text from cards through `textContent`, never `innerText`.
 *
 * The card sets `content-visibility: auto`, so the browser skips rendering the ones nobody has
 * scrolled to. `innerText` is defined in terms of RENDERED text and comes back empty for those —
 * silently, so an assertion over it passes on whatever happens to be near the top and ignores the
 * rest. `textContent` reads the DOM and is unaffected. (Geometry is fine either way: asking for a
 * rect forces the skipped subtree to lay out.)
 */
function textOf(locator) {
  return locator.evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
}

/**
 * The toolbar's dropdowns are the design system's `Select`, which is Base UI rather than a native
 * `<select>` — its popup is a real listbox so it can be themed. `selectOption()` does not drive
 * it; a user clicks the trigger and then the option, and so does this (the same idiom
 * `i18n.spec.mjs` uses for the settings language control).
 */
async function chooseOption(page, selectLabel, optionName) {
  await page.getByRole('combobox', { name: selectLabel }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

/** Option labels the popup offers, without leaving it open. */
async function optionLabels(page, selectLabel) {
  const trigger = page.getByRole('combobox', { name: selectLabel });
  await trigger.click();
  const labels = await page.getByRole('option').allInnerTexts();
  await page.keyboard.press('Escape');
  return labels;
}

async function withInventory(run) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-inventory-'));
  try {
    const { app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_OFFLINE_FIXTURE,
      BFC_USER_DATA_DIR: userDataDir,
    });
    try {
      await goToInventory(page);
      await run(page);
      await app.close();
    } finally {
      await app.close().catch(() => undefined);
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

test.describe('inventory smoke', () => {
  test('groups the fixture by kind and stacks everything but gear', async () => {
    await withInventory(async (page) => {
      const view = page.getByTestId('inventory-view');

      // The fixture carries all six wire `category` codes, so every kind heading must appear.
      // A regression in the classifier shows up here as a missing heading, or as items piling
      // into "Other" — which is exactly what happened before `category` was read as total.
      for (const heading of ['Gear', 'Gems', 'Keys', 'House parts', 'Skill stones', 'Chests']) {
        await expect(view.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      }

      // Stacking: fewer cards than rows, because only gear is one-card-per-row.
      const cardCount = await cards(page).count();
      expect(cardCount).toBeGreaterThan(0);
      expect(cardCount).toBeLessThan(221);

      // A stacked card states its count in the footer slot a gear card gives its hero; gear never
      // does, because a forge level makes two swords different objects.
      const counts = view.getByTestId('inventory-card-count');
      expect(await counts.count()).toBeGreaterThan(0);
      await expect(counts.first()).toHaveText(/^\d+$/);

      const gearGroup = page.locator('[data-testid="inventory-group"][data-kind="equipment"]');
      expect(await gearGroup.getByTestId('inventory-card-count').count()).toBe(0);
    });
  });

  /**
   * The bug this guards: the tone keyed off `defResolved`, which only means "the GEAR catalog
   * holds this id" — so every gem, key, house part, skill stone and chest drew the dashed
   * unresolved border despite the app naming all of them. Only a genuinely unknown row should.
   */
  test('gives every kind it can name a solid tier border, and only the unknown one a dashed', async () => {
    await withInventory(async (page) => {
      for (const kind of ['equipment', 'gem', 'key', 'time', 'stone', 'chest']) {
        const card = page
          .locator(`[data-testid="inventory-group"][data-kind="${kind}"]`)
          .getByTestId('inventory-card')
          .first();
        const style = await card.evaluate((element) => getComputedStyle(element).borderStyle);
        expect(style, `${kind} should not draw the unresolved border`).toBe('solid');
      }
    });
  });

  /** A card with no hero would otherwise collapse its footer to one line of text and sit visibly
   *  shorter than the card beside it. */
  test('gives every card the same footer height, with the sell value on the bottom edge', async () => {
    await withInventory(async (page) => {
      const geometry = await page.getByTestId('inventory-card-footer').evaluateAll((footers) =>
        footers.map((footer) => {
          const box = footer.getBoundingClientRect();
          const gold = footer.lastElementChild.getBoundingClientRect();
          return { height: Math.round(box.height), bottomGap: Math.round(box.bottom - gold.bottom) };
        }),
      );

      expect(geometry.length).toBeGreaterThan(1);
      expect(new Set(geometry.map((row) => row.height)).size).toBe(1);
      expect(new Set(geometry.map((row) => row.bottomGap))).toEqual(new Set([0]));
    });
  });

  test('names gear in the shell language and shows its forge-applied stats', async () => {
    await withInventory(async (page) => {
      const gearCard = cards(page).first();

      // English shell: the slot must be the English word, never the catalog's Portuguese token.
      // This is the "Gold · Elmo" regression, asserted on the running app.
      const name = (await gearCard.getByTestId('inventory-card-name').textContent()) ?? '';
      expect(name).toMatch(/ · /);
      expect(name).not.toMatch(/Elmo|Bota|Calça|Luva|Peito|Arma|Anel|Amuleto/);

      // The stat panel: a label and a signed value, the value carrying the forge.
      const statValues = gearCard.getByTestId('inventory-stat-value');
      expect(await statValues.count()).toBeGreaterThan(0);
      await expect(statValues.first()).toHaveText(/^\+[\d.,]+%?$/);
    });
  });

  test('shows the equipping hero and the sell value in the card footer', async () => {
    await withInventory(async (page) => {
      // At least one item in the fixture is worn, and its card names the hero with an avatar.
      const worn = cards(page).filter({ has: page.locator('img[src*="/wiki-assets/hero/"]') });
      expect(await worn.count()).toBeGreaterThan(0);

      const footer = worn.first().getByTestId('inventory-card-footer');
      await expect(footer.locator('img[src*="/wiki-assets/nav/icon_gold.png"]')).toBeVisible();
      await expect(footer).toHaveText(/\d/);
    });
  });

  test('draws the game art for every kind, with no broken images', async () => {
    await withInventory(async (page) => {
      // The rarity slot plate sits under every icon, and each kind resolves its own sprite.
      const view = page.getByTestId('inventory-view');
      await expect(view.locator('img[src*="/wiki-assets/background/slot_background_"]').first()).toBeVisible();

      for (const family of ['/gems/', '/key/', '/houseparts/', '/stones/', '/chests/', '/items/']) {
        await expect(view.locator(`img[src*="${family}"]`).first()).toBeVisible();
      }

      // Every <img> actually decoded — a wrong path renders as a 0x0 box rather than an error.
      const broken = await view.locator('img').evaluateAll((images) =>
        images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src),
      );
      expect(broken).toEqual([]);
    });
  });

  test('search, kind filter and hero filter each narrow the grid', async () => {
    await withInventory(async (page) => {
      const view = page.getByTestId('inventory-view');
      const before = await cards(page).count();

      const search = view.getByRole('searchbox', { name: 'Search your inventory' });
      await search.fill('zzzznomatch');
      await expect(view.getByText('No items match those filters.')).toBeVisible();

      await search.fill('');
      await expect(cards(page)).toHaveCount(before);

      await view.getByRole('button', { name: 'Gems', exact: true }).click();
      await expect(view.getByRole('heading', { name: 'Gear', exact: true })).toBeHidden();
      const gemsOnly = await cards(page).count();
      expect(gemsOnly).toBeGreaterThan(0);
      expect(gemsOnly).toBeLessThan(before);

      await view.getByRole('button', { name: 'Clear' }).click();
      await expect(cards(page)).toHaveCount(before);

      // The hero filter narrows to one hero. Picked by position rather than by label: an option
      // is a rank, a name, stars and a level rendered as markup, so its accessible name is the
      // whole block concatenated and matching on it would be matching on formatting.
      await page.getByRole('combobox', { name: 'Filter by hero' }).click();
      await page.getByRole('option').nth(1).click();

      const wornByHero = await cards(page).count();
      expect(wornByHero).toBeGreaterThan(0);
      expect(wornByHero).toBeLessThan(before);

      // Every surviving card names the SAME hero — which is the actual claim, and one the option
      // label cannot make on its own. Read the name element directly: the footer's text runs
      // together without the line breaks `innerText` used to supply, and `innerText` is unusable
      // on these cards (see `textOf`).
      const heroNames = await textOf(page.getByTestId('inventory-card-hero'));
      expect(heroNames.length).toBe(wornByHero);
      expect(new Set(heroNames.map((name) => name.trim())).size).toBe(1);
    });
  });

  /**
   * Set and level are the same axis — the catalog pairs 30 sets with 30 levels, one each — so the
   * set picker IS the level filter, with labels a player says out loud. It starts with everything
   * ticked, which is the state an empty filter list represents.
   */
  test('filters by set, starting with every set chosen and staying open across picks', async () => {
    await withInventory(async (page) => {
      const view = page.getByTestId('inventory-view');
      const before = await cards(page).count();
      const trigger = view.getByRole('combobox', { name: 'Filter by set' });

      await expect(trigger).toHaveText('All sets');
      await trigger.click();

      // The popup is portalled, so it is not in the DOM the instant the trigger is clicked.
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 10_000 });
      const total = await options.count();
      expect(total).toBeGreaterThan(1);

      // Level-ordered, and each label leads with its level.
      const labels = await options.allInnerTexts();
      expect(labels[0]).toMatch(/^Level \d+ · /);
      const levels = labels.map((text) => Number(/Level (\d+)/.exec(text)?.[1] ?? 0));
      expect([...levels].sort((a, b) => a - b)).toEqual(levels);

      // Every box starts ticked.
      for (let index = 0; index < total; index += 1) {
        await expect(options.nth(index)).toHaveAttribute('data-selected', '');
      }

      // Unticking one leaves the popup open — that is what `multiple` buys.
      await options.first().click();
      await expect(options.first()).not.toHaveAttribute('data-selected', '');
      expect(await options.count()).toBe(total);

      await page.keyboard.press('Escape');
      await expect(trigger).toHaveText(`${total - 1} of ${total} sets`);
      expect(await cards(page).count()).toBeLessThan(before);

      // Naming a set names a gear level, so a narrowed list is gear only.
      const kinds = await page
        .locator('[data-testid="inventory-group"]')
        .evaluateAll((groups) => groups.map((group) => group.dataset.kind));
      expect(kinds).toEqual(['equipment']);
    });
  });

  /**
   * The popup's own chrome: a caption over the list, a count against each set, and an action that
   * takes a narrowed list back to every set.
   *
   * The counts are asserted against the grid rather than against themselves — a row saying "41"
   * has to mean the account holds 41 pieces of that set, and the only proof of that is what
   * survives when the set is unticked.
   */
  test('the set popup heads its list, counts every set, and clears back to all of them', async () => {
    await withInventory(async (page) => {
      const view = page.getByTestId('inventory-view');
      const trigger = view.getByRole('combobox', { name: 'Filter by set' });
      const before = await cards(page).count();

      await trigger.click();
      const options = page.getByRole('option');
      await expect(options.first()).toBeVisible({ timeout: 10_000 });
      const total = await options.count();

      await expect(page.getByTestId('select-popup-header')).toContainText('Sets you own');
      await expect(page.getByTestId('select-popup-clear')).toHaveText('Clear');

      // One count per row, and they share a right edge — the column is what makes them scannable.
      const counts = page.getByTestId('select-item-trailing');
      expect(await counts.count()).toBe(total);
      const numbers = (await counts.allInnerTexts()).map((text) => Number(text.trim()));
      expect(numbers.every((value) => Number.isInteger(value) && value > 0)).toBe(true);

      const rightEdges = await counts.evaluateAll((nodes) =>
        nodes.map((node) => Math.round(node.getBoundingClientRect().right)),
      );
      expect(new Set(rightEdges).size).toBe(1);

      // Unticking the first set leaves exactly the pieces the other rows claim. A narrowed set
      // filter is gear only, so the whole grid is the sum of the surviving counts.
      const survivors = numbers.reduce((sum, value) => sum + value, 0) - numbers[0];
      await options.first().click();
      await expect.poll(() => cards(page).count(), { timeout: 10_000 }).toBe(survivors);

      // Clear returns the filter to every set — which is what an unnarrowed set filter IS, so the
      // boxes tick again rather than emptying.
      await page.getByTestId('select-popup-clear').click();
      for (let index = 0; index < total; index += 1) {
        await expect(options.nth(index)).toHaveAttribute('data-selected', '');
      }

      await page.keyboard.press('Escape');
      await expect(trigger).toHaveText('All sets');
      await expect(cards(page)).toHaveCount(before);
    });
  });

  /**
   * The direction toggle carries the design system tooltip, not the browser's `title`. A native
   * one ignores the theme, waits about a second, and cannot be dismissed — and it is invisible to
   * this assertion, which is the point: `getByRole('tooltip')` only finds a real one.
   */
  test('the sort direction toggle explains itself through the design system tooltip', async () => {
    await withInventory(async (page) => {
      const view = page.getByTestId('inventory-view');
      const toggle = view.getByRole('button', { name: /Ascending|Descending/ });

      // No browser tooltip: a native `title` here would satisfy a human squinting at the UI and
      // still be the wrong control.
      expect(await toggle.getAttribute('title')).toBeNull();
      await expect(toggle).toHaveAttribute('data-base-ui-tooltip-trigger', '');

      // The popup is a plain div carrying the design system's own slot attribute — Base UI puts
      // the ARIA on the trigger (`aria-describedby`), so there is no `role="tooltip"` to find.
      await toggle.hover();
      await expect(page.locator('[data-slot="tooltip-popup"]')).toContainText(
        /Ascending|Descending/,
        { timeout: 10_000 },
      );
    });
  });

  test('sorting reorders within a group, and the direction toggle reverses it', async () => {
    await withInventory(async (page) => {
      const view = page.getByTestId('inventory-view');
      const firstName = async () => cards(page).first().getByTestId('inventory-card-name').textContent();

      await chooseOption(page, 'Sort by', 'Name');
      const before = await firstName();

      await view.getByRole('button', { name: /Ascending|Descending/ }).click();
      await expect.poll(firstName, { timeout: 10_000 }).not.toBe(before);
    });
  });

  /**
   * The headline of the multi-key order: choosing a second key must not throw the first away, it
   * demotes it to a tie-break. Nothing on screen names the tie-break, so this asserts the ORDER
   * it produces — two items of the same rarity, ranked by the demoted key.
   */
  test('a newly chosen sort key becomes primary and the previous one becomes the tie-break', async () => {
    await withInventory(async (page) => {
      const view = page.getByTestId('inventory-view');
      // Gear only: it is the one kind that HAS a level, so it is the one kind whose order can
      // show a level tie-break at all.
      const levels = async () => {
        const texts = await page
          .locator('[data-testid="inventory-group"][data-kind="equipment"]')
          .getByTestId('inventory-card')
          .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ''));
        return texts.map((text) => Number(/Level (\d+)/.exec(text)?.[1] ?? 0));
      };

      // Narrow to one rarity, so every visible card ties on the primary key and the order that
      // remains is the tie-break's alone.
      await view.getByRole('button', { name: 'Rare', exact: true }).click();

      await chooseOption(page, 'Sort by', 'Level');
      await view.getByRole('button', { name: 'Descending' }).click();
      await chooseOption(page, 'Sort by', 'Rarity');

      // Rarity is primary now; level ascending survives underneath it rather than being dropped.
      const ascending = await levels();
      expect(ascending.length).toBeGreaterThan(1);
      expect([...ascending].sort((a, b) => a - b)).toEqual(ascending);
    });
  });
});
