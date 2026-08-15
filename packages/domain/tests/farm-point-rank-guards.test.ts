/**
 * Structural, hygiene and retired-identifier guards for the farm-mode point ranker, in the same
 * spirit as `farm-optimize-guards.test.ts`: every check demonstrates a red state on a
 * deliberately-bad in-memory fixture string before being run against the real tree, and every
 * source read routes through `requireFixture` so a renamed-away file fails loudly under CI
 * instead of silently reporting green.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { requireFixture } from './helpers/require-fixture';

const here = dirname(fileURLToPath(import.meta.url));
const DOMAIN_ROOT = join(here, '..');
const SRC_ROOT = join(DOMAIN_ROOT, 'src');
const REPO_ROOT = join(DOMAIN_ROOT, '..', '..');
const WEB_SRC_ROOT = join(REPO_ROOT, 'apps', 'web', 'src');

function readSource(root: string, relativePath: string): string | null {
  const path = join(root, relativePath);
  if (!requireFixture(path, `${relativePath} guard scan`)) return null;
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

describe('guard (a) — no recursion: advisor-pipeline.ts never re-enters the farm side', () => {
  const FORBIDDEN_IMPORT = /from\s+['"]\.\/(farm-rate|farm-optimize|farm-optimize-objective|farm-optimize-search|farm-point-rank)['"]/;

  it('advisor-pipeline.ts imports none of farm-rate / farm-optimize* / farm-point-rank', () => {
    const source = readSource(SRC_ROOT, 'advisor-pipeline.ts');
    if (source === null) return;
    expect(source).not.toMatch(FORBIDDEN_IMPORT);
  });

  it('advisor-pipeline.ts never forwards rankMode into a rankNextPoint call (the recursion trigger)', () => {
    const source = readSource(SRC_ROOT, 'advisor-pipeline.ts');
    if (source === null) return;
    // rankMode itself stays on AdvisorPipelineInput as the persisted UI setting (a deliberate,
    // documented exception on this one field) — what must never come back is the pipeline
    // ACTING on it: passing it into rankNextPoint's options, or branching computeAdvisorPipeline
    // on its value.
    expect(source).not.toMatch(/rankNextPoint\([^)]*rankMode/s);
    expect(source).not.toMatch(/mode:\s*rankMode/);
    expect(source).not.toMatch(/rankMode\s*===\s*['"]farm['"]/);
  });

  it("DEMONSTRATED RED STATE: an import of './farm-rate' is caught by the allowlist scan", () => {
    const source = readSource(SRC_ROOT, 'advisor-pipeline.ts');
    if (source === null) return;
    const mutated = `import { computeHeroFarmBases } from './farm-rate';\n${source}`;
    expect(mutated).toMatch(FORBIDDEN_IMPORT);
  });

  it("DEMONSTRATED RED STATE: a rankMode branch feeding rankNextPoint is caught", () => {
    const mutated = "rankNextPoint(effective, context, { effectiveDeltas, mode: rankMode });";
    expect(mutated).toMatch(/mode:\s*rankMode/);
  });
});

describe('guard (b) — the farm scorer is pure: it never reaches the pipeline itself', () => {
  const FORBIDDEN_IMPORT = /from\s+['"]\.\/(advisor-pipeline|derive|roster-dps|points-reopt|points-reopt-core|points-reopt-search)['"]/;

  it('farm-point-rank.ts imports none of advisor-pipeline, derive, roster-dps, points-reopt*', () => {
    const source = readSource(SRC_ROOT, 'farm-point-rank.ts');
    if (source === null) return;
    expect(source).not.toMatch(FORBIDDEN_IMPORT);
  });

  it("DEMONSTRATED RED STATE: an import of './roster-dps' is caught by the purity scan", () => {
    const source = readSource(SRC_ROOT, 'farm-point-rank.ts');
    if (source === null) return;
    const mutated = `import { pipelineForHero } from './roster-dps';\n${source}`;
    expect(mutated).toMatch(FORBIDDEN_IMPORT);
  });
});

describe('guard (c) — no retired one-shot identifier survives, with a considered allowlist', () => {
  // The seven code identifiers the one-shot heuristic existed only to serve — deleted outright,
  // no allowlist entry possible for any of these.
  const RETIRED_IDENTIFIERS = /\b(useOneshot|hitSize|breakpointBonus|gapShrink|hitRelevant|targetPropHp|hitDmgMult)\b/;

  // The standalone word "oneshot" (case-insensitive, word-bounded so it does NOT match inside a
  // longer identifier like `oneshotGapPct` or `formatOneShot` — there is no boundary between
  // "shot" and the following letter in either). What DOES match: a quoted string like
  // "oneshot ranking", an HTML attribute value, or a stray comment word.
  const ONESHOT_WORD = /\boneshot\b/i;

  type Allowed = { file: string; reason: string };

  // Survives FOREVER — these identifiers were never part of the retired ranking heuristic: the
  // prop hits-to-kill table's gap column and the Farm Ranking board's one-shot column are their
  // own separate, still-shipping features, along with their tests. None of these are the
  // retired RANKING mode.
  const PERMANENT_ALLOWLIST: Allowed[] = [
    { file: join(SRC_ROOT, 'phases.ts'), reason: 'oneshotGapPct doc comment — the prop table column, untouched' },
    { file: join(SRC_ROOT, 'farm-rate.ts'), reason: 'FarmRateRow.oneShot — the ranking board column, untouched' },
    {
      file: join(WEB_SRC_ROOT, 'features/phases/components/farm-ranking-row.tsx'),
      reason: 'renders FarmRateRow.oneShot via formatOneShot',
    },
    {
      file: join(WEB_SRC_ROOT, 'features/phases/components/farm-ranking-table.tsx'),
      reason: 'the oneShot column width',
    },
    { file: join(WEB_SRC_ROOT, 'features/phases/model/farm-ranking-format.ts'), reason: 'formatOneShot itself' },
    {
      file: join(WEB_SRC_ROOT, 'features/phases/model/farm-ranking-view.ts'),
      reason: 'the oneShot column id + farmRankingColOneShot header key',
    },
    { file: join(WEB_SRC_ROOT, 'tests/farm-ranking-view.test.ts'), reason: 'tests the oneShot column' },
    { file: join(WEB_SRC_ROOT, 'tests/phases.test.ts'), reason: "tests oneshotGapPct ('oneshot gap' in a test title)" },
    {
      file: join(WEB_SRC_ROOT, 'tests/fixtures/i18n-strings-main.json'),
      reason: 'the FROZEN i18n parity fixture — not regenerated by this item; keeps retired strings as its historical baseline',
    },
  ];

  it('packages/domain/src has zero matches for the seven retired identifiers', () => {
    if (!requireFixture(SRC_ROOT, 'retired-identifier scan')) return;
    const offenders: string[] = [];
    for (const file of listFiles(SRC_ROOT)) {
      const source = readFileSync(file, 'utf8');
      if (RETIRED_IDENTIFIERS.test(source)) offenders.push(relative(SRC_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('apps/web/src has zero matches for the seven retired identifiers', () => {
    if (!requireFixture(WEB_SRC_ROOT, 'retired-identifier scan')) return;
    const offenders: string[] = [];
    for (const file of listFiles(WEB_SRC_ROOT)) {
      const source = readFileSync(file, 'utf8');
      if (RETIRED_IDENTIFIERS.test(source)) offenders.push(relative(WEB_SRC_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('every standalone "oneshot" match in packages/domain/src is on the permanent allowlist', () => {
    if (!requireFixture(SRC_ROOT, 'oneshot-word scan')) return;
    const allowedPaths = new Set(PERMANENT_ALLOWLIST.map((a) => a.file));
    const offenders: string[] = [];
    for (const file of listFiles(SRC_ROOT)) {
      if (allowedPaths.has(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (ONESHOT_WORD.test(source)) offenders.push(relative(SRC_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  // apps/web/src still carries the retired mode's i18n strings and select option at this point
  // in the item — they are removed by the item's later tasks (the mode select option, the
  // account-tab hint reword, and the i18n catalog cleanup), each of which tightens this same
  // allowlist as its own strings leave the tree. This is NOT a permanent carve-out: every entry
  // below names the task that removes it, so the survivors are proved considered, not missed.
  const SCHEDULED_FOR_LATER_RETIREMENT: Allowed[] = [
    {
      file: join(WEB_SRC_ROOT, 'features/planner/components/next-point-ranking.tsx'),
      reason: 'the retired <option value="oneshot"> — removed when the mode select is updated',
    },
    {
      file: join(WEB_SRC_ROOT, 'shared/i18n/namespaces/account.ts'),
      reason: 'setupNeedTargetProp / accountTargetPropHint oneshot phrasing — retired/reworded with the account copy',
    },
    {
      file: join(WEB_SRC_ROOT, 'shared/i18n/namespaces/advice.ts'),
      reason: 'modeOneshot keys + the explain-math paragraph — retired/reworded with the advice copy',
    },
    {
      file: join(WEB_SRC_ROOT, 'shared/lib/account-shared.ts'),
      reason: "targetProp's doc comment still says \"Oneshot / HTK prop\" — reworded when the migration/default lands on this same file",
    },
  ];

  it('every standalone "oneshot" match in apps/web/src is either permanently allowed, or on the scheduled-retirement list', () => {
    if (!requireFixture(WEB_SRC_ROOT, 'oneshot-word scan')) return;
    const allowedPaths = new Set([
      ...PERMANENT_ALLOWLIST.map((a) => a.file),
      ...SCHEDULED_FOR_LATER_RETIREMENT.map((a) => a.file),
    ]);
    const offenders: string[] = [];
    for (const file of listFiles(WEB_SRC_ROOT)) {
      if (allowedPaths.has(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (ONESHOT_WORD.test(source)) offenders.push(relative(WEB_SRC_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('DEMONSTRATED RED STATE: a reintroduced useOneshot identifier is caught', () => {
    const mutated = 'const useOneshot = options.mode === "oneshot";';
    expect(mutated).toMatch(RETIRED_IDENTIFIERS);
  });

  it('DEMONSTRATED RED STATE: a standalone "oneshot" word in a fresh file is caught, but the embedded form is not', () => {
    expect('rank in oneshot mode').toMatch(ONESHOT_WORD);
    expect('oneshotGapPct').not.toMatch(ONESHOT_WORD);
    expect('formatOneShot').not.toMatch(ONESHOT_WORD);
  });
});

describe('guard (e) — public-repo hygiene: no research-private identifier in this item\'s own files', () => {
  // Neither this guard's own implementation nor item A's sibling `farm-optimize-guards.test.ts`
  // can avoid naming the pattern they match against, as source code, in their own regex
  // definitions — a scanner does not scan its own rule definition. Both are self-excluded from
  // the scan below, not allowlisted: the exclusion is structural.
  const SELF_FILENAMES = ['farm-point-rank-guards.test.ts', 'farm-optimize-guards.test.ts'];
  const HYGIENE_PATTERN = /FRAD-|FRAW-|FRAC-|OD-A\d|OQ-FRA-|AD-1\d\d|bombfarm-research|\.specs\//;

  it('this item\'s new domain files are clean', () => {
    const newFiles = ['farm-point-rank.ts'].map((f) => join(SRC_ROOT, f));
    const newTestFiles = [
      'farm-point-rank.test.ts',
      'farm-point-rank-perf.test.ts',
      'points-rank-golden.test.ts',
    ].map((f) => join(DOMAIN_ROOT, 'tests', f));
    const offenders: string[] = [];
    for (const file of [...newFiles, ...newTestFiles]) {
      if (!requireFixture(file, 'hygiene scan')) continue;
      const source = readFileSync(file, 'utf8');
      if (HYGIENE_PATTERN.test(source)) offenders.push(relative(DOMAIN_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('packages/domain/src and packages/domain/tests are clean, item-wide (this item lives inside item A\'s existing package-wide hygiene guard too)', () => {
    if (!requireFixture(SRC_ROOT, 'hygiene scan') || !requireFixture(join(DOMAIN_ROOT, 'tests'), 'hygiene scan')) return;
    const offenders: string[] = [];
    for (const file of [...listFiles(SRC_ROOT), ...listFiles(join(DOMAIN_ROOT, 'tests'))]) {
      if (SELF_FILENAMES.some((name) => file.endsWith(name))) continue;
      const source = readFileSync(file, 'utf8');
      if (HYGIENE_PATTERN.test(source)) offenders.push(relative(DOMAIN_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('DEMONSTRATED RED STATE: a research-private id is caught by the hygiene scan', () => {
    // Built via concatenation so this line does not itself contain the forbidden substring.
    const forbiddenToken = ['FRA', 'C-03'].join('');
    const mutated = `// per ${forbiddenToken}, the discrimination test proves...`;
    expect(mutated).toMatch(HYGIENE_PATTERN);
  });
});
