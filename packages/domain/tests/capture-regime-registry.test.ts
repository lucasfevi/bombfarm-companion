/**
 * The registry's own guard (issue #137). `helpers/capture-regime.ts` only makes capture
 * admissibility mechanical if the registry it answers from is COMPLETE and HONEST — a capture
 * with no row, a row naming a deleted file, a `capturedOn` disagreeing with the filename, or a
 * waiver whose stated precondition is not true would each turn a mechanical answer back into a
 * guess. Every one of those is a failure here.
 *
 * WHAT COUNTS AS A CAPTURE, mechanically: a committed fixture JSON carrying a `heroes` array —
 * the record of a real account, whatever directory it sits in and whatever it is named. Measured
 * against the tree today that is exactly the 15 registry rows, and it needs no second
 * hand-maintained list to stay that way. `rejection/` is excluded by name for the reason
 * `points-within-level-budget.test.ts` already excludes it: those two files exist to be REJECTED
 * by `parseSaveFile`, so they are inputs to a rejection proof rather than records of an account.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ABILITIES_RESTATED_2026_08_23,
  ALL_MECHANICS,
  CAPTURE_REGISTRY,
  MECHANICS,
  REGIME_BOUNDARIES,
  captureDateOf,
  capturesOutOfRegimeFor,
  isInRegimeFor,
} from './helpers/capture-regime';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, 'fixtures');

const NOT_ACCOUNT_RECORDS = ['rejection'];

function listCapturePaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!NOT_ACCOUNT_RECORDS.includes(entry.name)) walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        const parsed: unknown = JSON.parse(readFileSync(full, 'utf8'));
        const heroes = (parsed as { heroes?: unknown })?.heroes;
        if (Array.isArray(heroes)) found.push(relative(FIXTURES_DIR, full).replace(/\\/g, '/'));
      }
    }
  };
  walk(FIXTURES_DIR);
  return found.sort();
}

const CAPTURE_PATHS = listCapturePaths();

/**
 * The corpus bound (issue #137's retention rule, stated as a number). A capture that leaves its
 * regime does not have to leave the tree — the structural suites still read it — but the corpus
 * must not grow one stale capture per patch forever. Retiring one is a deliberate, reviewed edit
 * because adding one without deleting one fails HERE, not in review.
 */
const MAX_STRUCTURAL_CAPTURES = 9;

describe('capture registry — complete, in both directions', () => {
  it('non-vacuity: the fixture walk finds account captures', () => {
    expect(CAPTURE_PATHS.length, `walked ${FIXTURES_DIR} for JSON carrying a heroes array`).toBeGreaterThan(5);
  });

  it('every committed capture has a registry row, and every row names a capture that exists', () => {
    expect(
      CAPTURE_PATHS,
      'a capture with no CAPTURE_REGISTRY row cannot be regime-checked; a row naming a deleted ' +
        'file is a retention decision nobody recorded',
    ).toEqual(Object.keys(CAPTURE_REGISTRY).sort());
  });

  it("every row's capturedOn matches the date its filename carries, where it carries one", () => {
    const mismatches: string[] = [];
    for (const [path, row] of Object.entries(CAPTURE_REGISTRY)) {
      let fromName: string;
      try {
        fromName = captureDateOf(path);
      } catch {
        // fidelity-gate/ and api/ do not follow the save-/payload-YYYYMMDD- convention; their
        // rows are the only machine-readable date they have, which is why capturedOn is a field
        // rather than something derived.
        continue;
      }
      if (fromName !== row.capturedOn) mismatches.push(`${path}: filename says ${fromName}, row says ${row.capturedOn}`);
    }
    expect(mismatches, `capturedOn disagreeing with the filename:\n${mismatches.join('\n')}`).toEqual([]);
    // Guards the guard: the loop above would pass vacuously if the `continue` swallowed every
    // path. Most of the corpus does carry the convention, and this is what says so.
    const named = Object.keys(CAPTURE_REGISTRY).filter((p) => /(?:save|payload)-\d{8}-/.test(p));
    expect(named.length).toBeGreaterThanOrEqual(9);
  });
});

