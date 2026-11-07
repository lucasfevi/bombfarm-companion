import { dataIssuesOf, isHeroBlockingIssue } from '@bombfarm/domain/data-issues';
import type { AccountPayload, DataIssue } from '@bombfarm/contracts';
import { capturedAtOf } from './account-facts';

export type DataNotice =
  | { readonly kind: 'skillTreeStale'; readonly capturedAt: string | null }
  | { readonly kind: 'skillTreeWithheld' }
  | { readonly kind: 'gearOwnerUnknown' }
  | { readonly kind: 'gearFieldsAbsent' }
  | { readonly kind: 'heroesAndItemsNotReading'; readonly capturedAt: string | null };

/** Longer than a failed cycle or two, so a dropped read in a running session raises no banner. Right
 *  after a relaunch the saved pair is already this old, so one dropped read shows it until the next
 *  good cycle. */
const NOT_READING_AFTER_MS = 5 * 60_000;

/** Heroes and items are read as a pair, so one failing route freezes both. Judged against the
 *  `account` read, never the wall clock: a closed game leaves every section equally old, and that
 *  is not a failure worth telling anyone about. */
function heroesAndItemsNotReading(payload: AccountPayload): DataNotice | null {
  const fidelity = payload.fidelity;
  if (fidelity === undefined) return null;
  const account = fidelity.account;
  if (account.status !== 'resolved' && account.status !== 'degraded') return null;

  const pair = [fidelity.heroes, fidelity.items];
  if (pair.some((section) => section.status === 'missing')) {
    return { kind: 'heroesAndItemsNotReading', capturedAt: null };
  }
  const accountMs = Date.parse(account.capturedAt);
  const staleAges = pair.flatMap((section) =>
    section.status === 'stale' && accountMs - Date.parse(section.capturedAt) > NOT_READING_AFTER_MS
      ? [section.capturedAt]
      : [],
  );
  return staleAges.length === 0 ? null : { kind: 'heroesAndItemsNotReading', capturedAt: staleAges[0] ?? null };
}

function noticeOf(issue: DataIssue, payload: AccountPayload): DataNotice | null {
  switch (issue.kind) {
    case 'skill_tree_stale':
      return { kind: 'skillTreeStale', capturedAt: capturedAtOf(payload, 'skills') };
    case 'skill_tree_withheld':
      return { kind: 'skillTreeWithheld' };
    case 'gear_owner_unknown':
      return { kind: 'gearOwnerUnknown' };
    case 'gear_field_absent':
      return isHeroBlockingIssue(issue) ? null : { kind: 'gearFieldsAbsent' };
    default:
      return null;
  }
}

/** One entry per kind of problem the player is told about at the top of the window. Whatever
 *  leaves a hero out of calculations is told on the hero instead. */
export function dataNoticesOf(payload: AccountPayload): DataNotice[] {
  const notices = new Map<DataNotice['kind'], DataNotice>();
  for (const issue of dataIssuesOf(payload)) {
    const notice = noticeOf(issue, payload);
    if (notice !== null && !notices.has(notice.kind)) notices.set(notice.kind, notice);
  }
  const notReading = heroesAndItemsNotReading(payload);
  if (notReading !== null) notices.set(notReading.kind, notReading);
  return [...notices.values()];
}

export type HeroDataReason = {
  readonly heroFields: readonly string[];
  readonly gearFields: readonly string[];
};

const FIELD_ROOTS = ['birth_stats', 'stat_points_available', 'level', 'stars', 'stats', 'rarity', 'upgrade'] as const;

/** `birth_stats.luck` and `birth_stats` are one thing to the player. */
function fieldRootOf(key: string): string {
  return FIELD_ROOTS.find((root) => key === root || key.startsWith(`${root}.`)) ?? key;
}

/** Why each hero is left out of calculations, by the game's hero id. */
export function heroDataReasonsOf(payload: AccountPayload): ReadonlyMap<string, HeroDataReason> {
  const reasons = new Map<string, { heroFields: Set<string>; gearFields: Set<string> }>();
  for (const issue of dataIssuesOf(payload)) {
    if (!isHeroBlockingIssue(issue)) continue;
    const reason = reasons.get(issue.heroId) ?? { heroFields: new Set<string>(), gearFields: new Set<string>() };
    const target = issue.kind === 'hero_field_absent' ? reason.heroFields : reason.gearFields;
    for (const key of issue.keys) target.add(fieldRootOf(key));
    reasons.set(issue.heroId, reason);
  }
  return new Map(
    [...reasons].map(([heroId, reason]) => [
      heroId,
      { heroFields: [...reason.heroFields], gearFields: [...reason.gearFields] },
    ]),
  );
}
