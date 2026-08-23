'use client';

import { HeroAvatar, rarityTextClass, rosterInactiveChromeClass } from '@/shared/game-art';
import { cn, DataTable } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { RosterDpsRow } from '@bombfarm/domain/roster-dps';
import type { HeroRecord } from '@/shared/lib/storage';
import { formatClearTime } from '../model/phases-page';
import { MAX_STARS } from '@bombfarm/domain/gear';

type Props = {
  rows: RosterDpsRow[];
  heroesById: Map<string, HeroRecord>;
  activeHeroId: string | null;
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
  onSelectHero: (hero: HeroRecord) => void;
};

/**
 * Top-N DPS roster — switch-hero row chrome in a half-width phases cell (rarity on the name).
 *
 * Carries the per-hero combat numbers for the selected phase rather than gear, abilities and
 * power: those three are the roster page's subject and say nothing about how a build performs
 * against THIS phase's mitigation, which is the only question this panel exists to answer.
 */
export function PhasesTop9Table({
  rows,
  heroesById,
  activeHeroId,
  t,
  formatNumber,
  onSelectHero,
}: Props) {
  return (
    <DataTable.Root
      scrollable
      maxRows={10}
      rowHeight="3.5rem"
      className="mt-3 rounded-sm border border-line"
    >
      <DataTable.Table>
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header className="w-8">#</DataTable.Header>
            <DataTable.Header className="w-12 px-0" aria-label={t.heroAvatarCol}>
              <span className="sr-only">{t.heroAvatarCol}</span>
            </DataTable.Header>
            <DataTable.Header>{t.importColName}</DataTable.Header>
            <DataTable.Header>{t.importColLevel}</DataTable.Header>
            <DataTable.Header align="right">{t.phasesColNormalHit}</DataTable.Header>
            <DataTable.Header align="right">{t.phasesColCritHit}</DataTable.Header>
            <DataTable.Header align="right">{t.phasesColFieldTime}</DataTable.Header>
            <DataTable.Header align="right">{t.modeDps}</DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {rows.map((row, index) => {
            const hero = heroesById.get(row.heroId);
            if (!hero) return null;
            const selected = hero.id === activeHeroId;
            const rarIdx = RARITIES.indexOf(hero.rarity);
            const rarText = rarityTextClass(rarIdx) ?? 'text-muted';
            const starCount = Math.max(0, Math.min(MAX_STARS, Math.round(hero.stars ?? 0)));
            const battleAllowed = hero.battleAllowed ?? true;
            const inactiveChrome = !battleAllowed ? rosterInactiveChromeClass : undefined;
            return (
              <DataTable.Row
                key={hero.id}
                className={cn(
                  'cursor-pointer focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]',
                  selected
                    ? 'bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] shadow-[inset_3px_0_0_var(--accent)]'
                    : 'hover:bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]',
                  !battleAllowed && 'bg-[color-mix(in_oklch,var(--bg)_45%,transparent)]',
                )}
                tabIndex={0}
                aria-current={selected ? 'true' : undefined}
                aria-label={hero.name}
                onClick={() => onSelectHero(hero)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectHero(hero);
                  }
                }}
              >
                <DataTable.Cell className={cn('font-bold text-accent', inactiveChrome)} numeric>
                  {index + 1}
                </DataTable.Cell>
                <DataTable.Cell className="w-12 px-1" nowrap={false}>
                  <span className={inactiveChrome}>
                    <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarIdx} size="md" name={hero.name} />
                  </span>
                </DataTable.Cell>
                <DataTable.Cell className={inactiveChrome}>
                  <span className={cn('text-base leading-none font-bold', rarText)}>
                    {hero.name}
                    {starCount > 0 ? (
                      <span className="ml-1 text-[0.92em] tracking-tight text-rar-4" aria-hidden="true">
                        {'★'.repeat(starCount)}
                      </span>
                    ) : null}
                  </span>
                </DataTable.Cell>
                <DataTable.Cell numeric className={inactiveChrome}>
                  L{hero.level}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric className={inactiveChrome}>
                  {formatNumber(row.normalHit, 0)}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric className={cn('text-rar-4', inactiveChrome)}>
                  {formatNumber(row.critHit, 0)}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric className={inactiveChrome}>
                  {formatClearTime(row.fieldSecs)}
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric className={cn('font-semibold text-ink', inactiveChrome)}>
                  {formatNumber(row.dps, 0)}
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
