import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

/**
 * Six source-scanning guards this repo has learned to write down rather than review for
 * (`mod-17-max-props.test.ts`, `devtools-not-in-production-bundle.test.ts` are the convention).
 * Each check function is exercised against a deliberately-bad in-memory fixture string first
 * (proving it CAN fail — "red state demonstrated") before being run against the real tree.
 */

const BOARD_DIRS = [
  'src/features/phases/components',
  'src/features/phases/model',
];

function walkFiles(dir: string, predicate: (name: string) => boolean, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, acc);
    else if (predicate(entry.name)) acc.push(full);
  }
  return acc;
}

function boardFiles(): { path: string; text: string }[] {
  const files: string[] = [];
  for (const dir of BOARD_DIRS) {
    walkFiles(path.join(WEB_PACKAGE_ROOT, dir), (name) => name.startsWith('farm-') && (name.endsWith('.ts') || name.endsWith('.tsx')), files);
  }
  return files.map((file) => ({ path: file, text: fs.readFileSync(file, 'utf8') }));
}

// ---------------------------------------------------------------------------------------------
// (a) One compute — R-C20: zero advisor-pipeline calls anywhere under the board's tree.
// ---------------------------------------------------------------------------------------------
const FORBIDDEN_PIPELINE_IMPORTS = [
  'computeAdvisorPipeline',
  'pipelineForHero',
  'computeHeroPhaseFitFromRecord',
  'rankRosterByDps',
];

function findPipelineImport(text: string): string | null {
  return FORBIDDEN_PIPELINE_IMPORTS.find((name) => text.includes(name)) ?? null;
}