describe('capture registry — the declared regime agrees with the dates', () => {
  it('every mechanic points at a boundary REGIME_BOUNDARIES knows about', () => {
    const known = Object.keys(REGIME_BOUNDARIES);
    for (const mechanic of ALL_MECHANICS) {
      expect(known, `MECHANICS.${mechanic}.since`).toContain(MECHANICS[mechanic].since);
    }
  });

  it("`sheet` is the strictest mechanic — anything derived from a whole sheet folds in all the others", () => {
    for (const mechanic of ALL_MECHANICS) {
      expect(MECHANICS.sheet.since >= MECHANICS[mechanic].since, `sheet vs ${mechanic}`).toBe(true);
    }
  });

  it('retention is derived, not asserted: `value` iff the capture is in regime for at least one mechanic', () => {
    const wrong: string[] = [];
    for (const [path, row] of Object.entries(CAPTURE_REGISTRY)) {
      const admissible = ALL_MECHANICS.filter((m) => isInRegimeFor(path, m));
      const derived = admissible.length > 0 ? 'value' : 'structural';
      if (derived !== row.retention) {
        wrong.push(`${path}: declared ${row.retention}, dates say ${derived} (admissible for: ${admissible.join(', ') || 'nothing'})`);
      }
    }
    expect(wrong, `retention disagreeing with the dates:\n${wrong.join('\n')}`).toEqual([]);
  });

  it('both retentions are populated — the split is real, not a field everything shares', () => {
    const values = Object.values(CAPTURE_REGISTRY).map((r) => r.retention);
    expect(values.filter((r) => r === 'value').length).toBeGreaterThan(0);
    expect(values.filter((r) => r === 'structural').length).toBeGreaterThan(0);
  });

  it(`the corpus holds at most ${MAX_STRUCTURAL_CAPTURES} out-of-regime captures (the retention bound)`, () => {
    const structural = Object.entries(CAPTURE_REGISTRY)
      .filter(([, row]) => row.retention === 'structural')
      .map(([path]) => path);
    expect(
      structural.length,
      `out-of-regime captures retained: ${structural.join(', ')} — a capture that has left its ` +
        'regime is kept only while a structural suite still reads it. Retire one before adding ' +
        'another, or raise this bound deliberately and say why in docs/fixture-corpus.md',
    ).toBeLessThanOrEqual(MAX_STRUCTURAL_CAPTURES);
  });

  it('every row carries a non-empty note saying what the capture is retained for', () => {
    const empty = Object.entries(CAPTURE_REGISTRY)
      .filter(([, row]) => row.note.trim().length === 0)
      .map(([path]) => path);
    expect(empty, 'registry rows with no note').toEqual([]);
  });
});

/**
 * A waiver says a capture predating a boundary is nonetheless untouched by it. That is a claim
 * about the capture's CONTENT, so it is checked against the content rather than believed: the
 * 2026-08-23 patch restated two named abilities, and a roster owning neither of them cannot have
 * moved when they did.
 */
describe('capture registry — every waiver is verified against the capture, not trusted', () => {
  const waived = Object.entries(CAPTURE_REGISTRY).filter(([, row]) => row.waivers !== undefined);

  it('non-vacuity: at least one capture carries a waiver', () => {
    expect(waived.length, 'no waivers to verify — delete this block if waivers are gone').toBeGreaterThan(0);
  });

  it.each(waived.map(([path]) => path))('%s owns none of the abilities the 2026-08-23 patch restated', (path) => {
    const row = CAPTURE_REGISTRY[path];
    const boundariesWaived = new Set(Object.keys(row.waivers ?? {}).map((m) => MECHANICS[m as keyof typeof MECHANICS].since));
    expect(
      [...boundariesWaived],
      'this block only knows how to verify the 2026-08-23 restatement; a waiver against another ' +
        'boundary needs its own precondition check here before it may be trusted',
    ).toEqual(['2026-08-23']);

    const parsed: unknown = JSON.parse(readFileSync(join(FIXTURES_DIR, path), 'utf8'));
    const heroes = (parsed as { heroes: { name?: unknown; abilities?: { code?: unknown }[] }[] }).heroes;
    const owners: string[] = [];
    for (const hero of heroes) {
      for (const ability of hero.abilities ?? []) {
        if (ABILITIES_RESTATED_2026_08_23.includes(ability.code as (typeof ABILITIES_RESTATED_2026_08_23)[number])) {
          owners.push(`${String(hero.name)} owns ${String(ability.code)}`);
        }
      }
    }
    expect(
      owners,
      `${path} waives the 2026-08-23 boundary on the grounds that no hero owns a restated ` +
        `ability, and these do:\n${owners.join('\n')}`,
    ).toEqual([]);
  });
});

describe('capture registry — the derived exclusion lists', () => {
  it('capturesOutOfRegimeFor("sheet") is every capture but the four that reach 2026-08-23', () => {
    expect(capturesOutOfRegimeFor('sheet')).toEqual([
      'api/assembled-payload-after.json',
      'api/assembled-payload-before.json',
      'api/assembled-payload-drift.json',
      'api/assembled-payload-partial.json',
      'farm-rate/save-20260815-486-7heroes.json',
      'fidelity-gate/export-capture.json',
      'fidelity-gate/live-capture.json',
      'sheet-math/payload-20260812-8heroes.json',
      'sheet-math/save-20260813-5heroes.json',
      'sheet-math/save-20260818-12heroes.json',
      'sheet-math/save-20260819-respec-crit-cdr.json',
      'sheet-math/save-20260822-15heroes-tree-crit-dmg.json',
    ]);
  });

  it('a later boundary excludes more than an earlier one — cooldown (2026-08-18) admits what sheet (2026-08-23) refuses', () => {
    const sheet = new Set(capturesOutOfRegimeFor('sheet'));
    const cooldown = capturesOutOfRegimeFor('cooldown');
    for (const path of cooldown) expect(sheet, `${path} refused for cooldown but admitted for sheet`).toContain(path);
    expect(cooldown.length).toBeLessThan(sheet.size);
  });

  it('an unregistered path is refused loudly rather than silently admitted', () => {
    expect(() => isInRegimeFor('sheet-math/save-20991231-not-a-capture.json', 'sheet')).toThrow(
      /has no CAPTURE_REGISTRY row/,
    );
  });
});
