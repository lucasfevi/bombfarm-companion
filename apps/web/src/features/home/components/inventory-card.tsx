'use client';

import { ITEM_KINDS, type ItemKind } from '@bombfarm/domain/inventory-view';
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

const COUNTED_KINDS = ITEM_KINDS.filter(
  (kind): kind is keyof typeof GROUP_LABEL_KEY => kind !== 'other',
);

export function InventoryCard() {
  const { t, lang } = useAppLang();
  const view = useInventoryViewSnapshot();
  const holdings = useAccountHoldings();
  const { snapshot } = useMarketSnapshot();
  const ready = hasInventoryRows(view);

  const coverage = sub(t.accountHoldingsInventoryCoverage, {
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
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {COUNTED_KINDS.map((kind) => (
          <div key={kind} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted" data-testid="home-inventory-kind">
              {t[GROUP_LABEL_KEY[kind]]}
            </dt>
            <dd className="m-0 font-mono tabular-nums" data-testid="home-inventory-count">
              {view?.groups.find((group) => group.kind === kind)?.count ?? 0}
            </dd>
          </div>
        ))}
      </dl>
    </HomeSectionCard>
  );
}
