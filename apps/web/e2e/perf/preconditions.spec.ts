/**
 * Preconditions spec — boots the seeded app and asserts each MOD-33 affordance
 * is visible and enabled before the measurement harness relies on it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { importedRoster, seedLocalStorage, selectSavedHero } from '../fixtures/seed'
import { installCollector, readPerfApi } from './collect-commits'
import { scenarios, ensurePlannerTab } from './scenarios'

const SELECTOR_EVIDENCE = path.join(
  process.cwd(),
  '.specs/features/modular-architecture-w1-guardrails/t4-selector-evidence.json',
)

test.describe.configure({ mode: 'serial' })

async function bootSettled(page: import('@playwright/test').Page) {
  await installCollector(page)
  await seedLocalStorage(page, importedRoster)
  await page.goto('/')
  const heroStrip = page.getByRole('region', { name: /herói atual|current hero/i })
  await expect(heroStrip).toBeVisible({ timeout: 60_000 })
  // Force applyHero via the picker — StrictMode + collector can race the boot microtask.
  await selectSavedHero(page, 'Cora')
  // AD-012: planner visible AND 1000 ms with no new commit.
  await page.evaluate(() => window.__BFHP_PERF__?.reset())
  await page.waitForFunction(() => {
    const api = window.__BFHP_PERF__
    if (!api) return false
    if (api.commits.length === 0) return performance.now() > 0 // allow empty after reset
    const last = api.commits[api.commits.length - 1]
    return performance.now() - last.at > 1000
  }, undefined, { timeout: 60_000 })
  // Give settle window even if no commits arrive post-reset.
  await page.waitForTimeout(1100)
  const api = await readPerfApi(page)
  expect(api.hookInstalled).toBe(true)
}

test.describe('perf scenario preconditions', () => {
  const recorded: Record<string, { selectorRecipe: string; skipped?: string; ok?: boolean }> = {}

  test.afterAll(() => {
    fs.mkdirSync(path.dirname(SELECTOR_EVIDENCE), { recursive: true })
    fs.writeFileSync(SELECTOR_EVIDENCE, `${JSON.stringify(recorded, null, 2)}\n`, 'utf8')
  })

  for (const scenario of scenarios) {
    test(`${scenario.id}: ${scenario.label}`, async ({ page }) => {
      if (scenario.skip) {
        recorded[scenario.id] = {
          selectorRecipe: scenario.selectorRecipe,
          skipped: scenario.skip.reason,
        }
        test.info().annotations.push({ type: 'skip-reason', description: scenario.skip.reason })
        return
      }

      await bootSettled(page)
      if (scenario.startTab) await ensurePlannerTab(page, scenario.startTab)

      let target
      try {
        target = await scenario.precondition(page)
      } catch (err) {
        throw new Error(
          `${scenario.id} precondition failed for selector recipe: ${scenario.selectorRecipe}\n${String(err)}`,
        )
      }

      await expect(target, `${scenario.id} affordance not visible: ${scenario.selectorRecipe}`).toBeVisible()
      await expect(target).toBeEnabled()

      recorded[scenario.id] = {
        selectorRecipe: scenario.selectorRecipe,
        ok: true,
      }
      console.log(`[perf] ${scenario.id} selector: ${scenario.selectorRecipe}`)
    })
  }
})
