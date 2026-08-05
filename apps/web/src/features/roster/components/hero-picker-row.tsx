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

  return (
    <DataTable.Row
      className={cn(
        'cursor-pointer focus-visible:[outline:2px_solid_var(--accent)] focus-visible:[outline-offset:-2px]',
        selected
          ? 'bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] shadow-[inset_3px_0_0_var(--accent)]'
          : 'hover:bg-[color-mix(in_oklch,var(--accent)_6%,transparent)]',
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
      <DataTable.Cell className="max-[560px]:hidden font-bold text-accent">
        {hero.rank?.trim() || '—'}
      </DataTable.Cell>
      <DataTable.Cell className="w-11 px-1" nowrap={false}>
        <HeroAvatar
          skin={hero.skin ?? 0}
          rarityIdx={rarIdx}
          size="sm"
          name={hero.name}
        />
      </DataTable.Cell>
      <DataTable.Cell>
        <span className="font-semibold text-ink">
          {hero.name}
          {hero.stars > 0 ? (
            <span className="ml-1 text-rar-4" aria-hidden="true">
              {'★'.repeat(hero.stars)}
            </span>
          ) : null}
        </span>
      </DataTable.Cell>
      <DataTable.Cell className={`max-[560px]:hidden ${rarityTextClass(rarIdx) ?? 'text-muted'}`}>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`inline-block size-1.5 shrink-0 rounded-full ${rarityDotClass(rarIdx) ?? 'bg-muted'}`}
            aria-hidden="true"
          />
          {rarityLabel(hero.rarity, lang)}
        </span>
      </DataTable.Cell>
      <DataTable.Cell numeric>L{hero.level}</DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        {formatNumber(powerShown, 0)}
      </DataTable.Cell>
      <DataTable.Cell className="max-[720px]:hidden py-2" nowrap={false} data-roster-wrap>
        <HeroGearIcons loadout={hero.loadout} lang={lang} t={t} />
      </DataTable.Cell>
      <DataTable.Cell className="max-[960px]:hidden py-2" nowrap={false} data-roster-wrap>
        <HeroAbilityIcons abilities={hero.abilities} lang={lang} t={t} />
      </DataTable.Cell>
      <DataTable.Cell className="max-[720px]:hidden">
        {hero.sourceId ? (
          <HeroActiveToggle
            battleAllowed={hero.battleAllowed ?? true}
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
