/**
 * Harness self-check — proves the collector observes real commits, sees unminified
 * names in the chosen captureMode, and that PerformedWork matches DevTools' didFiberRender
 * for counted fiber tags (FunctionComponent / ClassComponent / ForwardRef / Memo / SimpleMemo).
 *
 * Spike (2026-07-29): `next build --profile` still minified ~49% of component keys →
 * captureMode locked to `dev-strict` (`next:dev` webpack). W8 must re-measure in that mode.
 *
 * Run: PERF=1 pnpm exec playwright test --project=perf e2e/perf/self-check.spec.ts
 * Prefer: pnpm perf:capture (Docker).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { importedRoster, seedLocalStorage, selectSavedHero } from '../fixtures/seed'
import {
  installCollector,
  readPerfApi,
  looksUnminified,
  COUNTED_TAGS,
  PERFORMED_WORK,
} from './collect-commits'

const EVIDENCE_PATH = path.join(
  process.cwd(),
  '.specs/features/modular-architecture-w1-guardrails/t2-self-check-evidence.json',
)

/** Locked after prod-profile name spike failed (see evidence.prodProfileSpike). */
/**
 * Mirrors `perf.spec.ts`. Was hardcoded to `dev-strict` while that was the only mode;
 * once `RES-05` added `prod-profile`, a fixed value made the written evidence claim a
 * mode the run did not use.
 */
const CAPTURE_MODE: 'dev-strict' | 'prod-profile' =
  process.env.PERF_PROFILE === '1' ? 'prod-profile' : 'dev-strict'

test.describe.configure({ mode: 'serial' })

test.describe('perf harness self-check', () => {
  test('collector observes commits, unminified names, DevTools predicate agreement', async ({
    page,
  }) => {
    await installCollector(page)
    await seedLocalStorage(page, importedRoster)

    await page.goto('/')

    // Settle: planner region visible (AD-012).
    const heroStrip = page.getByRole('region', { name: /herói atual|current hero/i })
    await expect(heroStrip).toBeVisible({ timeout: 60_000 })
    await selectSavedHero(page, 'Cora')

    // Settle after picker apply (AD-012).
    await page.waitForTimeout(1100)

    const afterBoot = await readPerfApi(page)
    expect(afterBoot.hookInstalled, 'React must inject into our DevTools hook').toBe(true)
    expect(afterBoot.sawCommit, 'onCommitFiberRoot must have fired').toBe(true)
    expect(
      afterBoot.commits.length,
      'zero commits after boot is a harness failure, never a baseline',
    ).toBeGreaterThan(0)

    // Interaction: switch planner tab (reachable, low ambiguity).
    await page.evaluate(() => window.__BFHP_PERF__?.reset())
    const gearTab = page.getByRole('tab', { name: /equipamento|gear/i })
    await expect(gearTab).toBeVisible()
    await gearTab.click()
    await page.waitForTimeout(1500)

    const afterClick = await readPerfApi(page)
    expect(
      afterClick.commits.length,
      'interaction must produce ≥1 commit',
    ).toBeGreaterThan(0)

    const allKeys = afterClick.commits.flatMap((c) => c.rendered.map((r) => r.key))
    expect(allKeys.length, 'interaction must re-execute ≥1 counted fiber').toBeGreaterThan(0)

    const minified = allKeys.filter((k) => !looksUnminified(k))
    const minifiedRatio = minified.length / allKeys.length
    const namesUnminified = minifiedRatio < 0.25

    expect(
      namesUnminified,
      `component names still look minified in ${CAPTURE_MODE} (ratio=${minifiedRatio}). sample=${minified.slice(0, 10).join(',')}`,
    ).toBe(true)

    // DevTools cross-check was computed at commit time (flags clear after commit).
    expect(
      afterClick.lastDevtoolsAgreement,
      `collector vs DevTools mismatch\ncollector=${afterClick.lastCollectorKeys?.join(',')}\ndevtools=${afterClick.lastDevtoolsKeys?.join(',')}`,
    ).toBe(true)

    const crossCheck = {
      ok: true,
      setsEqual: afterClick.lastDevtoolsAgreement === true,
      reason: 'commit-time collector set equals DevTools didFiberRender walk',
      collectorKeys: afterClick.lastCollectorKeys ?? [],
      devtoolsKeys: afterClick.lastDevtoolsKeys ?? [],
    }

    const distinct = [...new Set(allKeys)]
    const readable = distinct.filter(looksUnminified)

    const evidence = {
      capturedAt: new Date().toISOString(),
      fixture: 'importedRoster',
      captureMode: CAPTURE_MODE,
      namesUnminified,
      minifiedRatio,
      minifiedSample: minified.slice(0, 10),
      readableSample: readable.slice(0, 30),
      bootCommitCount: afterBoot.commits.length,
      interactionCommitCount: afterClick.commits.length,
      interactionComponentRenders: allKeys.length,
      prodProfileSpike: {
        candidateMode: 'prod-profile',
        result: 'resolved-2026-07-30',
        w1SpikeMinifiedRatio: 0.487,
        note:
          'W1 spike (2026-07-29) rejected prod-profile: `next build --profile` still mangled ~49% ' +
          'of component keys. RES-05 resolved it — pairing that flag with PERF_PROFILE=1, which ' +
          'disables minification for the measurement build only, retains the names. Both modes ' +
          'are now supported; see .specs/prds/planner-residuals/perf-prod-profile-baseline.md.',
      },
      devtoolsCrossCheck: {
        agreed: crossCheck.setsEqual,
        reason: crossCheck.reason,
        countedTags: COUNTED_TAGS,
        performedWorkFlag: PERFORMED_WORK,
        sampleKeys: crossCheck.collectorKeys.slice(0, 30),
      },
      note: 'captureMode=dev-strict (next:dev webpack). StrictMode double-invoke is a property of this mode; W8 must match.',
    }

    fs.mkdirSync(path.dirname(EVIDENCE_PATH), { recursive: true })
    fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')

    const lockPath = path.join(process.cwd(), 'pnpm-lock.yaml')
    const lockfileSha256 = fs.existsSync(lockPath)
      ? createHash('sha256').update(fs.readFileSync(lockPath)).digest('hex')
      : 'missing'
    fs.writeFileSync(
      path.join(path.dirname(EVIDENCE_PATH), 't2-env-fingerprint.json'),
      `${JSON.stringify(
        {
          lockfileSha256,
          nodeVersion: process.version,
          captureMode: evidence.captureMode,
        },
        null,
        2,
      )}\n`,
    )
  })
})
