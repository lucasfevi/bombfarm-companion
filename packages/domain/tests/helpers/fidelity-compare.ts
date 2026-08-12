/**
 * MP2 F4 — the cross-source comparator (design §4.3). FID-01…04.
 *
 * Order is a requirement, not an implementation detail: rejection → roster membership →
 * per-hero sheet compare → account-level equality. A roster mismatch must never let a single
 * hero comparison start (`opts.onHeroCompared` proves it — FID-04's Independent Test).
 */
import type { AccountPayload } from '@bombfarm/contracts';
import type { AccountImportData, ImportCandidate, ParseResult } from '@bombfarm/domain/import-save';
import type { SheetStats } from '@bombfarm/domain/gear';
import { SHEET_ABS_TOL } from './sheet-math-fixtures';
import { SHEET_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { FidelityGateError } from './fidelity-gate-error';

const SHEET_BLOCKS = ['naked', 'gearedOverride', 'birth'] as const;
type SheetBlock = (typeof SHEET_BLOCKS)[number];

/** Non-sheet `record` fields compared for EXACT equality (design §4.3 rule 3, TD-4). */
const EXACT_RECORD_FIELDS = ['level', 'stars', 'rarity', 'pts', 'loadout', 'abilities', 'statPointsAvailable'] as const;

export interface CompareCounts {
  readonly heroesCompared: number;
  readonly statComparisons: number;
  readonly accountFieldsCompared: number;
  readonly itemsCompared: number;
}

export interface CompareOptions {
  /** Invoked once per hero, right before that hero's sheet comparisons start. */
  readonly onHeroCompared?: (sourceId: string) => void;
}

interface PathMismatch {
  readonly path: string;
  readonly a: unknown;
  readonly b: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Generic recursive exact-equality diff that reports the first differing path. Used for both
 * the non-sheet hero record fields and the account-level fields — both need path-naming
 * mismatches (T4's "each mutated in isolation and asserted to throw ... naming the path").
 */
function findMismatchPath(a: unknown, b: unknown, path: string): PathMismatch | null {
  if (a === b) return null;
  if (a == null || b == null) {
    return a === b ? null : { path, a, b };
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return { path, a, b };
    if (a.length !== b.length) return { path: `${path}.length`, a: a.length, b: b.length };
    for (let i = 0; i < a.length; i += 1) {
      const result = findMismatchPath(a[i], b[i], `${path}[${i}]`);
      if (result) return result;
    }
    return null;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const result = findMismatchPath(a[key], b[key], `${path}.${key}`);
      if (result) return result;
    }
    return null;
  }
  return { path, a, b };
}

function heroLabel(candidate: ImportCandidate): string {
  return `"${candidate.name}" (sourceId ${candidate.sourceId})`;
}

function throwHeroMismatch(candidate: ImportCandidate, detail: string, extra: string, details: Record<string, unknown>): never {
  throw new FidelityGateError(
    'heroStatMismatch',
    `Hero ${heroLabel(candidate)} ${detail}: ${extra}`,
    { hero: candidate.name, sourceId: candidate.sourceId, ...details },
  );
}

function compareRoster(
  live: readonly ImportCandidate[],
  exported: readonly ImportCandidate[],
): Map<string, ImportCandidate> {
  const liveById = new Map(live.map((c) => [c.sourceId, c]));
  const exportedById = new Map(exported.map((c) => [c.sourceId, c]));

  const liveOnly = [...liveById.values()].filter((c) => !exportedById.has(c.sourceId));
  const exportOnly = [...exportedById.values()].filter((c) => !liveById.has(c.sourceId));

  if (liveOnly.length > 0 || exportOnly.length > 0) {
    const describe = (c: ImportCandidate) => `${c.name} (${c.sourceId})`;
    throw new FidelityGateError(
      'rosterMismatch',
      `Roster mismatch — live-only: [${liveOnly.map(describe).join(', ')}], export-only: [${exportOnly
        .map(describe)
        .join(', ')}]. Recapture both sides — comparing the intersection is never the fix.`,
      {
        liveOnly: liveOnly.map((c) => ({ name: c.name, sourceId: c.sourceId })),
        exportOnly: exportOnly.map((c) => ({ name: c.name, sourceId: c.sourceId })),
      },
    );
  }

  return exportedById;
}

function requireSheet(candidate: ImportCandidate, block: SheetBlock): SheetStats {
  const sheet = candidate.record[block];
  if (!sheet) {
    throwHeroMismatch(candidate, `is missing its "${block}" sheet block`, 'expected a SheetStats object, got undefined', { block });
  }
  return sheet;
}

function compareHeroSheets(
  liveCandidate: ImportCandidate,
  exportCandidate: ImportCandidate,
): number {
  let statComparisons = 0;
  for (const block of SHEET_BLOCKS) {
    const liveSheet = requireSheet(liveCandidate, block);
    const exportSheet = requireSheet(exportCandidate, block);
    for (const key of SHEET_KEYS as readonly SheetKey[]) {
      statComparisons += 1;
      const liveValue = liveSheet[key];
      const exportValue = exportSheet[key];
      const delta = Math.abs(liveValue - exportValue);
      const tolerance = SHEET_ABS_TOL[key];
      if (delta > tolerance) {
        throwHeroMismatch(
          liveCandidate,
          `sheet block "${block}" stat "${key}"`,
          `live=${liveValue} export=${exportValue} delta=${delta} tolerance=${tolerance}`,
          { block, key, liveValue, exportValue, delta, tolerance },
        );
      }
    }
  }
  return statComparisons;
}

function compareHeroExactFields(liveCandidate: ImportCandidate, exportCandidate: ImportCandidate): void {
  for (const field of EXACT_RECORD_FIELDS) {
    const mismatch = findMismatchPath(liveCandidate.record[field], exportCandidate.record[field], field);
    if (mismatch) {
      throwHeroMismatch(
        liveCandidate,
        `field "${mismatch.path}"`,
        `live=${JSON.stringify(mismatch.a)} export=${JSON.stringify(mismatch.b)}`,
        { path: mismatch.path, liveValue: mismatch.a, exportValue: mismatch.b },
      );
    }
  }
}

function throwAccountMismatch(mismatch: PathMismatch): never {
  throw new FidelityGateError(
    'accountMismatch',
    `Account field "${mismatch.path}" mismatch: live=${JSON.stringify(mismatch.a)} export=${JSON.stringify(mismatch.b)}`,
    { path: mismatch.path, liveValue: mismatch.a, exportValue: mismatch.b },
  );
}

const ACCOUNT_IMPORT_FIELDS = ['tree', 'houseIdx', 'houseLevel', 'slots', 'phase'] as const satisfies readonly (keyof AccountImportData)[];

function compareAccountLevel(live: ParseResult, exported: ParseResult): number {
  let accountFieldsCompared = 0;

  for (const field of ACCOUNT_IMPORT_FIELDS) {
    accountFieldsCompared += 1;
    const mismatch = findMismatchPath(live.account[field], exported.account[field], `account.${field}`);
    if (mismatch) throwAccountMismatch(mismatch);
  }

  accountFieldsCompared += 1;
  const warningsMismatch = findMismatchPath(live.warnings, exported.warnings, 'warnings');
  if (warningsMismatch) throwAccountMismatch(warningsMismatch);

  accountFieldsCompared += 1;
  const lengthMismatch = findMismatchPath(live.inventory.length, exported.inventory.length, 'inventory.length');
  if (lengthMismatch) throwAccountMismatch(lengthMismatch);

  for (let i = 0; i < live.inventory.length; i += 1) {
    accountFieldsCompared += 1;
    const itemMismatch = findMismatchPath(live.inventory[i], exported.inventory[i], `inventory[${i}]`);
    if (itemMismatch) throwAccountMismatch(itemMismatch);
  }

  return accountFieldsCompared;
}

/**
 * A raw-payload sanity layer alongside `compareAccountResults`'s `ParseResult`-scoped equality.
 *
 * `parseAccountPayload` deliberately does not project every raw `account` field into
 * `AccountImportData` (only `phase` and `skills.totals`/`casa` feed it today) — so a hazard
 * that corrupts a raw field the planner does not yet read (the spec's own named example: "a
 * coerced string gold") would parse to byte-identical `ParseResult`s on both sides and pass
 * silently through `compareAccountResults` alone. This closes that gap without touching
 * `compareAccountResults`'s fixed `(ParseResult, ParseResult)` signature or any package `src`
 * file: it diffs the two RAW `AccountPayload.account` blocks directly. Called by
 * `runFidelityGate` alongside `compareAccountResults` (`fidelity-gate.ts`).
 */
export function compareRawAccountFields(live: AccountPayload, exported: AccountPayload): void {
  const mismatch = findMismatchPath(live.account, exported.account, 'account');
  if (mismatch) throwAccountMismatch(mismatch);
}

/**
 * The hero-level counterpart to {@link compareRawAccountFields}: `parseAccountPayload` also
 * never projects some raw per-hero fields into `ImportCandidate.record` — `stat_ranges` is the
 * spec's own named example (a dropped bound would parse to a byte-identical `ParseResult` and
 * pass silently). Diffs each shared hero's whole raw JSON object structurally. Only ever called
 * (by `runFidelityGate`) after `compareAccountResults` has already confirmed the roster
 * matches, so a symmetric-difference roster never reaches here — this function does not
 * re-derive `rosterMismatch` itself.
 */
export function compareRawHeroFields(live: AccountPayload, exported: AccountPayload): void {
  const liveHeroes = Array.isArray(live.heroes) ? live.heroes : [];
  const exportHeroes = Array.isArray(exported.heroes) ? exported.heroes : [];
  const exportById = new Map<string, Record<string, unknown>>();
  for (const hero of exportHeroes) {
    if (isPlainObject(hero) && typeof hero.id === 'string') exportById.set(hero.id, hero);
  }
  for (const liveHero of liveHeroes) {
    if (!isPlainObject(liveHero) || typeof liveHero.id !== 'string') continue;
    const exportHero = exportById.get(liveHero.id);
    if (exportHero === undefined) continue; // roster mismatch is compareAccountResults's job, already run
    const mismatch = findMismatchPath(liveHero, exportHero, `heroes[id=${liveHero.id}]`);
    if (mismatch) {
      const name = typeof liveHero.name === 'string' ? liveHero.name : liveHero.id;
      throw new FidelityGateError(
        'heroStatMismatch',
        `Hero "${name}" (sourceId ${liveHero.id}) raw field "${mismatch.path}" mismatch: live=${JSON.stringify(mismatch.a)} export=${JSON.stringify(mismatch.b)}`,
        { hero: name, sourceId: liveHero.id, path: mismatch.path, liveValue: mismatch.a, exportValue: mismatch.b },
      );
    }
  }
}

/**
 * Compares a live-sourced `ParseResult` against an export-sourced `ParseResult` of the same
 * account. Throws `FidelityGateError` on the first disagreement; returns the executed-work
 * counts on success (design §4.3 step 5).
 */
export function compareAccountResults(live: ParseResult, exported: ParseResult, opts: CompareOptions = {}): CompareCounts {
  if (live.rejected) {
    throw new FidelityGateError(
      'parseRejected',
      `live parse was rejected (${live.rejected.reason}): ${live.rejected.heroNames.join(', ') || '(no heroes named)'}`,
      { side: 'live', reason: live.rejected.reason, heroNames: live.rejected.heroNames },
    );
  }
  if (exported.rejected) {
    throw new FidelityGateError(
      'parseRejected',
      `export parse was rejected (${exported.rejected.reason}): ${exported.rejected.heroNames.join(', ') || '(no heroes named)'}`,
      { side: 'export', reason: exported.rejected.reason, heroNames: exported.rejected.heroNames },
    );
  }

  const exportedById = compareRoster(live.candidates, exported.candidates);

  let heroesCompared = 0;
  let statComparisons = 0;
  for (const liveCandidate of live.candidates) {
    // compareRoster already guarantees this exists — the symmetric difference was empty.
    const exportCandidate = exportedById.get(liveCandidate.sourceId) as ImportCandidate;
    opts.onHeroCompared?.(liveCandidate.sourceId);
    heroesCompared += 1;
    statComparisons += compareHeroSheets(liveCandidate, exportCandidate);
    compareHeroExactFields(liveCandidate, exportCandidate);
  }

  const accountFieldsCompared = compareAccountLevel(live, exported);

  return {
    heroesCompared,
    statComparisons,
    accountFieldsCompared,
    itemsCompared: live.inventory.length,
  };
}
