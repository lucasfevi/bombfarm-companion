import { test, expect, type Locator, type Page } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import { clickOptimize, gotoTeamPlan, openFieldHelp, waitForOptimizeDone } from './fixtures/team-plan-e2e';

const PHASE_HELP = /^Plan for phase: /i;

/** The DS `SearchSelect` trigger — a Base UI combobox, like `Select`'s. */
function phaseCombobox(page: Page): Locator {
  return page.getByRole('combobox', { name: /^Which phase this search plans for$/i });
}

async function openPhasePicker(page: Page) {
  await phaseCombobox(page).click();
  await expect(page.getByRole('listbox')).toBeVisible();
}

async function search(page: Page, query: string) {
  await openPhasePicker(page);
  await expect(page.getByPlaceholder('Hard, Normal 2-1, or 151')).toBeFocused();
  await page.keyboard.type(query);
}

async function pickPhase(page: Page, query: string, optionName: RegExp) {
  await search(page, query);
  await page.getByRole('option', { name: optionName }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

async function pickObjective(page: Page, optionName: RegExp) {
  await page.getByRole('combobox', { name: /^What this search scores a roster on$/i }).click();
  await page.getByRole('option', { name: optionName }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

test.describe('Team plan phase picker', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
  });

  test('starts on the phase the save says the account is on', async ({ page }) => {
    await expect(phaseCombobox(page)).toBeVisible();
    await expect(phaseCombobox(page)).toHaveText(/^Easy 1-1 \(#1\)$/);
  });

  test('does not render all 600 phases at once, and says how many it is holding back', async ({
    page,
  }) => {
    await openPhasePicker(page);
    const options = page.getByRole('option');
    await expect(options).toHaveCount(50);
    await expect(page.getByText(/Showing 50 of 601 — keep typing to narrow\./)).toBeVisible();
  });

  test('finds a phase by the difficulty word', async ({ page }) => {
    await search(page, 'Normal');
    await expect(page.getByRole('option', { name: 'Normal 2-1 (#71)' })).toBeVisible();
    await expect(page.getByRole('option', { name: /^Easy/ })).toHaveCount(0);
  });

  test('finds a phase by the full coordinate', async ({ page }) => {
    await search(page, 'Normal 3-4');
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option', { name: 'Normal 3-4 (#94)' })).toBeVisible();
  });

  test('finds a phase by the bare number', async ({ page }) => {
    await search(page, '151');
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option', { name: 'Hard 1-1 (#151)' })).toBeVisible();
  });

  test('None is a real option, not the absence of one', async ({ page }) => {
    await pickPhase(page, 'None', /^None$/);
    await expect(phaseCombobox(page)).toHaveText(/^None$/);
    await expect(await openFieldHelp(page, PHASE_HELP)).toContainText(/No phase pinned\./);
  });

  /**
   * An unpinned phase means two different things. Gold sweeps for one and reports which it chose;
   * damage does not sweep at all and scores at the account's own phase. One hint for both told
   * damage users the search would go and find them a phase, which it never does.
   */
  test('unpinned says what each objective actually does with it', async ({ page }) => {
    await pickPhase(page, 'None', /^None$/);
    await expect(await openFieldHelp(page, PHASE_HELP)).toContainText(
      /No phase pinned\. The search picks the best phase/,
    );

    await pickObjective(page, /^DPS$/i);
    const help = await openFieldHelp(page, PHASE_HELP);
    await expect(help).toContainText(/No phase pinned\. Damage is scored at the phase your account is on now\./);
    await expect(help).not.toContainText(/The search picks the best phase/);
  });

  test('a chosen phase past the account’s furthest says so', async ({ page }) => {
    await pickPhase(page, '151', /^Hard 1-1 \(#151\)$/);
    await expect(page.getByText(/Past the furthest phase your account has reached/)).toBeVisible();
  });

  test('a gold plan reports the phase it was scored at, and that the player picked it', async ({
    page,
  }) => {
    await pickPhase(page, 'Normal 1-1', /^Normal 1-1 \(#51\)$/);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    const phaseCard = page.getByTestId('team-plan-phase-card');
    await expect(phaseCard).toContainText('Normal 1-1 (#51)');
    await expect(phaseCard).toContainText('The phase you picked.');
  });

  test('with None, a gold plan reports the phase it settled on as automatic', async ({ page }) => {
    await pickPhase(page, 'None', /^None$/);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByTestId('team-plan-phase-card')).toContainText(
      'Picked automatically — the best this squad can hold.',
    );
  });

  test('a damage plan on None stays on the account’s own phase and says nothing automatic', async ({
    page,
  }) => {
    await page.getByRole('combobox', { name: /^What this search scores a roster on$/i }).click();
    await page.getByRole('option', { name: /^DPS$/i }).click();
    await pickPhase(page, 'None', /^None$/);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    const phaseCard = page.getByTestId('team-plan-phase-card');
    await expect(phaseCard).toContainText('Where your account is now.');
    await expect(phaseCard).not.toContainText('The phase you picked.');
    await expect(phaseCard).not.toContainText('Picked automatically');
  });
});

/**
 * The setup fields used to carry hints of different lengths under their controls, and the row they
 * sat in bottom-aligned its children — which stepped the controls down a staircase, measured
 * 202 / 220 / 230 px. The hints are behind a `?` now, but the row still top-aligns (a phase past
 * the account's furthest adds a warning line under one field), so the controls are still measured.
 */
const SETUP_FIELDS = /Score for|Plan for phase|What to change|Min forge/i;

function setupFieldBoxes(page: Page) {
  return page.evaluate(
    (pattern) =>
      [...document.querySelectorAll('[data-setup-field]')]
        .filter((field) => new RegExp(pattern, 'i').test(field.textContent ?? ''))
        .map((field) => {
          const control = field
            .querySelector('[data-setup-control]')
            ?.querySelector('select, input, [role="combobox"], button');
          const rect = control?.getBoundingClientRect();
          return {
            label: (field.querySelector('span')?.textContent ?? '').trim(),
            top: Math.round(rect?.top ?? -1),
            height: Math.round(rect?.height ?? -1),
          };
        }),
    SETUP_FIELDS.source,
  );
}

test.describe('the setup fields sit on one line', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
  });

  test('every setup field shares a control baseline', async ({ page }) => {
    const boxes = await setupFieldBoxes(page);
    const tops = boxes.map((box) => box.top);

    expect(boxes).toHaveLength(4);
    expect(tops[0]).toBeGreaterThan(0);
    expect(new Set(tops).size, `controls stepped down: ${tops.join(' / ')}`).toBe(1);
  });

  /**
   * The forge stepper's buttons are the only setup control that is not a bordered field, and they
   * inherit their type from the uppercase field label rather than the row — so left alone they
   * render ten pixels short of their neighbours. Height is the measurable half of that.
   */
  test('the forge stepper is as tall as the fields beside it', async ({ page }) => {
    const heights = (await setupFieldBoxes(page)).map((box) => box.height);
    expect(new Set(heights).size, `control heights differ: ${heights.join(' / ')}`).toBe(1);
  });

  /**
   * The button used to sit on the row's bottom edge, which is wherever the LONGEST hint happens to
   * end — 33.75px below the row's centre, and moving with the copy. It now centres against the
   * whole panel (title and fields), which its parent row spans.
   */
  test('Build team plan is centred against the panel, not stuck to the row’s bottom edge', async ({
    page,
  }) => {
    const offset = await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((candidate) =>
        /Build team plan/i.test(candidate.textContent ?? ''),
      );
      const row = button?.parentElement;
      const title = [...document.querySelectorAll('h2')].find((h) => /Search setup/i.test(h.textContent ?? ''));
      if (!button || !row || !title || !row.contains(title)) return null;
      const buttonRect = button.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      return (
        buttonRect.top + buttonRect.height / 2 - (rowRect.top + rowRect.height / 2)
      );
    });

    expect(offset).not.toBeNull();
    expect(Math.abs(offset ?? Infinity)).toBeLessThanOrEqual(0.5);
  });
});
