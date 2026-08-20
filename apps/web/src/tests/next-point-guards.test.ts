import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

/**
 * The next-point ranking's own import-boundary guard — mirroring
 * `farm-ranking-guards.test.ts`'s guards (f)/(g) in a NEW file (item B owns that file; this
 * item's own boundary gets its own guard rather than an edit to a file it doesn't own). Each
 * check is exercised against a deliberately-bad in-memory fixture string first (red state
 * demonstrated) before being run against the real tree.
 */

function walkFiles(dir: string, predicate: (name: string) => boolean, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, acc);
    else if (predicate(entry.name)) acc.push(full);
  }
  return acc;
}

describe('guard — @bombfarm/domain/farm-point-rank: one RUNTIME importer', () => {
  const srcRoot = path.join(WEB_PACKAGE_ROOT, 'src');
  const allowedRuntimeFile = 'src/shared/stores/selectors/next-point-selectors.ts';

  /** Same classifier shape as farm-ranking-guards.test.ts's guards (f)/(g): a pure
   *  `import type { ... }` erases at compile time and is never the recursion/duplication risk
   *  this guard exists for — only a SECOND file importing a runtime binding is. */
  function importsRuntimeBinding(text: string, specifier: string): boolean {
    const statementRe = new RegExp(`^import\\s+([^;]*?)\\s+from\\s+['"]${specifier}['"]`, 'gm');
    for (const match of text.matchAll(statementRe)) {
      const clause = match[1].trim();
      if (clause.startsWith('type ')) continue;
      const inner = clause.replace(/^\{|\}$/g, '');
      const members = inner.split(',').map((member) => member.trim()).filter(Boolean);
      const hasRuntimeMember = members.some((member) => !member.startsWith('type '));
      if (hasRuntimeMember) return true;
    }
    return false;
  }

  function runtimeImporters(specifier: string): string[] {
    const files = walkFiles(srcRoot, (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
    return files
      .filter((abs) => !abs.includes(`${path.sep}tests${path.sep}`))
      .map((abs) => path.relative(WEB_PACKAGE_ROOT, abs).split(path.sep).join('/'))
      .filter((rel) => importsRuntimeBinding(fs.readFileSync(path.join(WEB_PACKAGE_ROOT, rel), 'utf8'), specifier));
  }

  it('red state: a fabricated second-file runtime import of rankNextPointForFarm is caught', () => {
    expect(
      importsRuntimeBinding(
        "import { rankNextPointForFarm } from '@bombfarm/domain/farm-point-rank';",
        '@bombfarm/domain/farm-point-rank',
      ),
    ).toBe(true);
  });

  it('red state: a fabricated inline mixed import (runtime + type) is still caught as runtime', () => {
    expect(
      importsRuntimeBinding(
        "import { computeHeroFarmBases, type HeroFarmBasis } from '@bombfarm/domain/farm-point-rank';",
        '@bombfarm/domain/farm-point-rank',
      ),
    ).toBe(true);
  });

  it("a pure `import type { FarmPointRankResult }` is correctly classified as non-runtime (does not trip the guard)", () => {
    expect(
      importsRuntimeBinding(
        "import type { FarmPointRankResult } from '@bombfarm/domain/farm-point-rank';",
        '@bombfarm/domain/farm-point-rank',
      ),
    ).toBe(false);
  });

  it('green state: exactly one production file imports a runtime binding from farm-point-rank', () => {
    expect(runtimeImporters('@bombfarm/domain/farm-point-rank')).toEqual([allowedRuntimeFile]);
  });
});
