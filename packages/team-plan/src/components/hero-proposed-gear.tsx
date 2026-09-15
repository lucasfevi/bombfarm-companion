'use client';

import { SLOTS, type Slot } from '@bombfarm/domain/gear';
import { formatItemRosterTooltip, slotLabel } from '@bombfarm/domain/game-labels';
import { cn, mutedClass } from '@bombfarm/ui';
import { ItemIcon, ItemPeek, emptyGearSlotClass } from '@bombfarm/game-art';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { isKeptExistingGearFlowRow, type GearFlowRow } from '../model/gear-flow-rows';
import type { TeamPlanScreenCopy } from '../copy';
import { HeroOriginTag } from './hero-origin-tag';

/**
 * One card per gear slot, in catalog order — the item that ends on this hero there (pieces
 * already equipped that the plan leaves alone included, saying so explicitly), or the slot's name
 * over "no item proposed". A slot the plan leaves empty is drawn rather than skipped: a grid one
 * card short reads as an item the page lost, not as a slot the plan had nothing for.
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

type SlotCard = { slot: Slot; row: null } | { slot: Slot | null; row: GearFlowRow };

/** Every catalog slot once, filled where a row lands there; a row whose slot no card can take
 *  (unknown, or a second item on one slot) is appended so nothing the plan proposes is hidden. */
function slotCards(rows: GearFlowRow[]): SlotCard[] {
  const bySlot = new Map<Slot, GearFlowRow>();
  const unplaced: GearFlowRow[] = [];
  for (const row of rows) {
    if (row.slot !== null && SLOTS.includes(row.slot) && !bySlot.has(row.slot)) {
      bySlot.set(row.slot, row);
    } else {
      unplaced.push(row);
    }
  }
  return [
    ...SLOTS.map((slot): SlotCard => {
      const row = bySlot.get(slot);
      return row ? { slot, row } : { slot, row: null };
    }),
    ...unplaced.map((row): SlotCard => ({ slot: null, row })),
  ];
}

function EmptySlotCard({ slot, lang, label }: { slot: Slot; lang: Lang; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-sm border border-dashed border-line bg-transparent px-2 py-2.5 text-center">
      <span className={emptyGearSlotClass} aria-hidden="true" />
      <div className="text-[12px] leading-tight font-bold text-muted">{slotLabel(slot, lang)}</div>
      <div className={mutedClass}>{label}</div>
    </div>
  );
}

export function HeroProposedGear({
  t,
  lang,
  gear,
  heroByScopeKey,
  heroNameFallback,
}: {
  t: TeamPlanScreenCopy;
  lang: Lang;
  gear: HeroGearFlow;
  heroByScopeKey: Map<string, HeroRecord>;
  heroNameFallback: (heroId: string) => string;
}) {
  const { rows: flowRows, removed: removedRows, crowdedField } = gear;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        {slotCards(flowRows).map((card) => {
          if (card.row === null) {
            return (
              <EmptySlotCard key={card.slot} slot={card.slot} lang={lang} label={t.teamPlanFlowSlotEmpty} />
            );
          }
          const row = card.row;
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
              <ItemPeek item={equipped} lang={lang} className={cn(keptExisting && 'opacity-80')}>
                <ItemIcon item={equipped} size="lg" />
              </ItemPeek>
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
                  <ItemPeek item={equipped} lang={lang}>
                    <ItemIcon item={equipped} size="sm" />
                  </ItemPeek>
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
