'use client';

import { ITEM_KINDS, type ItemKind } from '@bombfarm/domain/inventory-view';
import { ItemIcon, type ItemIconItem } from '@bombfarm/game-art';
import { useAccountHoldings } from '@/features/account';
import { useAppLang } from '@/shared/context/app-lang';
import { useMarketSnapshot } from '@/shared/hooks/use-market-snapshot';
import { formatMoney, sub, type Strings } from '@/shared/i18n';
import { hasInventoryRows, useInventoryViewSnapshot } from '../model/use-inventory-view-snapshot';
import { HomeSectionCard } from './home-section-card';

const GROUP_LABEL_KEY = {
  equipment: 'inventoryGroupEquipment',
  gem: 'inventoryGroupGem',
  key: 'inventoryGroupKey',
  time: 'inventoryGroupTime',
  stone: 'inventoryGroupStone',
  chest: 'inventoryGroupChest',
} as const satisfies Record<Exclude<ItemKind, 'other'>, keyof Strings>;

const MYTHIC = 5;

/** One fixed emblem per group: the mythic tier of each kind, and the level-300 mythic weapon for gear. */
const GROUP_EMBLEM = {
  equipment: { defId: 'void_arma', rarityIdx: MYTHIC, level: 300, upgrade: 0 },
  gem: { defId: 'gem_amethyst', kind: 'gem', rarityIdx: MYTHIC, level: 0, upgrade: 0 },
  key: { defId: 'map_key_mythic', kind: 'key', rarityIdx: MYTHIC, level: 0, upgrade: 0 },
  time: { defId: 'time_part_mythic', kind: 'time', rarityIdx: MYTHIC, level: 0, upgrade: 0 },
  stone: { defId: 'skill_stone_mythic', kind: 'stone', rarityIdx: MYTHIC, level: 0, upgrade: 0 },
  chest: { defId: 'chest_item', kind: 'chest', rarityIdx: MYTHIC, level: 0, upgrade: 0 },
} as const satisfies Record<Exclude<ItemKind, 'other'>, ItemIconItem>;

const COUNTED_KINDS = ITEM_KINDS.filter(
  (kind): kind is keyof typeof GROUP_LABEL_KEY => kind !== 'other',
);

export function InventoryCard() {
  const { t, lang } = useAppLang();
  const view = useInventoryViewSnapshot();
  const holdings = useAccountHoldings();
  const { snapshot } = useMarketSnapshot();
  const ready = hasInventoryRows(view);

  const coverage = sub(t.homeCardInventoryCoverage, {
    priced: holdings.inventory.priced,
    eligible: holdings.inventory.eligible,
  });
  const footer =
    snapshot != null && holdings.footnote != null ? `${coverage} · ${holdings.footnote}` : coverage;

  return (
    <HomeSectionCard
      section="inventory"
      state={ready ? 'ready' : 'needs'}
      context={t.homeCardInventoryContext}
      footer={ready ? footer : t.homeCardInventoryNeeds}
    >
      <p
        className="m-0 mb-2.5 font-mono text-2xl leading-none font-bold tabular-nums text-accent"
        data-testid="home-inventory-figure"
      >
        {snapshot != null
          ? formatMoney(holdings.inventory.amount, lang, holdings.currency)
          : t.accountHoldingsUnpriced}
      </p>
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {COUNTED_KINDS.map((kind) => {
          const group = view?.groups.find((candidate) => candidate.kind === kind);
          return (
            <li
              key={kind}
              className="flex items-center gap-2.5 rounded-sm border border-line bg-surface px-2.5 py-2"
              data-testid="home-inventory-tile"
            >
              <span className="grid size-8 shrink-0 place-items-center" aria-hidden="true">
                <ItemIcon item={GROUP_EMBLEM[kind]} size="xs" showLevel={false} showUpgrade={false} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-mono text-lg leading-none font-bold tabular-nums" data-testid="home-inventory-count">
                  {group?.count ?? 0}
                </span>
                <span className="mt-1 text-xs leading-tight text-muted" data-testid="home-inventory-kind">
                  {t[GROUP_LABEL_KEY[kind]]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </HomeSectionCard>
  );
}
