/**
 * Two things a new workspace package owes the root test run, both of which fail silently.
 *
 * 1. **A worker cap.** `vitest.workers.ts` bounds ONE run at 3 workers, and `cpu-budget.mjs`
 *    divides one machine-wide budget among the runs actually executing. Neither reaches a
 *    project config that never asks: Vitest's own default is roughly one worker per core, so
 *    `pnpm --filter @bombfarm/<pkg> test` on an uncapped project takes ~23 forks on a 24-thread
 *    machine, outside the budget entirely. Several agent sessions each doing that is exactly the
 *    load the budget exists to prevent. Root-level `maxWorkers` covers the root run only — it
 *    does not reach a standalone filtered run, which is why every project sets it too.
 *
 *    This is not hypothetical drift: `packages/domain` and `apps/web` carried the rule in a
 *    comment ("Set here as well as at the root so `pnpm --filter` is capped too") while ten
 *    sibling projects went without it. A comment in two files is not a rule; this is.
 *
 * 2. **Registration in the root `projects` array.** A package with tests and a `vitest.config.ts`
 *    that the root config never lists is simply not run by `pnpm test`, which stays green while
 *    the package's suite never executes.
 *
 * Deliberately dumb text slicing over the config sources, not a TypeScript parse — the
 * `tools/design-system-gate.test.mjs` / `tools/playwright-spec-enumeration.test.mjs` convention.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ROOT_CONFIG_PATH = join(root, 'vitest.config.ts');

/** Directories that hold workspace packages, plus `tools`, which is a vitest project in its own right. */
const PACKAGE_PARENTS = ['packages', 'apps'];

function discoverProjectConfigs() {
  const found = [];
  for (const parent of PACKAGE_PARENTS) {
    for (const name of readdirSync(join(root, parent))) {
      const relative = `${parent}/${name}/vitest.config.ts`;
      if (existsSync(join(root, relative))) found.push(relative);
    }
  }
  if (existsSync(join(root, 'tools/vitest.config.ts'))) found.push('tools/vitest.config.ts');
  return found.sort();
}

/** `tools` sits one level below the root; everything else sits two. */
function expectedWorkersImport(relativeConfigPath) {
  const depth = relativeConfigPath.split('/').length - 1;
  return `${'../'.repeat(depth)}vitest.workers`;
}

function readRootProjects() {
  const text = readFileSync(ROOT_CONFIG_PATH, 'utf8');
  const match = text.match(/projects:\s*\[([^\]]*)\]/);
  if (!match) throw new Error('could not find a projects: [...] array in vitest.config.ts');
  return match[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.replace(/^['"]|['"]$/g, ''));
}

const projectConfigs = discoverProjectConfigs();

describe('every vitest project caps its workers', () => {
  it.each(projectConfigs)('%s sets maxWorkers: MAX_TEST_WORKERS', (relativeConfigPath) => {
    const text = readFileSync(join(root, relativeConfigPath), 'utf8');
    const importPath = expectedWorkersImport(relativeConfigPath);

    expect(
      text,
      `${relativeConfigPath} does not import MAX_TEST_WORKERS from '${importPath}'. Without it ` +
        `\`pnpm --filter\` on this package runs one worker per core, outside the machine-wide ` +
        `CPU budget — see docs/machine-load.md.`,
    ).toContain(`import { MAX_TEST_WORKERS } from '${importPath}'`);

    expect(
      text,
      `${relativeConfigPath} imports MAX_TEST_WORKERS but never sets \`maxWorkers\`. The root ` +
        `config's cap covers the root run only; a standalone filtered run reads this file.`,
    ).toMatch(/maxWorkers:\s*MAX_TEST_WORKERS/);
  });
});

describe('the root projects array matches the vitest.config.ts files on disk', () => {
  it('same members, either direction — a suite the root run never lists never executes', () => {
    const registered = readRootProjects().sort();

    const registeredButMissing = registered.filter((entry) => !projectConfigs.includes(entry));
    const onDiskButUnregistered = projectConfigs.filter((entry) => !registered.includes(entry));

    expect(
      registeredButMissing,
      `vitest.config.ts lists a project config that does not exist on disk: ` +
        `${registeredButMissing.join(', ')}`,
    ).toEqual([]);
    expect(
      onDiskButUnregistered,
      `these packages have a vitest.config.ts the root run does not list, so \`pnpm test\` never ` +
        `executes them: ${onDiskButUnregistered.join(', ')}. Add each to the projects array in ` +
        `vitest.config.ts.`,
    ).toEqual([]);
  });
});
