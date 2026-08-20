/**
 * MOD-33 measurement driver — 7 reps per scenario, writes perf-baseline.raw.json.
 *
 * Window: opens at first input; closes 1500 ms after last input.
 * Zero commits ⇒ hard failure (never write a zero baseline).
 *
 * Output path: PERF_OUT env, or --out=path via Playwright grep-less argv parse,
 * default `e2e/perf/out/perf-baseline.raw.json`.
 * Set PERF_FORCE=1 to overwrite an existing file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { test, expect } from '@playwright/test'
import { importedRoster, largeRoster, seedLocalStorage, selectSavedHero } from '../fixtures/seed'
import { installCollector, readPerfApi, type CommitRecord } from './collect-commits'
import {
  aggregateRepetition,
  aggregateScenario,
  sliceWindow,
  type ScenarioMetrics,
} from './aggregate'
import { scenarios, ensurePlannerTab, type Scenario } from './scenarios'

const REPETITIONS = 7
const WINDOW_TAIL_MS = 1500
/**
 * Discard first N measured loops per scenario before the 7 counted reps.
 * Host `dev-strict` spreads showed first-rep (and sometimes second) warm-up
 * outliers under StrictMode; counted reps remain exactly REPETITIONS.
 * Override with PERF_WARMUP_DISCARD (integer ≥ 0).
 */
const WARMUP_DISCARD = Math.max(
  0,
  Number.parseInt(process.env.PERF_WARMUP_DISCARD ?? '2', 10) || 0,
)
/**
 * RES-06 roster-scaling probe. `importedRoster` (3 heroes) is the default and the fixture
 * every existing baseline is expressed against — never change it. `PERF_FIXTURE=large`
 * swaps in a 30-hero roster with the same active hero and account, to test whether render
 * counts scale with roster size or are flat.
 */
const USE_LARGE_ROSTER = process.env.PERF_FIXTURE === 'large'
const FIXTURE_NAME = USE_LARGE_ROSTER ? 'largeRoster' : 'importedRoster'
const FIXTURE = USE_LARGE_ROSTER ? largeRoster : importedRoster
/**
 * RES-05 — `dev-strict` is the W1/W8 baseline instrument: `next dev` + StrictMode, which
 * double-invokes render and is *not* production. `prod-profile` runs against
 * `pnpm perf:build:profile` output — production React with component names retained —
 * and is the instrument any claim about production behavior must use. The two are not
 * comparable to each other; each has its own baseline file.
 */
const CAPTURE_MODE: 'dev-strict' | 'prod-profile' =
  process.env.PERF_PROFILE === '1' ? 'prod-profile' : 'dev-strict'

const DEFAULT_OUT = path.join(process.cwd(), 'e2e/perf/out/perf-baseline.raw.json')

function resolveOutPath(): string {
  if (process.env.PERF_OUT) return path.resolve(process.env.PERF_OUT)
  const arg = process.argv.find((a) => a.startsWith('--out='))
  if (arg) return path.resolve(arg.slice('--out='.length))
  return DEFAULT_OUT
}

function environmentBlock() {
  const lockPath = path.join(process.cwd(), 'pnpm-lock.yaml')
  const lockfileSha256 = fs.existsSync(lockPath)
    ? createHash('sha256').update(fs.readFileSync(lockPath)).digest('hex')
    : 'missing'
  let baseSha = 'unknown'
  try {
    baseSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    /* ignore */
  }
  return {
    baseSha,
    capturedAt: new Date().toISOString(),
    dockerImage: process.env.PERF_DOCKER_IMAGE ?? `host (${CAPTURE_MODE})`,
    nodeVersion: process.version,
    pnpmVersion: process.env.npm_config_user_agent ?? 'unknown',
    lockfileSha256,
    captureMode: CAPTURE_MODE,
    warmupDiscard: WARMUP_DISCARD,
  }
}

async function mark(page: import('@playwright/test').Page, label: string): Promise<number> {
  return page.evaluate((l) => {
    window.__BFHP_PERF__!.mark(l)
    return performance.now()
  }, label)
}

async function harvestCommits(page: import('@playwright/test').Page): Promise<CommitRecord[]> {
  const api = await readPerfApi(page)
  return api.commits
}

