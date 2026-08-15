/**
 * Structural, hygiene and literal guards for the farm-objective optimizer: the import
 * allowlist, purity scan, forbidden-literal scan and public-repo hygiene scan described in
 * design.md §9/§12, plus the respec-cost helper's own pinned values.
 *
 * Every source read routes through `requireFixture` so a renamed-away file fails loudly under
 * `CI=1` instead of silently reporting green.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RESPEC_COST_GOLD_PER_LEVEL, respecCostGold } from '@bombfarm/domain/respec-cost';
import { requireFixture } from './helpers/require-fixture';

const here = dirname(fileURLToPath(import.meta.url));
const DOMAIN_ROOT = join(here, '..');
const SRC_ROOT = join(DOMAIN_ROOT, 'src');

const FARM_OPTIMIZE_SOURCES = ['farm-optimize.ts', 'farm-optimize-objective.ts', 'farm-optimize-search.ts'];
const FOUR_NEW_SOURCES = [...FARM_OPTIMIZE_SOURCES, 'respec-cost.ts'];

function readSource(filename: string): string | null {
  const path = join(SRC_ROOT, filename);
  if (!requireFixture(path, `${filename} guard scan`)) return null;
  return readFileSync(path, 'utf8');
}

function listFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

describe('respecCostGold', () => {
  it('is level × RESPEC_COST_GOLD_PER_LEVEL, with no clamp, round or floor', () => {
    expect(RESPEC_COST_GOLD_PER_LEVEL).toBe(1000);
    expect(respecCostGold(0)).toBe(0);
    expect(respecCostGold(42)).toBe(42_000);
    // No clamp — deliberately pinned: a negative level is not normalized here.
    expect(respecCostGold(-3)).toBe(-3000);
    // No round — deliberately pinned: a fractional level is not normalized here.
    expect(respecCostGold(1.5)).toBe(1500);
  });
});

describe('import allowlist — the three farm-optimize*.ts sources never import the pipeline directly', () => {
  const FORBIDDEN_IMPORT = /from\s+['"]\.\/(advisor-pipeline|derive|roster-dps|points-rank|advisor-tables)['"]/;

  for (const filename of FARM_OPTIMIZE_SOURCES) {
    it(`${filename} does not import advisor-pipeline, derive, roster-dps, points-rank or advisor-tables`, () => {
      const source = readSource(filename);
      if (source === null) return;
      expect(source).not.toMatch(FORBIDDEN_IMPORT);
    });
  }

  it('the basis seam is the only reachable path to the pipeline — farm-rate.ts is imported by every solver source', () => {
    for (const filename of FARM_OPTIMIZE_SOURCES) {
      const source = readSource(filename);
      if (source === null) continue;
      expect(source, filename).toMatch(/from\s+['"]\.\/farm-rate['"]/);
    }
  });

  it('DEMONSTRATED RED STATE: an import of ./advisor-pipeline is caught by the allowlist scan', () => {
    const source = readSource('farm-optimize.ts');
    if (source === null) return;
    const mutated = `import { computeAdvisorPipeline } from './advisor-pipeline';\n${source}`;
    expect(mutated).toMatch(FORBIDDEN_IMPORT);
  });
});

describe('purity scan — no store, framework, clock or RNG coupling in the four new sources', () => {
  const PURITY_PATTERNS: readonly [string, RegExp][] = [
    ['zustand', /zustand/],
    ['react', /from\s+['"]react/i],
    ['localStorage', /localStorage/],
    ['electron-log', /electron-log/],
    ['Date.now', /Date\.now\(/],
    ['new Date', /new\s+Date\(/],
    ['Math.random', /Math\.random\(/],
    ['an apps/ path', /apps\//],
  ];

  for (const filename of FOUR_NEW_SOURCES) {
    it(`${filename} has none of: ${PURITY_PATTERNS.map(([label]) => label).join(', ')}`, () => {
      const source = readSource(filename);
      if (source === null) return;
      for (const [label, pattern] of PURITY_PATTERNS) {
        expect(source, `${filename}: ${label}`).not.toMatch(pattern);
      }
    });
  }
});

describe('purity scan — no module-level mutable state in the four new sources', () => {
  for (const filename of FOUR_NEW_SOURCES) {
    it(`${filename} declares no top-level "let"`, () => {
      const source = readSource(filename);
      if (source === null) return;
      const offenders = source.split(/\r?\n/).filter((line) => /^(export\s+)?let\s/.test(line));
      expect(offenders, filename).toEqual([]);
    });
  }

  it('DEMONSTRATED RED STATE: a top-level "let" is caught by the scan', () => {
    const mutated = "let moduleLevelCounter = 0;\nexport function f() { return moduleLevelCounter; }\n";
    const offenders = mutated.split(/\r?\n/).filter((line) => /^(export\s+)?let\s/.test(line));
    expect(offenders.length).toBeGreaterThan(0);
  });
});

describe('forbidden-literal scan — the estimator\'s magic numbers never appear as bare literals in the three farm-optimize*.ts sources', () => {
  const MAGIC_NUMBERS: readonly [string, RegExp][] = [
    ['1000 (respec cost — must come from RESPEC_COST_GOLD_PER_LEVEL)', /\b1000\b/],
    ['0.0386 (GRID_SPEED_COEF)', /0\.0386/],
    ['4.5 (E_D_CELLS)', /\b4\.5\b/],
    ['0.9 (EFF_IA)', /(?<!\d)0\.9(?!\d)/],
  ];

  /** Strips comment lines (doc-comment prose legitimately explains a rule in words — "1000 ×
   *  level", "design.md §4.5" — without that being a retyped CODE literal) AND the ONE line that
   *  legitimately declares the plateau share-grid array (which contains `0.9` as a grid point,
   *  not a retyped `EFF_IA`) before scanning. */
  function codeOnly(source: string): string {
    return source
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/**')) return false;
        if (trimmed.startsWith('0, 0.05, 0.1,')) return false; // FARM_OPT_PLATEAU_SHARES's own literal.
        return true;
      })
      .join('\n');
  }

  for (const filename of FARM_OPTIMIZE_SOURCES) {
    it(`${filename} has none of: ${MAGIC_NUMBERS.map(([label]) => label).join(', ')}`, () => {
      const source = readSource(filename);
      if (source === null) return;
      const code = codeOnly(source);
      for (const [label, pattern] of MAGIC_NUMBERS) {
        expect(code, `${filename}: ${label}`).not.toMatch(pattern);
      }
    });
  }

  it('the plateau share-grid values are declared exactly once, in farm-optimize-search.ts', () => {
    const shareGridLiteral = '0, 0.05, 0.1, 0.15, 0.2';
    let declaredCount = 0;
    const declaringFiles: string[] = [];
    for (const filename of FARM_OPTIMIZE_SOURCES) {
      const source = readSource(filename);
      if (source === null) continue;
      if (source.includes(shareGridLiteral)) {
        declaredCount++;
        declaringFiles.push(filename);
      }
    }
    expect(declaredCount, `declared in: ${declaringFiles.join(', ')}`).toBe(1);
    expect(declaringFiles).toEqual(['farm-optimize-search.ts']);
  });

  it('DEMONSTRATED RED STATE: a retyped 1000 literal is caught by the magic-number scan', () => {
    const mutated = 'const respecCostGold = (level: number) => level * 1000;';
    expect(mutated).toMatch(/\b1000\b/);
  });
});

describe('the respec-cost rule has exactly one definition (FRAD-28\'s independent test)', () => {
  it('no "level * 1000" cost literal anywhere in packages/domain/src outside respec-cost.ts', () => {
    if (!requireFixture(SRC_ROOT, 'level * 1000 scan')) return;
    const pattern = /level\s*\*\s*1000|1000\s*\*\s*level/;
    const offenders: string[] = [];
    for (const file of listFiles(SRC_ROOT)) {
      if (file.endsWith(join('respec-cost.ts'))) continue;
      const source = readFileSync(file, 'utf8');
      if (pattern.test(source)) offenders.push(relative(SRC_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('DEMONSTRATED RED STATE: reintroducing "level * 1000" outside respec-cost.ts is caught', () => {
    const pattern = /level\s*\*\s*1000|1000\s*\*\s*level/;
    const mutated = 'resetCostGold: level * 1000,';
    expect(mutated).toMatch(pattern);
  });
});

describe('public-repo hygiene — no research-private identifier or path anywhere in packages/domain', () => {
  // This guard's own implementation necessarily names the pattern it matches against (as source
  // code, in its own explanatory prose) — a scanner does not scan its own rule definition.
  // Self-excluded from the scan below, not allowlisted: the exclusion is structural.
  const SELF_FILENAME = 'farm-optimize-guards.test.ts';
  const HYGIENE_PATTERN = /FRAD-|FRAW-|FRAC-|OQ-FRA-|bombfarm-research|\.specs\/|AD-1\d\d|OD-A\d/;

  it('src and tests are both clean', () => {
    const testsRoot = join(DOMAIN_ROOT, 'tests');
    if (!requireFixture(SRC_ROOT, 'hygiene scan') || !requireFixture(testsRoot, 'hygiene scan')) return;
    const offenders: string[] = [];
    for (const file of [...listFiles(SRC_ROOT), ...listFiles(testsRoot)]) {
      if (file.endsWith(SELF_FILENAME)) continue;
      const source = readFileSync(file, 'utf8');
      if (HYGIENE_PATTERN.test(source)) offenders.push(relative(DOMAIN_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('DEMONSTRATED RED STATE: a research-private id is caught by the hygiene scan', () => {
    // Built via concatenation so this line does not itself contain the forbidden substring.
    const forbiddenToken = ['FRAD', '-01'].join('');
    const mutated = `// per ${forbiddenToken}, the result carries...`;
    expect(mutated).toMatch(HYGIENE_PATTERN);
  });
});

describe('unit-doc scan — every exported type\'s numeric field in the four new sources carries a unit word', () => {
  const UNIT_WORD = /PERCENT|FRACTION|HOURS|GOLD|seconds|per hour|per second|\/hr|degrees/i;

  it('the FarmRespecPlateau/FarmRespecFrontierEntry/FarmRespecResult numeric fields document their units', () => {
    const source = readSource('farm-optimize.ts');
    if (source === null) return;
    // Every doc comment immediately preceding a numeric field declaration in the exported result
    // types must carry a recognizable unit word — spot-checked on the fields most likely to drift.
    const fieldsRequiringUnits = [
      'tolerancePct',
      'gainPct',
      'respecCostGold',
      'paybackHours',
    ];
    for (const field of fieldsRequiringUnits) {
      const fieldIndex = source.indexOf(`${field}:`);
      expect(fieldIndex, `field "${field}" not found in farm-optimize.ts`).toBeGreaterThan(-1);
      const precedingComment = source.slice(Math.max(0, fieldIndex - 400), fieldIndex);
      expect(precedingComment, `no unit word before "${field}"`).toMatch(UNIT_WORD);
    }
  });

  it('DEMONSTRATED RED STATE: a numeric field with no unit word nearby is caught', () => {
    const mutated = '/** The value. */\n  someField: number;';
    const fieldIndex = mutated.indexOf('someField:');
    const precedingComment = mutated.slice(Math.max(0, fieldIndex - 400), fieldIndex);
    expect(precedingComment).not.toMatch(UNIT_WORD);
  });
});
