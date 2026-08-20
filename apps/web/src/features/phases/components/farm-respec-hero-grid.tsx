'use client';

import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import type { Lang, Strings } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';
import { FarmRespecHeroCard } from './farm-respec-hero-card';

/**
 * Every enabled hero (`result.heroes`), no filter — an unchanged hero is never omitted. A
 * responsive `auto-fit`/`minmax` grid: cards wrap onto further rows, never an accordion, a tab
 * list or a horizontal scroller.
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
  return (
    <div
      data-testid="farm-respec-heroes"
      className="grid grid-cols-[repeat(auto-fit,minmax(21rem,1fr))] gap-2"
    >
      {result.heroes.map((entry) => (
        <FarmRespecHeroCard
          key={entry.heroId}
          entry={entry}
          hero={heroes.find((hero) => hero.id === entry.heroId)}
          lang={lang}
          t={t}
        />
      ))}
    </div>
  );
}
