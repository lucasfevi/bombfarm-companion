'use client';

import { memo } from 'react';
import type { HeroRecord } from '@/shared/lib/storage';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { Lang, Strings } from '@/shared/i18n';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import { cn, DataTable } from '@bombfarm/ui';
import { usePlannerStore } from '@/shared/stores';
import { HeroActiveToggle } from './hero-active-toggle';
import {
  HeroAvatar,
  HeroAbilityIcons,
  HeroGearIcons,
  rarityDotClass,
  rarityTextClass,
  rosterInactiveChromeClass,
} from '@/shared/game-art';

/**
 * RES-10 — memoised, mirroring its sibling `RosterRow` (deleted with the dead roster tree
 * in RES-01, which had carried this boundary since W5).
 *
 * Sorting the roster rebuilds `sortedHeroes` as a new array, but the individual `hero`
 * objects keep their identity and `selected`/`powerShown` are unchanged for most rows, so
 * a shallow prop compare skips them. React Compiler does not cover this: it caches values
 * and elements *within* a scope keyed on that scope's own reactive deps, so when
 * `HeroPickerTable`'s sort state changes its scope invalidates and every row element is
 * recreated regardless. Only a boundary at the child can stop the cascade.
 *
 * P-04 is the sole scenario whose render count scales with roster size (2.60x at 10x
 * heroes), which is why this boundary earns its place while the equivalent for gear/tab
 * scenarios would not.
 */
export const HeroPickerRow = memo(function HeroPickerRow({
  hero,
  selected,
  lang,
  t,
  formatNumber,
  powerShown,
  onPick,
}: {
  hero: HeroRecord;
  selected: boolean;
  lang: Lang;
  t: Strings;
  formatNumber: (n: number, d?: number) => string;
  powerShown: number;
  onPick: (hero: HeroRecord) => void;
}) {
  const setHeroBattleAllowedOnHero = usePlannerStore((state) => state.setHeroBattleAllowedOnHero);
  const rarIdx = RARITIES.indexOf(hero.rarity);
  const battleAllowed = hero.battleAllowed ?? true;
  const inactiveChrome = !battleAllowed ? rosterInactiveChromeClass : undefined;

  return (
    <DataTable.Row
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
      onClick={() => onPick(hero)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPick(hero);
        }
      }}
    >
      <DataTable.Cell className="w-14 px-1" nowrap={false}>
        <span className={inactiveChrome}>
          <HeroAvatar skin={hero.skin ?? 0} rarityIdx={rarIdx} size="lg" name={hero.name} />
        </span>
      </DataTable.Cell>
      <DataTable.Cell
        className={cn(
          'max-[560px]:hidden text-xl leading-none font-black tracking-tight',
          hero.rank?.trim() ? 'text-accent' : 'text-muted',
          inactiveChrome,
        )}
      >
        {hero.rank?.trim() || '—'}
      </DataTable.Cell>
      <DataTable.Cell className={inactiveChrome}>
        <span className={cn('text-base leading-none font-bold', battleAllowed ? 'text-ink' : 'text-muted')}>
          {hero.name}
          {hero.stars > 0 ? (
            <span className="ml-1 text-[0.92em] tracking-tight text-rar-4" aria-hidden="true">
              {'★'.repeat(hero.stars)}
            </span>
          ) : null}
        </span>
      </DataTable.Cell>
      <DataTable.Cell
        className={cn('max-[560px]:hidden', rarityTextClass(rarIdx) ?? 'text-muted', inactiveChrome)}
      >
        <span className="inline-flex items-center gap-1.5 text-sm leading-none font-bold">
          <span
            className={`inline-block size-1.5 shrink-0 rounded-full ${rarityDotClass(rarIdx) ?? 'bg-muted'}`}
            aria-hidden="true"
          />
          {rarityLabel(hero.rarity, lang)}
        </span>
      </DataTable.Cell>
      <DataTable.Cell numeric className={inactiveChrome}>
        L{hero.level}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric className={inactiveChrome}>
        {formatNumber(powerShown, 0)}
      </DataTable.Cell>
      <DataTable.Cell className={cn('max-[720px]:hidden py-2', inactiveChrome)} nowrap={false} data-roster-wrap>
        <HeroGearIcons loadout={hero.loadout} lang={lang} t={t} />
      </DataTable.Cell>
      <DataTable.Cell className={cn('max-[960px]:hidden py-2', inactiveChrome)} nowrap={false} data-roster-wrap>
        <HeroAbilityIcons abilities={hero.abilities} lang={lang} />
      </DataTable.Cell>
      <DataTable.Cell className="max-[720px]:hidden">
        {hero.sourceId ? (
          <HeroActiveToggle
            battleAllowed={battleAllowed}
            t={t}
            onCheckedChange={(checked) => setHeroBattleAllowedOnHero(hero.id, checked)}
          />
        ) : (
          <span className="text-muted">—</span>
        )}
      </DataTable.Cell>
    </DataTable.Row>
  );
});
