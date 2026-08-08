'use client';

import { formatItemRosterTooltip } from '@bombfarm/domain/game-labels';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import { Tooltip, cn } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { ItemIcon, rarityTextClass } from '@/shared/game-art';
import { rosterIconTooltipTriggerClass } from '@/shared/game-art/game-art.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';
import type { GearFlowRow } from '@/features/gear-plan/model/gear-flow-rows';

/** `{rarityColor}Name ★★★ Lv{level}` — condensed hero identity for a card's "From" line. */
function HeroOriginTag({
  heroId,
  heroByScopeKey,
  heroNameFallback,
  inventoryLabel,
}: {
  heroId: string | null;
  heroByScopeKey: Map<string, HeroRecord>;
  heroNameFallback: (heroId: string) => string;
  inventoryLabel: string;
}) {
  if (!heroId) return <span className="text-ink">{inventoryLabel}</span>;
  const hero = heroByScopeKey.get(heroId);
  if (!hero) return <span className="text-ink">{heroNameFallback(heroId)}</span>;

  const rarIdx = RARITIES.indexOf(hero.rarity);
  const stars = Math.max(0, Math.min(3, Math.round(hero.stars ?? 0)));

  return (
    <span>
      <span className={cn('font-semibold', rarityTextClass(rarIdx) ?? 'text-ink')}>{hero.name}</span>
      {stars > 0 ? <span className="text-rar-4"> {'★'.repeat(stars)}</span> : null}
      <span> Lv{hero.level}</span>
    </span>
  );
}

/** One card per item the plan actually touches — nothing changing means no card. */
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

        return (
          <div
            key={row.itemId}
            className="flex flex-col items-center gap-1 rounded-sm border border-line bg-bg px-2 py-2.5 text-center"
          >
            <Tooltip.Root>
              <Tooltip.Trigger
                type="button"
                tabIndex={-1}
                aria-label={`${tip.title}. ${tip.subtitle}`}
                className={rosterIconTooltipTriggerClass}
              >
                <ItemIcon equipped={equipped} size="lg" />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={6}>
                  <Tooltip.Popup>
                    <p className="m-0 font-semibold text-ink">{tip.title}</p>
                    <p className="m-0 text-xs text-muted">{tip.subtitle}</p>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <div className="text-[12px] leading-tight font-bold text-ink">{tip.title}</div>
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
