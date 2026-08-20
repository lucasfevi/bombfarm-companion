/**
 * MP5 F2 (T2, `AD-076`) — the pre-deletion characterization baseline. The mechanism that makes
 * MP5's headline risk ("F2 edits fidelity-gated sheet math while deleting fields, and numbers
 * drift silently") assertable rather than reviewable: a committed pre-deletion recording of the
 * entire SURVIVING numeric surface, compared bit-exactly against every post-deletion commit.
 *
 * Named `invariance-*`, deliberately never named after any deleted arm (design TD-5) — a file
 * named after one would trip this feature's own absence guard (T10's `source-surface.test.ts`).
 *
 * A decimal-digit-tolerance assertion style is deliberately never used in this file: it would
 * silently absorb exactly the class of drift this suite exists to catch (a 5e-3 error still
 * rounds "close"). A deep-equality assertion is never used for numbers either — it treats `0`
 * and `-0` as equal, which is the one corner (MKR-18) this suite must not paper over. Every
 * numeric leaf in the record is pre-encoded by `encodeNumber` (sign- and precision-preserving),
 * so the top-level comparison is exact string equality on the canonical JSON serialisation, and
 * the walk below decodes leaves back to numbers for a same-value comparison (`Object.is`) only
 * to name the first differing hero/function/stat on failure.
 *
 * RE-RECORDED (3) at the 2026-08-18 patch (issue #132), which reverted crit chance and cooldown
 * from the flat addends the 2026-08-15 patch introduced back to percent-of-base, three days
 * later. **473** of the ~2800+ recorded scalars moved — every `critChance`/`cdr` field on every
 * subject (`applySkillTree`, `composeSheetFromBirth`, `sheetsFromBirth`, `peelSheetStages`,
 * `peelSheetSources`, `inferSpentPoints`, `derive.*`) and the `computeCombatMults` key rename
 * (`teamCritChanceFlat` → `teamCritPctOfBase`, mirroring RE-RECORDED (2)'s own rename in
 * reverse). `meta.scalarCount` moved too (2830 → 2832) — the walk itself is unchanged, the
 * corpus fixtures are unchanged, only the crit/CDR shape is. NOT moved: every non-`critChance`/
 * `cdr` sheet key, every `inferSpentPoints` value on the other seven keys, and everything crit-
 * DAMAGE (unaffected by either patch).
 *
 * ---
 * RE-RECORDED (2) at the 2026-08-15 patch, when crit chance and cooldown became flat addends
 * (`POINT_GAIN.critChanceFlat` / `.cdrFlat`) exactly as crit damage had at the 2026-08-13 one.
 * **461** of the ~2500+ recorded scalars moved, and every one is downstream of those two stats
 * or is the rename that carried them:
 *
 * - `delta.critChance` / `delta.cdr`, `effectiveDelta.*`, `pipelineForHero.pointDelta.*` —
 *   13 heroes × 6, the per-point rates themselves (were `0.02 × roll` and `0.1 × roll`, now the
 *   flat `0.024394` and `0.03513`).
 * - `ranking.gainPct` (48) — the crit-chance and CDR rows of every hero's ranking.
 * - `effective.critChance` (18) and the `critChance` ledger totals/steps (17 + 27) — the sheet
 *   value itself, now `birth + Σ` rather than `birth × (1 + Σ)`.
 * - `critFactor` → `activeDps` → `sustainedDps` → `derive.dps` / `pipelineForHero.dps` /
 *   `resetAdvice.*` (9 each) — the whole damage chain hanging off crit chance.
 * - `computeCombatMults.teamCritPctOfBase` → `teamCritChanceFlat` (13 + 13) — a key RENAME, not
 *   a value change; the old key disappears and the new one appears on the same 13 heroes.
 *
 * A second, smaller pass followed once the crit-chance LEDGER became flat too: 20 further
 * entries, all inside `critChance.steps` — 7 `amount`, 6 `running`, 3 `source` (the gear step is
 * a plain add now, so the tree step that used to carry `pctOfBase` provenance no longer does),
 * and the `meta.scalarCount` that counts them.
 *
 * NOT moved, and the proof this was a crit-chance/CDR change and nothing else: every
 * `inferSpentPoints.*` value on all 13 heroes (the recovered point vectors are unchanged on the
 * pre-patch corpus this file records over), and every sheet key other than `critChance`/`cdr`.
 *
 * ---
 * RE-RECORDED (1) at the flat-crit-damage fix (`POINT_GAIN.critDmgFlat`). Exactly 85 of the
 * ~2500+ recorded scalars moved, and every one of them was downstream of crit damage:
 *
 * - `derive.delta.critDmg` / `derive.effectiveDelta.critDmg` / `pipelineForHero.pointDelta.critDmg`
 *   — 13 heroes x 3, the per-point rate itself (was `0.08 x roll`, now a flat `5`).
 * - `pipelineForHero.ranking.2.gainPct` — 13 heroes, the crit-damage row of the ranking.
 * - Bellatrix (id 20402) alone on everything else: she is the only corpus hero holding
 *   crit-damage points, so only her SHEET moved, and with it `applySkillTree.critDmg`,
 *   `composeSheetFromBirth.critDmg`, `adjusted`/`effective.critDmg`, her `critDmg` ledger
 *   totals, `critFactor`, `criticalHit`, `activeDps`/`sustainedDps`, `derive`/`pipelineForHero`
 *   dps, `resetAdvice` and her scorer entry.
 *
 * NOT moved, and the proof this was a crit-damage change and nothing else: every
 * `inferSpentPoints.*` value on all 13 heroes (the recovered point vectors are unchanged), and
 * every non-`critDmg` sheet key on every hero and every subject. The MKR-14 `formulaDmg`
 * entries below were deliberately held at their PRE-deletion values through the re-record, so
 * `PERMITTED_DELTAS` stays a live exception rather than becoming a silently-satisfied no-op.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import {
  CORPUS_FILES,
  decodeNumber,
  encodeNumber,
  recordInvarianceSurface,
  serializeRecord,
  type InvarianceRecord,
} from './helpers/invariance-record';

const BASELINE_PATH = join(__dirname, 'fixtures', 'invariance', 'baseline.json');

/**
 * `formulaDmg`'s `substituted` string is the SOLE enumerated non-numeric delta (MKR-14). It is
 * pinned as an exact string TRANSFORM of the pre-deletion value — dropping the deleted third
 * factor's ` × 1.000` term (formatted to 3 decimals; the corpus never carried that factor's
 * source data, so it was always exactly `1`) while the `= <value>` tail stays byte-identical —
 * never a bare "this key may differ" flag. Any OTHER differing entry, or a differing entry that
 * does not match this exact transform, fails the walk below.
 */
