/**
 * (design.md §3, §10 hazard 6, tasks.md T5) — the main-loop half: the
 * strongest available structural form of "the recompute does not block the Electron main event
 * loop long enough to delay IPC" is that main never calls the functions that would block it at
 * all. `pipelineForHero`, `computeAdvisorPipeline` and `parseAccountPayload` appearing zero times
 * under `apps/desktop/src/main/**` is what the renderer-recomputes, main-detects-changes placement decision is asserted by.
 *
 * A separate file from `advice-change-key-coverage.test.mjs` (T5's "pick one and state why"):
 * that file guards a renderer-side value (tier-1 key exhaustiveness); this one guards a main-side
 * structural absence. Different subject, different failure attribution, and merging them would
 * blur which one a reader should look at first when either goes red.
 *
 * Deliberately dumb text slicing, not a TypeScript parse — the same convention
 * `tools/design-system-gate.test.mjs` and `tools/ci-desktop-paths.test.mjs` use.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MAIN_DIR = join(root, 'apps/desktop/src/main');

const FORBIDDEN_IDENTIFIERS = ['pipelineForHero', 'computeAdvisorPipeline', 'parseAccountPayload'];

/** Same two exclusions `apps/desktop/src/main/planning-guards.test.ts` (F2's own guard suite,
 *  same directory) already established for this exact identifier-scan genre: test files
 *  legitimately NAME these identifiers to assert their own absence (this guard's sibling,
 *  `planning-guards.test.ts`'s "computeAdvisorPipeline is never imported" test, does exactly
 *  that), and doc comments legitimately explain *why* a function is never called here. Both are
 *  text about the rule, not a violation of it. */
function isTestFile(path) {
  return /\.(test|spec)\.(ts|tsx|mjs)$/.test(path);
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** Every non-test `.ts` file under `apps/desktop/src/main`, recursively. */
function listProductionTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listProductionTsFiles(full));
    } else if (entry.endsWith('.ts') && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

describe('main computes nothing — pipelineForHero/computeAdvisorPipeline/parseAccountPayload appear zero times under apps/desktop/src/main', () => {
  const files = listProductionTsFiles(MAIN_DIR);

  it('the scan actually covers a real, non-trivial file set (sanity — otherwise this test proves nothing)', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('zero occurrences of any forbidden identifier under apps/desktop/src/main (production source, comments stripped)', () => {
    const offenders = [];
    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const identifier of FORBIDDEN_IDENTIFIERS) {
        if (source.includes(identifier)) {
          offenders.push(`${file.replace(root, '').replace(/\\/g, '/')} contains "${identifier}"`);
        }
      }
    }
    expect(
      offenders,
      `${offenders.join('; ')} — main is provably NOT supposed to compute advice: the ` +
        'renderer recomputes, memoised; main only resolves the current account view and decides ' +
        'whether it changed. A call to any of these three functions from apps/desktop/src/main would ' +
        'put pure-compute work back on the Electron main event loop, which is exactly what this guard ' +
        'forbids (blocking the loop long enough to delay IPC).',
    ).toEqual([]);
  });

  it('demonstrates the red state: a synthetic file containing pipelineForHero is caught by the same scan (observed here, not committed as a permanent mutation)', () => {
    const mutantSource = "import { pipelineForHero } from '@bombfarm/domain/roster-dps';\n";
    const offenders = FORBIDDEN_IDENTIFIERS.filter((identifier) => mutantSource.includes(identifier));
    expect(offenders).toEqual(['pipelineForHero']);
    expect(offenders).not.toEqual([]);
  });
});
