'use client';

import { ITEM_KINDS, type ItemKind } from '@bombfarm/domain/inventory-view';
import type { DropRateId } from '@bombfarm/domain/phase-wiki';
import { DropIcon, ItemIcon } from '@bombfarm/game-art';
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

const DROP_ICON_ID = {
  gem: 'gem',
  key: 'key',
  time: 'time',
  stone: 'stone',
  chest: 'chest',
} as const satisfies Record<Exclude<ItemKind, 'other' | 'equipment'>, DropRateId>;

/** The top difficulty's sprite, the way the Farm board's column headers draw theirs. */
const ICON_BAND = 5;

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
          const sample = group?.entries[0]?.item;
          return (
            <li
              key={kind}
              className="flex items-center gap-2.5 rounded-sm border border-line bg-surface px-2.5 py-2"
              data-testid="home-inventory-tile"
            >
              <span className="grid size-8 shrink-0 place-items-center" aria-hidden="true">
                {kind === 'equipment' ? (
                  sample ? <ItemIcon item={sample} size="xs" /> : null
                ) : (
                  <DropIcon id={DROP_ICON_ID[kind]} ato={ICON_BAND} className="size-7" />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-mono text-lg leading-none font-bold tabular-nums" data-testid="home-inventory-count">
                  {group?.count ?? 0}
                </span>
                <span className="mt-1 truncate text-xs text-muted" data-testid="home-inventory-kind">
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