const PERMITTED_DELTAS: {
  reason: string;
  matchPath: (path: string) => boolean;
  expectedPost: (pre: string) => string;
}[] = [
  {
    reason: 'MKR-14 — formulaDmg drops its × 1.000 third factor once the multiplier is deleted',
    matchPath: (path) => path.endsWith('.buildStatBreakdown.derived.dmg.substituted'),
    expectedPost: (pre) => pre.replace(' × 1.000 =', ' ='),
  },
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Recursive structural walk reporting the FIRST differing path (hero + function + stat), not a
 * 200 KB diff. Leaves are compared via `Object.is` after decoding numeric-string leaves back to
 * numbers; non-numeric leaves (source/op/note/stat/regime/…) compare with `===`. A path matching
 * a `PERMITTED_DELTAS` entry is allowed to differ ONLY if it equals that entry's exact computed
 * post-value — anything else, including a differing value that isn't the pinned transform,
 * fails.
 */
function firstDivergingPath(
  actual: unknown,
  expected: unknown,
  path: string,
): { path: string; actual: unknown; expected: unknown } | null {
  if (isPlainObject(actual) && isPlainObject(expected)) {
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const key of [...keys].sort()) {
      const next = firstDivergingPath(actual[key], expected[key], path ? `${path}.${key}` : key);
      if (next) return next;
    }
    return null;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return { path: `${path}.length`, actual: actual.length, expected: expected.length };
    }
    for (let i = 0; i < actual.length; i++) {
      const next = firstDivergingPath(actual[i], expected[i], `${path}[${i}]`);
      if (next) return next;
    }
    return null;
  }
  if (actual === expected) return null;

  const permitted = PERMITTED_DELTAS.find((d) => d.matchPath(path));
  if (permitted && typeof actual === 'string' && typeof expected === 'string') {
    if (actual === permitted.expectedPost(expected)) return null;
  }

  // Numeric-string leaves round-trip through decodeNumber; compare with Object.is so -0/+0 and
  // NaN are never silently treated as equal (MKR-18).
  if (typeof actual === 'string' && typeof expected === 'string') {
    const da = decodeNumber(actual);
    const de = decodeNumber(expected);
    if (!Number.isNaN(da) || actual === 'NaN') {
      if (Object.is(da, de)) return null;
    }
  }

  return { path, actual, expected };
}

