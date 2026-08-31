'use client';

import type { FarmRespecHeroEntry, FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { GoldValue } from '@/shared/game-art';
import type { HeroRecord } from '@/shared/lib/storage';
import { partitionHeroEntries } from '@bombfarm/farm/model/farm-respec-view';
import { formatGold } from '@bombfarm/farm/model/farm-respec-format';
import { FarmRespecHeroCard } from './farm-respec-hero-card';

/**
 * Every enabled hero, in two groups: the ones that need a respec, then the ones that do not.
 * No hero is ever omitted — `partitionHeroEntries` splits, it does not filter.
 *
 * The groups are separate grids so the second one starts on its own row rather than filling a
 * gap left in the first. Their tracks differ deliberately: an unchanged card is an identity chip
 * against a changed card's eight-row table, so a shared track sized for the table left it as a
 * mostly-empty full-height box. `items-start` stops the survivors stretching to their row.
 *
 * The unchanged group's note is stated ONCE above it, carrying the summed gold those builds save
 * — repeated per card it was the same sentence three or four times over, and the individual
 * amounts were a total the player had to add up themselves.
 */
export function FarmRespecHeroGrid({
  result,
  heroes,
  lang,
  t,
}: {
  result: FarmRespecResult;
  heroes: readonly HeroRecord[];
  lang: Lang;
  t: Strings;
}) {
  const groups = partitionHeroEntries(result);

  const card = (entry: FarmRespecHeroEntry) => (
    <FarmRespecHeroCard
      key={entry.heroId}
      entry={entry}
      hero={heroes.find((hero) => hero.id === entry.heroId)}
      lang={lang}
      t={t}
    />
  );

  return (
    <div data-testid="farm-respec-heroes" className="flex flex-col gap-2">
      {groups.changed.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(21rem,1fr))] items-start gap-2">
          {groups.changed.map(card)}
        </div>
      ) : null}
      {groups.unchanged.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-line/50 pt-2">
          <p className="m-0 text-[11px] text-muted">
            <GoldValue>
              {sub(t.farmRespecUnchangedGroupNote, {
                gold: formatGold(result.unchangedRespecCostGold, lang),
              })}
            </GoldValue>
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] items-start gap-2">
            {groups.unchanged.map(card)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
