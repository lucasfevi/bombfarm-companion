import type { ImportCandidate, ParseRejection } from '@bombfarm/domain/import-save';
import type { PointInferenceIssue } from '@bombfarm/domain/point-inference';
import { raritySortIdx, rankSortIdx } from '@bombfarm/domain/roster-sort';
import type { StatKey } from '@bombfarm/domain/model';
import type { HeroRecord } from '@/shared/lib/storage';
import { sub, type Strings } from '@/shared/i18n';

export const STAT_KEYS: StatKey[] = [
  'attack',
  'energy',
  'speed',
  'critChance',
  'critDmg',
  'penetration',
  'cdr',
];

export type ImportSortKey = 'level' | 'name' | 'rarity' | 'rank' | 'power' | 'gear';
export type ImportSortDir = 'asc' | 'desc';

function compareByKey(
  left: ImportCandidate,
  right: ImportCandidate,
  key: ImportSortKey,
): number {
  switch (key) {
    case 'level':
      return left.level - right.level;
    case 'name':
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    case 'rarity':
      return raritySortIdx(left.rarity) - raritySortIdx(right.rarity);
    case 'rank':
      return rankSortIdx(left.rank) - rankSortIdx(right.rank);
    case 'power':
      return left.power - right.power;
    case 'gear':
      return left.gearCount - right.gearCount;
    default:
      // Unreachable for `ImportSortKey`; mirrors the pre-refactor fallthrough
      // where an unmatched key left the comparison at 0 and fell to the tiebreak.
      return 0;
  }
}

export function compareCandidates(
  left: ImportCandidate,
  right: ImportCandidate,
  key: ImportSortKey,
  sortDirection: ImportSortDir,
): number {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const comparison = compareByKey(left, right, key);
  if (comparison !== 0) return comparison * direction;
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}

/**
 * `AC-32` — the review-before-confirm breakdown for `AD-BSP-26`'s ungated dialog. A **blocked**
 * candidate (`W5 AC-11`) is excluded from both `created` and `updated` — `importHeroes` never
 * writes it (`ImportCandidate.blocked`'s own doc) — and its `sourceId` still counts toward the
 * save's own set, so an existing hero with that `sourceId` is NOT counted as `removed` either
 * (`W5 AC-28`, `DEC-08`): a blocked candidate is neutral on all three counts.
 */
export type ImportSyncSummary = {
  created: number;
  updated: number;
  removed: number;
};

export function summarizeImportSync(
  candidates: ImportCandidate[],
  existing: HeroRecord[],
): ImportSyncSummary {
  let created = 0;
  let updated = 0;
  for (const candidate of candidates) {
    if (candidate.blocked) continue;
    if (candidate.matchedExistingId) updated += 1;
    else created += 1;
  }
  // The save's own sourceId set — every candidate, blocked or not (DEC-08: a blocked
  // candidate's sourceId still stays in importHeroes' keep set).
  const saveSourceIds = new Set(candidates.map((candidate) => candidate.sourceId));
  const removed = existing.filter(
    (hero) => !!hero.sourceId && !saveSourceIds.has(hero.sourceId),
  ).length;
  return { created, updated, removed };
}

/**
 * `BSP-04b` / `AC-35` — selects which cap-saturation copy branch a candidate's
 * `budgetMismatch` issue (if any) needs. Three branches over `saturatedStats`:
 * neither saturated → the plain shortfall; exactly one → names it as the likely
 * destination of the missing points; both → the split cannot be recovered.
 */
export type PointIssueCopyKey =
  | null
  | 'shortfall'
  | { key: 'oneSaturated'; stat: 'critChance' | 'cdr' }
  | 'bothSaturated';

export function pointIssueCopyKey(issues: PointInferenceIssue[]): PointIssueCopyKey {
  const mismatch = issues.find((issue) => issue.kind === 'budgetMismatch');
  if (!mismatch) return null;
  const { saturatedStats } = mismatch;
  if (saturatedStats.length >= 2) return 'bothSaturated';
  if (saturatedStats.length === 1) return { key: 'oneSaturated', stat: saturatedStats[0] };
  return 'shortfall';
}

/** Renders `pointIssueCopyKey`'s branch as EN/PT copy (`BSP-04b`, `AC-35`). */
export function pointIssueCopyText(strings: Strings, issues: PointInferenceIssue[]): string | null {
  const key = pointIssueCopyKey(issues);
  if (key === null) return null;
  if (key === 'shortfall') return strings.importPointShortfall;
  if (key === 'bothSaturated') return strings.importPointBothSaturated;
  return sub(strings.importPointOneSaturated, { stat: strings.statFull[key.stat] });
}

/**
 * `BSP-06`/`DEC-09`/`AC-36` — `parseSaveFile`'s structured whole-file `rejected` field,
 * rendered EN+PT in place of the removed `importResetWarning*` block.
 *
 * MP5 F4 (`MSG-14`): `unsupportedSaveShape` renders the generic, patch-durable string — the
 * other two branches are unchanged.
 */
export function rejectionText(strings: Strings, rejected: ParseRejection): string {
  if (rejected.reason === 'notASaveFile') return strings.importRejectedNotASaveFile;
  if (rejected.reason === 'unsupportedSaveShape') return strings.importRejectedUnsupportedShape;
  return sub(strings.importRejectedMissingBirthStats, { names: rejected.heroNames.join(', ') });
}