describe('invariance baseline — the pre-deletion characterization harness (MP5 F2 T2)', () => {
  it('self-test: encodeNumber round-trips exactly for every finite double, and the four special cases', () => {
    const samples = [0, -0, 1, -1, 0.1, 1e21, -1e21, 1.008, 4 / 3, Number.MIN_VALUE, Number.MAX_VALUE, NaN, Infinity, -Infinity];
    for (const v of samples) {
      const encoded = encodeNumber(v);
      const decoded = decodeNumber(encoded);
      if (Number.isNaN(v)) {
        expect(Number.isNaN(decoded), `NaN round-trip: encoded "${encoded}"`).toBe(true);
      } else {
        expect(Object.is(decoded, v), `${v} round-tripped to ${decoded} via "${encoded}"`).toBe(true);
      }
    }
  });

  it('encodeNumber distinguishes -0 from +0 — the AC-8/MKR-18 corner', () => {
    expect(encodeNumber(-0)).toBe('-0');
    expect(encodeNumber(0)).toBe('0');
    expect(encodeNumber(-0)).not.toBe(encodeNumber(0));
  });

  it('byte-reproducibility: two recordings in this session serialise identically (MKR-11)', () => {
    const first = serializeRecord(recordInvarianceSurface());
    const second = serializeRecord(recordInvarianceSurface());
    expect(second).toBe(first);
  });

  const record = recordInvarianceSurface();

  it("non-vacuity: exactly 13 heroes are recorded (5 + 8, F1's two corpus files)", () => {
    expect(record.meta.heroCount, `recorded heroes: ${Object.keys(record.heroes).join(', ')}`).toBe(13);
    expect(Object.keys(record.heroes).length).toBe(13);
  });

  it('non-vacuity: every SHEET_KEYS member is present for every hero, on every SheetKey-shaped subject', () => {
    for (const [heroKey, entry] of Object.entries(record.heroes)) {
      for (const subject of ['naked', 'applySkillTree', 'composeSheetFromBirth', 'inferSpentPoints'] as const) {
        const keys = Object.keys(entry[subject]).sort();
        expect(keys, `${heroKey}.${subject}`).toEqual([...SHEET_KEYS].sort());
      }
      expect(Object.keys(entry.sheetsFromBirth.naked).sort(), `${heroKey}.sheetsFromBirth.naked`).toEqual([...SHEET_KEYS].sort());
      expect(Object.keys(entry.sheetsFromBirth.geared).sort(), `${heroKey}.sheetsFromBirth.geared`).toEqual([...SHEET_KEYS].sort());
      expect(Object.keys(entry.peelSheetStages).sort(), `${heroKey}.peelSheetStages`).toEqual([...SHEET_KEYS].sort());
      expect(Object.keys(entry.peelSheetSources).sort(), `${heroKey}.peelSheetSources`).toEqual([...SHEET_KEYS].sort());
    }
  });

  it('non-vacuity: the recorded scalar count meets a committed floor (a zero-hero loop must fail, not pass)', () => {
    // Measured floor: 13 heroes × (8 sheet keys × ~6 sheet-shaped subjects + 9 peelSheetStages
    // fields × 8 + 4 peelSheetSources fields × 8 + combat/farm/derive/pipeline scalars +
    // breakdown ledger/formula scalars) + the 2-file scorer block. Comfortably below the
    // measured actual so a partially-empty recorder still fails this floor.
    expect(record.meta.scalarCount, `scanned corpus: ${CORPUS_FILES.join(', ')}`).toBeGreaterThanOrEqual(2500);
  });

  it('non-vacuity: both corpus files contributed a scorer record', () => {
    for (const file of CORPUS_FILES) {
      expect(record.scorer[file], `scorer record for ${file}`).toBeDefined();
      expect(Object.keys(record.scorer[file]!.perHero).length, `${file} perHero`).toBeGreaterThan(0);
    }
  });

  it('committed baseline file exists', () => {
    expect(() => readFileSync(BASELINE_PATH, 'utf8')).not.toThrow();
  });

  it('post-deletion output is bit-identical to the committed pre-deletion baseline (MKR-12), with formulaDmg.substituted as the sole enumerated exception (MKR-14)', () => {
    const expectedJson = readFileSync(BASELINE_PATH, 'utf8');
    const actualJson = serializeRecord(record);

    if (actualJson === expectedJson) {
      // Bit-identical — the common case pre-deletion and after every arm that touches no
      // surviving value.
      expect(actualJson).toBe(expectedJson);
      return;
    }

    // Not byte-identical: walk both trees and name the first path that differs beyond the one
    // permitted delta. If the walk finds nothing beyond PERMITTED_DELTAS, the two are
    // "equal modulo the pinned exception" and the suite passes; otherwise it fails naming the
    // exact hero/function/stat.
    const expected = JSON.parse(expectedJson) as InvarianceRecord;
    const diverge = firstDivergingPath(record, expected, '');
    expect(
      diverge,
      diverge
        ? `first unexplained divergence at "${diverge.path}": actual=${JSON.stringify(diverge.actual)} expected=${JSON.stringify(diverge.expected)}`
        : undefined,
    ).toBeNull();
  });
});
