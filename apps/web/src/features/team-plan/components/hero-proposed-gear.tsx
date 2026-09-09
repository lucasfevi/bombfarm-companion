'use client';

import { formatItemRosterTooltip } from '@bombfarm/domain/game-labels';
import { cn, Tooltip } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { ItemIcon, rosterIconTooltipTriggerClass } from '@/shared/game-art';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';
import {
  isKeptExistingGearFlowRow,
  type GearFlowRow,
} from '@/features/team-plan/model/gear-flow-rows';
import { HeroOriginTag } from './hero-origin-tag';

/**
 * One card per item that ends on this hero — including pieces already equipped that the plan
 * leaves alone. Unchanged keepers stay visible and say so explicitly.
 *
 * Removals get their own section rather than a card in the grid: a piece going back to the bag is
 * not part of what this hero ends up wearing, and reading it as one is exactly the confusion the
 * section exists to prevent.
 */
export type HeroGearFlow = {
  /** Items that END on this hero, keepers included. */
  rows: GearFlowRow[];
  /** Items the plan takes OFF this hero and hands back — no other hero takes them. */
  removed: GearFlowRow[];
  /** The plan's own regime, which decides which reason the removals are given. */
  crowdedField: boolean;
};

export function HeroProposedGear({
  t,
  lang,
  gear,
  heroByScopeKey,
  heroNameFallback,
}: {
  t: Strings;
  lang: Lang;
  gear: HeroGearFlow;
  heroByScopeKey: Map<string, HeroRecord>;
  heroNameFallback: (heroId: string) => string;
}) {
  const { rows: flowRows, removed: removedRows, crowdedField } = gear;
  if (flowRows.length === 0 && removedRows.length === 0) {
    return <p className="m-0 text-[12px] text-muted">{t.teamPlanHeroBreakdownGearEmpty}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {flowRows.length === 0 ? (
        <p className="m-0 text-[12px] text-muted">{t.teamPlanHeroBreakdownGearEmpty}</p>
      ) : null}
      {flowRows.length === 0 ? null : (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
      {flowRows.map((row) => {
        const equipped = {
          defId: row.defId,
          rarityIdx: row.rarityIdx,
          level: row.level,
          upgrade: row.forge ? row.forge.to : row.upgrade,
        };
        const tip = formatItemRosterTooltip(equipped, lang, t.rankLv);
        const moved = row.originHeroId !== row.destHeroId;
        const keptExisting = isKeptExistingGearFlowRow(row);

        return (
          <div
            key={row.itemId}
            className={cn(
              'flex flex-col items-center gap-1 rounded-sm border px-2 py-2.5 text-center',
              keptExisting
                ? 'border-dashed border-line bg-transparent'
                : 'border-solid border-line bg-bg',
            )}
          >
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                tabIndex={-1}
                aria-label={`${tip.title}. ${tip.subtitle}${keptExisting ? `. ${t.teamPlanFlowRowExisting}` : ''}`}
                className={cn(rosterIconTooltipTriggerClass, keptExisting && 'opacity-80')}
              >
                <ItemIcon item={equipped} size="lg" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p className="m-0 font-semibold text-ink">{tip.title}</p>
                    <p className="m-0 text-xs text-muted">{tip.subtitle}</p>
                    {keptExisting ? (
                      <p className="m-0 mt-1 text-xs text-muted">{t.teamPlanFlowRowExisting}</p>
                    ) : null}
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <div
              className={cn(
                'text-[12px] leading-tight font-bold',
                keptExisting ? 'text-muted' : 'text-ink',
              )}
            >
              {tip.title}
            </div>
            {keptExisting ? <div className={mutedClass}>{t.teamPlanFlowRowExisting}</div> : null}
            {moved ? (
              <div className={mutedClass}>
                {t.teamPlanFlowRowFromLabel}{' '}
                <HeroOriginTag
                  heroId={row.originHeroId}
                  heroByScopeKey={heroByScopeKey}
                  heroNameFallback={heroNameFallback}
                  inventoryLabel={t.teamPlanFlowLocationInventory}
                />
              </div>
            ) : null}
            {row.forge ? (
              <div className={mutedClass}>
                {sub(t.teamPlanFlowRowForge, { from: String(row.forge.from), to: String(row.forge.to) })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
      )}
      {removedRows.length === 0 ? null : (
        <section className="rounded-sm border border-dashed border-line px-3 py-2.5">
          <h4 className="m-0 text-[11px] tracking-[0.03em] text-muted uppercase">
            {t.teamPlanFlowRemovedHeading}
          </h4>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {removedRows.map((row) => {
              const equipped = {
                defId: row.defId,
                rarityIdx: row.rarityIdx,
                level: row.level,
                upgrade: row.upgrade,
              };
              const tip = formatItemRosterTooltip(equipped, lang, t.rankLv);
              return (
                <li key={row.itemId} className="flex items-center gap-2">
                  <ItemIcon item={equipped} size="sm" />
                  <span className="min-w-0 text-[12px] leading-tight text-ink">{tip.title}</span>
                  <span className={cn(mutedClass, 'ml-auto text-right')}>
                    {t.teamPlanFlowRowRemovedToInventory}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="m-0 mt-2 text-[12px] text-muted">
            {crowdedField ? t.teamPlanFlowRemovedWhyCrowded : t.teamPlanFlowRemovedWhyOther}
          </p>
        </section>
      )}
    </div>
  );
}
