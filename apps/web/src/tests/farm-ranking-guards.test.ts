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

/**
 * The board's two halves now live in two packages: its components are still this app's, its
 * pure model/format layer is `@bombfarm/farm`'s, so the desktop app can render the same screen.
 * Both are scanned, and `both board dirs contribute files` below fails if either half ever stops
 * resolving — a source-scanning guard pointed at a path that no longer exists keeps passing
 * while checking nothing, which is the one way these guards die silently.
 */
const BOARD_DIRS = [
  path.join(WEB_PACKAGE_ROOT, 'src/features/phases/components'),
  path.join(WEB_PACKAGE_ROOT, '../../packages/farm/src/model'),
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

function boardFilesIn(dir: string): { path: string; text: string }[] {
  const files = walkFiles(
    dir,
    (name) =>
      name.startsWith('farm-') &&
      !name.endsWith('.test.ts') &&
      !name.endsWith('.test.tsx') &&
      (name.endsWith('.ts') || name.endsWith('.tsx')),
  );
  return files.map((file) => ({ path: file, text: fs.readFileSync(file, 'utf8') }));
}

function boardFiles(): { path: string; text: string }[] {
  return BOARD_DIRS.flatMap(boardFilesIn);
}

describe('the board tree the guards below scan', () => {
  it('both board dirs exist and contribute files — no guard is silently scanning nothing', () => {
    for (const dir of BOARD_DIRS) {
      expect(fs.existsSync(dir), `${dir} does not exist`).toBe(true);
      expect(boardFilesIn(dir).length, `${dir} contributed no farm-* file`).toBeGreaterThan(0);
    }
  });

  it('red state: a dir that does not exist contributes nothing, which is what the check above catches', () => {
    expect(boardFilesIn(path.join(WEB_PACKAGE_ROOT, 'src/features/phases/nowhere'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (a) One compute: zero advisor-pipeline calls anywhere under the board's tree.
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

describe('guard (a) — zero advisor-pipeline calls under the board tree', () => {
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
      offenders.map((o) => `${o.file} references ${o.hit} (@bombfarm/domain owns every pipeline call)`).join('\n'),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (f)/(g) One farm-rate importer and one farm-optimize importer — now BOTH in @bombfarm/farm,
// and NEITHER in apps/web.
//
// FarmRateRow/FarmRateOptions/ReturnBonusMode/FarmRespecResult must be consumed as
// @bombfarm/domain declares them — no local re-declaration — which forces a pure
// `import type { ... } from '@bombfarm/domain/farm-rate'` in every component and model file that
// types a row prop, and in the return-bonus control. A pure `import type` erases at compile time
// (zero bundle bytes, zero possibility of carrying a re-implemented computation), so it is
// allowed anywhere. These guards' real teeth is that no SECOND file may import a RUNTIME binding
// (computeFarmRates, gateFarmRespec and their siblings), and that apps/web may import none at
// all now that the compute itself lives in the package.
//
// The web half is a ZERO assertion, which is the one shape that can pass while checking nothing.
// Two things stop that here: `scannedCount` proves the scan reached files, and the package half
// is a POSITIVE `toEqual([...])` naming the one file — so "the compute vanished" fails there
// rather than passing everywhere.
// ---------------------------------------------------------------------------------------------
const WEB_SRC = path.join(WEB_PACKAGE_ROOT, 'src');
const FARM_PACKAGE_ROOT = path.join(WEB_PACKAGE_ROOT, '../../packages/farm');
const FARM_SRC = path.join(FARM_PACKAGE_ROOT, 'src');

/** True when the file imports a non-type-only binding from the given `@bombfarm/domain/*`
 *  specifier. Parameterised (not duplicated) so the farm-rate and farm-optimize checks share one
 *  classifier that cannot disagree with itself. */
function importsRuntimeBinding(text: string, specifier: string): boolean {
  // `^` + `m` flag: only matches real import statements (line-start), never an "import"
  // substring inside a comment (this file's own comments say "the type-only import" etc.).
  const statementRe = new RegExp(`^import\\s+([^;]*?)\\s+from\\s+['"]${specifier}['"]`, 'gm');
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

/** Production `.ts`/`.tsx` under `root`: co-located `*.test.*` files and anything inside a
 *  `tests/` directory are excluded, since a test may legitimately call the domain directly. */
function productionFilesUnder(root: string): string[] {
  return walkFiles(
    root,
    (name) =>
      (name.endsWith('.ts') || name.endsWith('.tsx')) &&
      !name.endsWith('.test.ts') &&
      !name.endsWith('.test.tsx'),
  ).filter((abs) => !abs.includes(`${path.sep}tests${path.sep}`));
}

function runtimeImportersUnder(root: string, relativeTo: string, specifier: string): string[] {
  return productionFilesUnder(root)
    .filter((abs) => importsRuntimeBinding(fs.readFileSync(abs, 'utf8'), specifier))
    .map((abs) => path.relative(relativeTo, abs).split(path.sep).join('/'));
}

describe('guards (f)/(g) — the runtime-import classifier', () => {
  it('red state: a fabricated runtime import of computeFarmRates is caught', () => {
    expect(
      importsRuntimeBinding("import { computeFarmRates } from '@bombfarm/domain/farm-rate';", '@bombfarm/domain/farm-rate'),
    ).toBe(true);
  });

  it('red state: a fabricated runtime import of solveFarmRespec is caught', () => {
    expect(
      importsRuntimeBinding(
        "import { solveFarmRespec } from '@bombfarm/domain/farm-optimize';",
        '@bombfarm/domain/farm-optimize',
      ),
    ).toBe(true);
  });

  it('red state: a fabricated inline mixed import (runtime + type) is still caught as runtime', () => {
    expect(
      importsRuntimeBinding(
        "import { computeFarmRates, type FarmRateRow } from '@bombfarm/domain/farm-rate';",
        '@bombfarm/domain/farm-rate',
      ),
    ).toBe(true);
    expect(
      importsRuntimeBinding(
        "import { solveFarmRespec, type FarmRespecResult } from '@bombfarm/domain/farm-optimize';",
        '@bombfarm/domain/farm-optimize',
      ),
    ).toBe(true);
  });

  it('a pure `import type { ... }` clause is correctly classified as non-runtime', () => {
    expect(
      importsRuntimeBinding("import type { FarmRateRow } from '@bombfarm/domain/farm-rate';", '@bombfarm/domain/farm-rate'),
    ).toBe(false);
    expect(
      importsRuntimeBinding(
        "import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';",
        '@bombfarm/domain/farm-optimize',
      ),
    ).toBe(false);
  });

  it('both scanned trees contribute production files — neither zero assertion is vacuous', () => {
    expect(productionFilesUnder(WEB_SRC).length, 'apps/web/src contributed no file').toBeGreaterThan(0);
    expect(productionFilesUnder(FARM_SRC).length, 'packages/farm/src contributed no file').toBeGreaterThan(0);
  });
});

describe('guard (f) — @bombfarm/domain/farm-rate: one RUNTIME importer, and it is in the package', () => {
  it('green state: exactly one production file in @bombfarm/farm imports a runtime binding', () => {
    expect(
      runtimeImportersUnder(FARM_SRC, FARM_PACKAGE_ROOT, '@bombfarm/domain/farm-rate'),
    ).toEqual(['src/core/farm-compute.ts']);
  });

  it('green state: apps/web imports NO runtime binding from farm-rate', () => {
    expect(runtimeImportersUnder(WEB_SRC, WEB_PACKAGE_ROOT, '@bombfarm/domain/farm-rate')).toEqual([]);
  });
});

describe('guard (g) — @bombfarm/domain/farm-optimize: one RUNTIME importer, and it is in the package', () => {
  it('green state: exactly one production file in @bombfarm/farm imports a runtime binding', () => {
    expect(
      runtimeImportersUnder(FARM_SRC, FARM_PACKAGE_ROOT, '@bombfarm/domain/farm-optimize'),
    ).toEqual(['src/core/farm-compute.ts']);
  });

  it('green state: apps/web imports NO runtime binding from farm-optimize', () => {
    expect(runtimeImportersUnder(WEB_SRC, WEB_PACKAGE_ROOT, '@bombfarm/domain/farm-optimize')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (b) No save writes.
// ---------------------------------------------------------------------------------------------
const ROSTER_MUTATORS = ['patchHero(', 'setHeroes(', 'upsertHero(', 'saveHeroes('];

function findRosterMutator(text: string): string | null {
  const call = ROSTER_MUTATORS.find((name) => text.includes(name));
  if (call) return call;
  if (text.includes('bf-hp-heroes-v1')) return 'bf-hp-heroes-v1';
  return null;
}

describe('guard (b) — no board file writes the roster or the save', () => {
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
// (e) No re-implemented math.
// ---------------------------------------------------------------------------------------------
const RATE_FIELD_NAMES = [
  'goldPerHour',
  'chestsPerHour',
  'keysPerHour',
  'gemsPerHour',
  'timePiecesPerHour',
  'stoneChestsPerHour',
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

describe('guard (e) — no re-implemented rate arithmetic in apps/web', () => {
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

  it('the ONE allowed carve-out shape — the per-key point delta (entry.proposedPts[key] - entry.currentPts[key]) — is NOT flagged', () => {
    const allowed = 'delta: entry.proposedPts[key] - entry.currentPts[key],';
    expect(findRateArithmetic(allowed)).toBeNull();
    expect(findPerPropOneShotDerivation(allowed)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// (c) No inline copy. Scoped to the new components only.
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

describe('guard (c) — no player-facing string literal at a JSX call site', () => {
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
// (d) No renamed keys. Cross-checked against the baseline guard file.
// ---------------------------------------------------------------------------------------------
describe('guard (d) — persisted key strings unchanged', () => {
  it('a dedicated test file already pins this (farm-persisted-keys-guard.test.ts)', () => {
    expect(
      fs.existsSync(path.join(WEB_PACKAGE_ROOT, 'src/tests/farm-persisted-keys-guard.test.ts')),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// (h) No research-private identifier or path anywhere in apps/web or the shared farm package
// (public-repo hygiene).
// ---------------------------------------------------------------------------------------------
describe('guard (h) — no research-private identifier or path in apps/web or @bombfarm/farm', () => {
  const RESEARCH_ID_PATTERNS = [
    /FRAW-/,
    /FRAD-/,
    /FRAC-/,
    /OQ-FRA-/,
    /OD-A/,
    /AD-1\d\d/,
    // Any sibling `bombfarm-*` repo other than this one. Written as a negative lookahead rather
    // than spelling a sibling's name: this repo is public and the siblings are not, so the guard
    // must not disclose what it guards against. Also catches a sibling added later, for free.
    /bombfarm-(?!companion)[a-z][a-z-]*/,
    /\.specs\//,
  ];

  /** Named narrowly so it cannot accidentally hide a real hit: the guard's OWN file, which must
   *  contain these substrings to define the patterns and the red-state fixtures below. */
  const SELF_EXCLUDED_FILE = 'src/tests/farm-ranking-guards.test.ts';

  function findResearchId(text: string): string | null {
    for (const pattern of RESEARCH_ID_PATTERNS) {
      const match = pattern.exec(text);
      if (match) return match[0];
    }
    return null;
  }

  it('red state: a fabricated FRAW- reference is caught', () => {
    expect(findResearchId('see FRAW-09 for the requirement')).toBe('FRAW-');
  });

  // The fixture names a sibling that does not exist, so the guard is exercised without this
  // public file naming a real private repo.
  it('red state: a fabricated sibling-repo path reference is caught', () => {
    expect(findResearchId('read it from the bombfarm-elsewhere repo')).toBe('bombfarm-elsewhere');
  });

  it('green state: this repo\'s own name is not treated as a sibling', () => {
    expect(findResearchId('see the bombfarm-companion README')).toBeNull();
  });

  it('red state: a fabricated .specs/ path reference is caught', () => {
    expect(findResearchId('.specs/features/fra-web-ui/design.md')).toBe('.specs/');
  });

  // The farm package is scanned too: the farm screen's copy and model layer moved there, and a
  // guard that stops following its subject stops guarding without ever going red.
  const SCANNED_ROOTS = [
    path.join(WEB_PACKAGE_ROOT, 'src'),
    path.join(WEB_PACKAGE_ROOT, '../../packages/farm/src'),
  ];

  it('green state: no apps/web or @bombfarm/farm source or test file (this guard\'s own file self-excluded) contains a research-private identifier or path', () => {
    const files = SCANNED_ROOTS.flatMap((root) =>
      walkFiles(root, (name) => name.endsWith('.ts') || name.endsWith('.tsx')),
    );
    expect(files.length, 'scanned file count').toBeGreaterThan(0);
    for (const root of SCANNED_ROOTS) {
      expect(files.some((abs) => abs.startsWith(root)), `${root} contributed no file`).toBe(true);
    }
    const offenders: string[] = [];
    for (const abs of files) {
      const rel = path.relative(WEB_PACKAGE_ROOT, abs).split(path.sep).join('/');
      if (rel === SELF_EXCLUDED_FILE) continue;
      const hit = findResearchId(fs.readFileSync(abs, 'utf8'));
      if (hit) offenders.push(`${rel}: contains "${hit}" — a research-private identifier/path has no place in this public repo`);
    }
    expect(offenders).toEqual([]);
  });

  it('green state: the changeset directory carries no research-private identifier or path', () => {
    const changesetDir = path.join(WEB_PACKAGE_ROOT, '../../.changeset');
    const files = walkFiles(changesetDir, (name) => name.endsWith('.md'));
    const offenders: string[] = [];
    for (const abs of files) {
      const hit = findResearchId(fs.readFileSync(abs, 'utf8'));
      if (hit) offenders.push(`${path.relative(WEB_PACKAGE_ROOT, abs)}: contains "${hit}"`);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (i) No useShallow wrapping the three new farm respec selectors.
// ---------------------------------------------------------------------------------------------
describe('guard (i) — no useShallow on the new farm respec selectors', () => {
  const GUARDED_SELECTORS = ['selectFarmBoardRows', 'selectFarmRespecGate', 'selectFarmRespecView'];

  function findUseShallowWrap(text: string, selectorName: string): boolean {
    return new RegExp(`useShallow\\([^)]*${selectorName}`).test(text);
  }

  it('red state: a fabricated useShallow(selectFarmBoardRows) wrap is caught', () => {
    expect(
      findUseShallowWrap('usePlannerStore(useShallow(selectFarmBoardRows))', 'selectFarmBoardRows'),
    ).toBe(true);
  });

  it('green state: no source file wraps selectFarmBoardRows, selectFarmRespecGate or selectFarmRespecView in useShallow', () => {
    const files = walkFiles(
      path.join(WEB_PACKAGE_ROOT, 'src'),
      (name) => name.endsWith('.ts') || name.endsWith('.tsx'),
    );
    const offenders: string[] = [];
    for (const abs of files) {
      const rel = path.relative(WEB_PACKAGE_ROOT, abs).split(path.sep).join('/');
      if (rel.includes('/tests/')) continue;
      const text = fs.readFileSync(abs, 'utf8');
      for (const selectorName of GUARDED_SELECTORS) {
        if (findUseShallowWrap(text, selectorName)) offenders.push(`${rel}: useShallow wraps ${selectorName}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Component inventory — no second avatar-plus-rarity identity composition under features/phases.
// ---------------------------------------------------------------------------------------------
describe('guard — HeroIdentityChip is the only identity composition this item adds under features/phases', () => {
  it('no farm-respec-*/farm-ranking-* file imports HeroAvatar directly without going through HeroIdentityChip', () => {
    // Scoped to this item's own farm-* files (boardFiles()) — features/phases already had
    // pre-existing, unrelated HeroAvatar consumers (phases-hero-switcher.tsx,
    // phases-top9-table.tsx) before this item, and this guard is about THIS item not inventing a
    // second identity composition, not about banning HeroAvatar repo-wide.
    const offenders = boardFiles()
      .filter((file) => file.path.endsWith('.tsx'))
      .filter((file) => file.text.includes('HeroAvatar') && !file.text.includes('HeroIdentityChip'))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });
});
