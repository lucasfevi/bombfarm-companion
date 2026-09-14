import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { teamPlanObjectivePairsEn } from './objective-en';

/**
 * `teamPlanObjectiveCopy` (`model/objective-copy.ts`) is the only reader of the `…Dps`/`…Farm`
 * suffixed keys — every component reads its neutrally-named bundle instead. That is what makes
 * the host-neutral vocabulary check about the whole package rather than about one function: a
 * component that reached past the resolver could render `teamPlanResultsHeaderDps` under a gold
 * plan and no assertion elsewhere would notice.
 */
const PACKAGE_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `.ts`/`.tsx` file under the package's own source, tests excluded. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')
      ? [full]
      : [];
  });
}

const ALLOWED_FILES = [
  join('copy', 'objective-en.ts'),
  join('copy', 'objective-pt-BR.ts'),
  join('model', 'objective-copy.ts'),
];

describe('no source file outside the namespace and the resolver reads a suffixed key', () => {
  const suffixed = Object.keys(teamPlanObjectivePairsEn).filter((key) => /(Dps|Farm)$/.test(key));

  it('there are at least 14 suffixed keys, so this check is not vacuous', () => {
    expect(suffixed.length).toBeGreaterThanOrEqual(14);
  });

  it('no offending file reads a suffixed key', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(PACKAGE_SRC)) {
      if (ALLOWED_FILES.some((suffix) => file.endsWith(suffix))) continue;
      const text = readFileSync(file, 'utf8');
      for (const key of suffixed) {
        if (text.includes(key)) offenders.push(`${file}: ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('red state: the scan above does catch a suffixed key in a pretend component', () => {
    const pretendComponent = 'return <p>{t.teamPlanResultsHeaderFarm}</p>;';
    expect(suffixed.some((key) => pretendComponent.includes(key))).toBe(true);
  });
});