/** AD-012-style quiescence: ≥ quietMs with no new commits after reset. */
async function waitForQuiet(
  page: import('@playwright/test').Page,
  quietMs = 1000,
): Promise<void> {
  await page.evaluate(() => window.__BFHP_PERF__!.reset())
  await page.waitForFunction(
    (ms) => {
      const api = window.__BFHP_PERF__
      if (!api) return false
      if (api.commits.length === 0) return true
      const last = api.commits[api.commits.length - 1]
      return performance.now() - last.at > ms
    },
    quietMs,
    { timeout: 60_000 },
  )
  await page.waitForTimeout(quietMs + 100)
}

async function runScenarioReps(
  page: import('@playwright/test').Page,
  scenario: Scenario,
): Promise<ScenarioMetrics> {
  if (scenario.skip) {
    return aggregateScenario([], {
      id: scenario.id,
      label: scenario.label,
      selector: scenario.selectorRecipe,
      skipped: scenario.skip,
    })
  }

  const totalLoops = REPETITIONS + WARMUP_DISCARD
  const reps = []
  for (let i = 0; i < totalLoops; i++) {
    await waitForQuiet(page)
    if (scenario.startTab) await ensurePlannerTab(page, scenario.startTab)
    // Re-quiet after tab switch so navigation commits stay outside the window.
    await waitForQuiet(page)

    const target = await scenario.precondition(page)
    await expect(target, `${scenario.id} precondition failed`).toBeVisible()
    await expect(target).toBeEnabled()

    const startMs = await mark(page, `${scenario.id}-start-${i}`)
    await scenario.run(page, target)
    await page.waitForTimeout(WINDOW_TAIL_MS)
    const endMs = await mark(page, `${scenario.id}-end-${i}`)

    const commits = await harvestCommits(page)
    const windowed = sliceWindow(commits, startMs, endMs)
    if (windowed.length === 0) {
      throw new Error(
        `${scenario.id} loop ${i + 1}/${totalLoops}: zero commits in measurement window — harness failure`,
      )
    }
    if (i >= WARMUP_DISCARD) {
      reps.push(aggregateRepetition(windowed))
    }
  }

  return aggregateScenario(reps, {
    id: scenario.id,
    label: scenario.label,
    selector: scenario.selectorRecipe,
  })
}

test.describe.configure({ mode: 'serial' })

test.describe('perf measurement driver', () => {
  test('capture all MOD-33 scenarios ×7', async ({ page }) => {
    test.setTimeout(900_000)
    const outPath = resolveOutPath()
    if (fs.existsSync(outPath) && process.env.PERF_FORCE !== '1') {
      throw new Error(
        `Refusing to overwrite ${outPath} without PERF_FORCE=1 (spec: idempotent overwrite guard)`,
      )
    }

    await installCollector(page)
    await seedLocalStorage(page, FIXTURE)
    await page.goto('/')
    await expect(page.getByRole('region', { name: /herói atual|current hero/i })).toBeVisible({
      timeout: 60_000,
    })
    await selectSavedHero(page, 'Cora')
    await page.waitForTimeout(1100)

    const results: ScenarioMetrics[] = []
    for (const scenario of scenarios) {
      // eslint-disable-next-line no-console
      console.log(`[perf] measuring ${scenario.id} ${scenario.label}`)
      const metrics = await runScenarioReps(page, scenario)
      results.push(metrics)
      // eslint-disable-next-line no-console
      console.log(
        `[perf] ${scenario.id}: medianRenders=${metrics.medianComponentRenders} deterministic=${metrics.deterministic}${metrics.skipped ? ` skipped=${metrics.skipped.reason}` : ''}`,
      )
    }

    // Non-skipped scenarios must have non-zero median renders.
    for (const m of results) {
      if (m.skipped) continue
      expect(m.medianComponentRenders, `${m.id} median componentRenders`).toBeGreaterThan(0)
    }

    const payload = {
      environment: environmentBlock(),
      fixture: FIXTURE_NAME,
      captureMode: CAPTURE_MODE,
      repetitions: REPETITIONS,
      warmupDiscard: WARMUP_DISCARD,
      windowTailMs: WINDOW_TAIL_MS,
      scenarios: results,
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    // eslint-disable-next-line no-console
    console.log(`[perf] wrote ${outPath}`)
  })
})