describe('guard (a) — zero advisor-pipeline calls under the board tree (R-C20)', () => {
  it('red state: a fabricated snippet importing pipelineForHero is caught', () => {
    const bad = `import { pipelineForHero } from '@bombfarm/domain/roster-dps';`;
    expect(findPipelineImport(bad)).toBe('pipelineForHero');
  });

  it('green state: no board file imports any advisor-pipeline symbol', () => {
    const offenders = boardFiles()
      .map((file) => ({ file: file.path, hit: findPipelineImport(file.text) }))
      .filter((entry) => entry.hit);
    expect(
      offenders,
      offenders.map((o) => `${o.file} references ${o.hit} (R-C20: item B owns every pipeline call)`).join('\n'),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (f) One farm-rate importer — R-C20 AC-7.
// ---------------------------------------------------------------------------------------------
describe('guard (f) — @bombfarm/domain/farm-rate: one RUNTIME importer (R-C20 AC-7)', () => {
  const srcRoot = path.join(WEB_PACKAGE_ROOT, 'src');
  const allowedRuntimeFile = 'src/shared/stores/selectors/farm-ranking-selectors.ts';

  // NOTE on scope, recorded for the validator: AD-PFRC-08 requires FarmRateRow/FarmRateOptions/
  // ReturnBonusMode to be consumed "as B declares it — no local re-declaration". That forces a
  // pure `import type { FarmRateRow } from '@bombfarm/domain/farm-rate'` in every component/model
  // file that types a row prop (farm-ranking-row.tsx, farm-ranking-table.tsx,
  // farm-ranking-view.ts) and in farm-return-bonus.tsx (ReturnBonusMode) — not just the single
  // `phases-view-storage.ts` example tasks.md names. A pure `import type` erases at compile time
  // (zero bundle bytes, zero possibility of carrying a re-implemented computation) — R-C20's
  // real teeth is that no SECOND file can import a runtime binding (computeFarmRates and its
  // siblings). This guard therefore allows `import type { ... }` in any src file and restricts
  // only import statements that carry at least one non-type binding to the selector file.

  /** True when the file imports a non-type-only binding from `@bombfarm/domain/farm-rate`. */
  function importsRuntimeBinding(text: string): boolean {
    // `^` + `m` flag: only matches real import statements (line-start), never an "import"
    // substring inside a comment (this file's own comments say "the type-only import" etc.).
    const statementRe = /^import\s+([^;]*?)\s+from\s+['"]@bombfarm\/domain\/farm-rate['"]/gm;
    for (const match of text.matchAll(statementRe)) {
      const clause = match[1].trim();
      if (clause.startsWith('type ')) continue; // `import type { ... }` — pure type-only.
      // Inline form: `import { computeFarmRates, type FarmRateRow }` — strip `type X` members
      // and see if any binding remains.
      const inner = clause.replace(/^\{|\}$/g, '');
      const members = inner.split(',').map((member) => member.trim()).filter(Boolean);
      const hasRuntimeMember = members.some((member) => !member.startsWith('type '));
      if (hasRuntimeMember) return true;
    }
    return false;
  }

  function runtimeImporters(): string[] {
    const files = walkFiles(srcRoot, (name) => name.endsWith('.ts') || name.endsWith('.tsx'));
    return files
      .filter((abs) => !abs.includes(`${path.sep}tests${path.sep}`))
      .map((abs) => path.relative(WEB_PACKAGE_ROOT, abs).split(path.sep).join('/'))
      .filter((rel) => importsRuntimeBinding(fs.readFileSync(path.join(WEB_PACKAGE_ROOT, rel), 'utf8')));
  }

  it('red state: a fabricated second-file runtime import of computeFarmRates is caught', () => {
    expect(importsRuntimeBinding("import { computeFarmRates } from '@bombfarm/domain/farm-rate';")).toBe(true);
  });

  it('red state: a fabricated inline mixed import (runtime + type) is still caught as runtime', () => {
    expect(
      importsRuntimeBinding("import { computeFarmRates, type FarmRateRow } from '@bombfarm/domain/farm-rate';"),
    ).toBe(true);
  });

  it("a pure `import type { FarmRateRow }` is correctly classified as non-runtime (does not trip the guard)", () => {
    expect(importsRuntimeBinding("import type { FarmRateRow } from '@bombfarm/domain/farm-rate';")).toBe(false);
  });

  it('green state: exactly one production file imports a runtime binding from farm-rate', () => {
    expect(runtimeImporters()).toEqual([allowedRuntimeFile]);
  });
});

// ---------------------------------------------------------------------------------------------
// (b) No save writes — R-C15.
// ---------------------------------------------------------------------------------------------
const ROSTER_MUTATORS = ['patchHero(', 'setHeroes(', 'upsertHero(', 'saveHeroes('];

function findRosterMutator(text: string): string | null {
  const call = ROSTER_MUTATORS.find((name) => text.includes(name));
  if (call) return call;
  if (text.includes('bf-hp-heroes-v1')) return 'bf-hp-heroes-v1';
  return null;
}

describe('guard (b) — no board file writes the roster or the save (R-C15)', () => {
  it('red state: a fabricated snippet calling setHeroes( is caught', () => {
    expect(findRosterMutator('state.setHeroes(nextRoster)')).toBe('setHeroes(');
  });

  it('red state: a fabricated snippet referencing bf-hp-heroes-v1 is caught', () => {
    expect(findRosterMutator("localStorage.getItem('bf-hp-heroes-v1')")).toBe('bf-hp-heroes-v1');
  });

  it('green state: no board file calls a roster mutator or references bf-hp-heroes-v1', () => {
    const offenders = boardFiles()
      .map((file) => ({ file: file.path, hit: findRosterMutator(file.text) }))
      .filter((entry) => entry.hit);
    expect(offenders, offenders.map((o) => `${o.file}: ${o.hit}`).join('\n')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (e) No re-implemented math — R-C20 / R-C29 / ASM-C17.
// ---------------------------------------------------------------------------------------------
const RATE_FIELD_NAMES = [
  'goldPerHour',
  'chestsPerHour',
  'keysPerHour',
  'gemsPerHour',
  'timePiecesPerHour',
  'xpPerHour',
  'mitigationPct',
  'propsPerHour',
  'clearSecs',
];

/** Any `row.<rateField> <op>` where op is an arithmetic operator — a re-derivation smell. */
function findRateArithmetic(text: string): string | null {
  for (const field of RATE_FIELD_NAMES) {
    const re = new RegExp(`\\brow\\.${field}\\s*[*/+-]`);
    if (re.test(text)) return field;
  }
  return null;
}

/** The specific per-prop one-shot temptation: avgHitBase/mitigationPct compared to a prop HP. */
function findPerPropOneShotDerivation(text: string): boolean {
  return /avgHitBase/.test(text) && /mitigationPct/.test(text) && /(>=|<=|>|<)/.test(text);
}

describe('guard (e) — no re-implemented rate arithmetic in apps/web (R-C20, R-C29)', () => {
  it('red state 1: a fabricated snippet multiplying row.goldPerHour is caught', () => {
    expect(findRateArithmetic('const doubled = row.goldPerHour * 2;')).toBe('goldPerHour');
  });

  it('red state 2: a fabricated per-prop one-shot comparison (avgHitBase vs mitigationPct-derived hit vs prop HP) is caught', () => {
    const bad = 'const oneShots = hero.avgHitBase * mitigationFactor(row.mitigationPct) >= propHp;';
    expect(findPerPropOneShotDerivation(bad)).toBe(true);
  });

  it('green state: no board/model file performs arithmetic on a FarmRateRow rate field or derives per-prop one-shot', () => {
    const offenders: string[] = [];
    for (const file of boardFiles()) {
      const arithmeticHit = findRateArithmetic(file.text);
      if (arithmeticHit) offenders.push(`${file.path}: arithmetic on row.${arithmeticHit}`);
      if (findPerPropOneShotDerivation(file.text)) offenders.push(`${file.path}: per-prop one-shot derivation`);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (c) No inline copy — R-C22. Scoped to the new components only.
// ---------------------------------------------------------------------------------------------
const ATTR_ALLOWLIST = new Set(['data-testid', 'className', 'href', 'id', 'role', 'type', 'key', 'value']);

/**
 * Flags `title="literal"` / `aria-label="literal"` / `placeholder="literal"` / `label="literal"`
 * — a non-empty double-quoted or single-quoted literal (not a `{t.*}` expression).
 */
function findInlineAttrCopy(text: string): string[] {
  const attrRe = /\b(title|aria-label|placeholder|label)=["']([^"'{}]+)["']/g;
  const hits: string[] = [];
  for (const match of text.matchAll(attrRe)) {
    if (!ATTR_ALLOWLIST.has(match[1]) && match[2].trim() !== '') hits.push(`${match[1]}="${match[2]}"`);
  }
  return hits;
}

describe('guard (c) — no player-facing string literal at a JSX call site (R-C22)', () => {
  it('red state: a fabricated aria-label="Enable hero" literal is caught', () => {
    expect(findInlineAttrCopy('<Switch aria-label="Enable hero" />')).toEqual(['aria-label="Enable hero"']);
  });

  it('green state: no new component hardcodes title/aria-label/placeholder/label — every value is t.*', () => {
    const offenders = boardFiles()
      .filter((file) => file.path.includes('/components/'))
      .flatMap((file) => findInlineAttrCopy(file.text).map((hit) => `${file.path}: ${hit}`));
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (d) No renamed keys — R-C4. Cross-checked against the T1 baseline guard file.
// ---------------------------------------------------------------------------------------------
describe('guard (d) — persisted key strings unchanged (R-C4)', () => {
  it('a dedicated test file already pins this (farm-persisted-keys-guard.test.ts)', () => {
    expect(
      fs.existsSync(path.join(WEB_PACKAGE_ROOT, 'src/tests/farm-persisted-keys-guard.test.ts')),
    ).toBe(true);
  });
});
