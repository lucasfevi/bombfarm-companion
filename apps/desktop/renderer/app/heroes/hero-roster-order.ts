/**
 * The order the Heroes screen lists a roster in, and the roll-quality reading each row prints.
 *
 * `rollQualityFor` is run ONCE per hero here and the report is carried on the row, so the list and
 * the detail panel beside it read the same number rather than each deriving its own.
 */
import { compareRollQuality, rollQualityFor, type RollQualityReport } from '@bombfarm/domain/roll-quality';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { formatNumber, type Lang } from '@bombfarm/ui';

/** What a row prints when the domain could place nothing. Never a zero, which would read as the
 *  worst possible roll rather than as an absence of evidence. */
const NOT_PLACED = '—';

export type RosterHeroRow = {
  readonly id: string;
  readonly hero: HeroRecord;
  /** `undefined` when the domain could place no statistic at all — never a zero, which would read
   *  as the worst possible roll about a hero nothing is known of. */
  readonly report: RollQualityReport | undefined;
};

function rowOf(hero: HeroRecord): RosterHeroRow {
  return { id: hero.id, hero, report: rollQualityFor(hero) };
}

/**
 * Best roll first, heroes the domain could not place last, ties broken by hero id.
 *
 * The tie-break is the point. Roll quality is a mean over a handful of banded percentiles, so
 * whole grades of heroes land on exactly the same number, and a comparator returning 0 for them
 * would leave their relative order to whatever order the roster arrived in — which changes on
 * every account read. `compareRollQuality` is a TOTAL order, so the same roster always lists in
 * the same order however the sort itself is implemented.
 */
export function orderByRollQuality(heroes: readonly HeroRecord[]): readonly RosterHeroRow[] {
  return heroes
    .map(rowOf)
    .sort((left, right) =>
      compareRollQuality(
        { id: left.id, ...(left.report === undefined ? {} : { rollQuality: left.report.mean }) },
        { id: right.id, ...(right.report === undefined ? {} : { rollQuality: right.report.mean }) },
      ),
    );
}

/** The roll-quality reading a list row prints — the same mean the detail panel places on its rail,
 *  to one decimal, and the not-placed dash where the domain reported nothing. */
export function rollQualityText(row: RosterHeroRow, lang: Lang): string {
  return row.report === undefined ? NOT_PLACED : formatNumber(row.report.mean, lang, 1);
}
