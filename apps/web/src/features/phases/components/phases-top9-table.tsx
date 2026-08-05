'use client';

import {
  HeroAbilityIcons,
  HeroAvatar,
  HeroGearIcons,
  rarityTextClass,
  rosterInactiveChromeClass,
} from '@/shared/game-art';
import { cn, DataTable, Tooltip } from '@bombfarm/ui';
import type { Lang, Strings } from '@/shared/i18n';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { heroPowerIndex } from '@bombfarm/domain/power';
import type { RosterDpsRow } from '@bombfarm/domain/roster-dps';
import type { HeroRecord } from '@/shared/lib/storage';

type Props = {
  rows: RosterDpsRow[];
  heroesById: Map<string, HeroRecord>;
  activeHeroId: string | null;
  lang: Lang;
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
  onSelectHero: (hero: HeroRecord) => void;
};

/**
 * Top-9 DPS roster — switch-hero row chrome in a half-width phases cell
 * (rarity on the name; horizontal scroll when gear/abilities need room).
 */
export function PhasesTop9Table({
  rows,
  heroesById,
  activeHeroId,
  lang,
  t,
  formatNumber,
  onSelectHero,
}: Props) {
  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <DataTable.Root
        scrollable
        maxRows={10}
        rowHeight="4.5rem"
        className="mt-3 rounded-sm border border-line"
      >
        <DataTable.Table className="min-w-xl">
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header className="w-8">#</DataTable.Header>
              <DataTable.Header className="w-14 px-0" aria-label={t.heroAvatarCol}>
                <span className="sr-only">{t.heroAvatarCol}</span>
              </DataTable.Header>
              <DataTable.Header>{t.importColName}</DataTable.Header>
              <DataTable.Header>{t.importColLevel}</DataTable.Header>
              <DataTable.Header align="right">{t.importColPower}</DataTable.Header>
              <DataTable.Header className="min-w-100 max-[900px]:hidden">
                {t.rosterColGear}
              </DataTable.Header>
              <DataTable.Header className="min-w-44 max-[1100px]:hidden">
                {t.rosterColAbilities}
              </DataTable.Header>
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
              const powerShown = hero.power ?? heroPowerIndex(hero);
              const starCount = Math.max(0, Math.min(3, Math.round(hero.stars ?? 0)));
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
                  <DataTable.Cell className="w-14 px-1" nowrap={false}>
                    <span className={inactiveChrome}>
                      <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarIdx} size="lg" name={hero.name} />
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
                    {formatNumber(powerShown, 0)}
                  </DataTable.Cell>
                  <DataTable.Cell className={cn('max-[900px]:hidden py-2', inactiveChrome)} nowrap={false} data-roster-wrap>
                    <HeroGearIcons loadout={hero.loadout} lang={lang} t={t} />
                  </DataTable.Cell>
                  <DataTable.Cell className={cn('max-[1100px]:hidden py-2', inactiveChrome)} nowrap={false} data-roster-wrap>
                    <HeroAbilityIcons abilities={hero.abilities} lang={lang} />
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
    </Tooltip.Provider>
  );
}
