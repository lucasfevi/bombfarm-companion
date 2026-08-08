'use client';

import { formatItemRosterTooltip } from '@bombfarm/domain/game-labels';
import { cn, Tooltip } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { ItemIcon } from '@/shared/game-art';
import { rosterIconTooltipTriggerClass } from '@/shared/game-art/game-art.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';
import {
  isKeptExistingGearFlowRow,
  type GearFlowRow,
} from '@/features/gear-plan/model/gear-flow-rows';
import { HeroOriginTag } from './hero-origin-tag';

/**
 * One card per item that ends on this hero — including pieces already equipped that the plan
 * leaves alone. Unchanged keepers stay visible and say so explicitly.
 */
export function HeroProposedGear({
  t,
  lang,
  flowRows,
  heroByScopeKey,
  heroNameFallback,
}: {
  t: Strings;
  lang: Lang;
  flowRows: GearFlowRow[];
  heroByScopeKey: Map<string, HeroRecord>;
  heroNameFallback: (heroId: string) => string;
}) {
  if (flowRows.length === 0) {
    return <p className="m-0 text-[12px] text-muted">{t.gearPlanHeroBreakdownGearEmpty}</p>;
  }

  return (
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
                aria-label={`${tip.title}. ${tip.subtitle}${keptExisting ? `. ${t.gearPlanFlowRowExisting}` : ''}`}
                className={cn(rosterIconTooltipTriggerClass, keptExisting && 'opacity-80')}
              >
                <ItemIcon equipped={equipped} size="lg" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p className="m-0 font-semibold text-ink">{tip.title}</p>
                    <p className="m-0 text-xs text-muted">{tip.subtitle}</p>
                    {keptExisting ? (
                      <p className="m-0 mt-1 text-xs text-muted">{t.gearPlanFlowRowExisting}</p>
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
            {keptExisting ? <div className={mutedClass}>{t.gearPlanFlowRowExisting}</div> : null}
            {moved ? (
              <div className={mutedClass}>
                {t.gearPlanFlowRowFromLabel}{' '}
                <HeroOriginTag
                  heroId={row.originHeroId}
                  heroByScopeKey={heroByScopeKey}
                  heroNameFallback={heroNameFallback}
                  inventoryLabel={t.gearPlanFlowLocationInventory}
                />
              </div>
            ) : null}
            {row.forge ? (
              <div className={mutedClass}>
                {sub(t.gearPlanFlowRowForge, { from: String(row.forge.from), to: String(row.forge.to) })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
