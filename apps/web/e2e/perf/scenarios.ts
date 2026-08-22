/**
 * MOD-33 scenario catalogue — declarative records for the perf harness.
 * Concrete selectors are discovered at run time and recorded for perf-baseline.md.
 */
import type { Locator, Page } from '@playwright/test'
import type { PlannerTabId } from '../../src/features/planner/model/planner-tab'

export type ScenarioId = 'P-01' | 'P-02' | 'P-03' | 'P-04' | 'P-05'

export type Scenario = {
  id: ScenarioId
  label: string
  /** Planner tab to land on before precondition / measurement. */
  startTab?: PlannerTabId
  /** Assert affordance is present; returns the target locator (and records its selector). */
  precondition: (page: Page) => Promise<Locator>
  /** Drive the interaction (measurement window already open). */
  run: (page: Page, target: Locator) => Promise<void>
  /** Undo accumulated state after a loop, outside the measurement window. */
  reset?: (page: Page) => Promise<void>
  skip?: { reason: string }
  /** Human-readable selector recipe recorded in the baseline. */
  selectorRecipe: string
}

const TAB_NAME: Record<PlannerTabId, RegExp> = {
  hero: /habilidades|abilities/i,
  gear: /equipamento|gear/i,
  account: /conta|account/i,
  points: /pontos|points/i,
}

/** Ensure the named planner tab is active (AD-019 — pin start tab explicitly). */
export async function ensurePlannerTab(page: Page, tab: PlannerTabId): Promise<void> {
  const loc = page.getByRole('tab', { name: TAB_NAME[tab] })
  await loc.waitFor({ state: 'visible' })
  const selected = await loc.getAttribute('aria-selected')
  if (selected === 'true' || (await loc.getAttribute('data-state')) === 'active') return
  await loc.click()
}

/**
 * P-01 default (Q-1 locked): unreachable — setHeroName has no UI call site;
 * no hero-name text input under src/components (import-only roster).
 */
export const scenarios: Scenario[] = [
  {
    id: 'P-01',
    label: 'Type in hero name',
    selectorRecipe: 'N/A — no hero-name text input',
    skip: {
      reason:
        'N/A — unreachable: setHeroName is only called programmatically (apply/new-hero); ' +
        'no hero-name text input in src/components/** (import-only roster). ' +
        'Fan-out proxy: MOD-18 unit assertion (heroName write → zero computeAdvisorPipeline).',
    },
    precondition: async () => {
      throw new Error('P-01 is skipped')
    },
    run: async () => {
      throw new Error('P-01 is skipped')
    },
  },
  {
    id: 'P-02',
    label: 'Type in attack points',
    startTab: 'points',
    // Geared Num on Stats was removed (read-only birth→Total sheet). Points ±1 is the
    // remaining keyed attack-edit surface on the planner.
    selectorRecipe:
      'Points tab → row Ataque/Attack → + stepper',
    precondition: async (page) => {
      await ensurePlannerTab(page, 'points')
      const points = page.locator('section').filter({
        has: page.getByRole('heading', { name: /^pontos$|^points$/i, level: 2 }),
      })
      const row = points.getByRole('row').filter({
        has: page.getByRole('cell', { name: /^ataque$|^attack$/i }),
      })
      return row.getByRole('button', { name: /^\+$|^adicionar 1|^add 1/i }).or(row.getByRole('button', { name: /\+/ })).first()
    },
    run: async (_page, target) => {
      for (let i = 0; i < 8; i++) {
        await target.click()
      }
    },
    // The level-47 stat budget the fixture ships is finite; 8 clicks × 9 loops would exhaust
    // it partway through a capture. Undo via the panel-level reset, not per-click decrements,
    // so it costs one commit instead of 8 — the driver runs this after the measurement window
    // closes, so it never contributes to componentRenders.
    reset: async (page) => {
      const points = page.locator('section').filter({
        has: page.getByRole('heading', { name: /^pontos$|^points$/i, level: 2 }),
      })
      await points.getByRole('button', { name: /^zerar$|^reset$/i }).click()
    },
  },
  {
    id: 'P-03',
    label: 'Change a gear slot',
    startTab: 'gear',
    selectorRecipe: 'Gear tab → first slot Item-level <select aria-label="Nível do item|Item level">',
    precondition: async (page) => {
      await ensurePlannerTab(page, 'gear')
      const select = page.getByLabel(/nível do item|item level/i).first()
      return select
    },
    run: async (page, target) => {
      const label = await target.innerText()
      // Flip between level 10 and 20. Since #106 the level label also carries the set the level
      // implies — "Nível 10 - Brasa" / "Level 20 - Gold" — so both the digit probe below and the
      // option name below it are deliberately loose about what follows the number.
      const goTo20 = /(?:^|\D)10(?:\D|$)/.test(label)
      await target.click()
      // Digit-bounded on both sides — "20" must not also match "200" (a real option on this
      // gear, since #106 folded the set name into the label).
      const opt = page.getByRole('option', {
        name: goTo20 ? /(?:nível|level) 20(?!\d)/i : /(?:nível|level) 10(?!\d)/i,
      })
      await opt.click()
    },
  },
  {
    id: 'P-04',
    label: 'Sort the roster',
    startTab: 'hero',
    selectorRecipe:
      'Hero strip → Trocar herói/Switch hero → columnheader Nome/Name (RosterSortHeader)',
    precondition: async (page) => {
      await ensurePlannerTab(page, 'hero')
      const strip = page.getByRole('region', { name: /herói atual|current hero/i })
      await strip.getByRole('button', { name: /trocar herói|switch hero/i }).click()
      const dialog = page.getByRole('dialog', { name: /trocar herói|switch hero/i })
      await dialog.waitFor({ state: 'visible' })
      return dialog.getByRole('columnheader', { name: /nome|name/i })
    },
    run: async (page, target) => {
      await target.click()
      // Close picker so the next rep can reach the planner chrome.
      await page.keyboard.press('Escape')
      await page.getByRole('dialog', { name: /trocar herói|switch hero/i }).waitFor({
        state: 'hidden',
      })
    },
  },
  {
    id: 'P-05',
    label: 'Switch planner tab',
    startTab: 'points',
    selectorRecipe: 'Planner tablist → tab Equipamento/Gear (from Points start)',
    precondition: async (page) => {
      await ensurePlannerTab(page, 'points')
      return page.getByRole('tab', { name: /equipamento|gear/i })
    },
    run: async (_page, target) => {
      await target.click()
    },
  },
]

export function activeScenarios(): Scenario[] {
  return scenarios.filter((s) => !s.skip)
}
