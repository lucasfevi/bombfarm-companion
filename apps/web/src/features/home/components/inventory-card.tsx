'use client';

import { ITEM_KINDS, type ItemKind } from '@bombfarm/domain/inventory-view';
import { Bar } from '@bombfarm/ui';
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
  const peak = Math.max(0, ...COUNTED_KINDS.map((kind) => view?.groups.find((group) => group.kind === kind)?.count ?? 0));

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
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 text-sm">
        {COUNTED_KINDS.map((kind) => {
          const count = view?.groups.find((group) => group.kind === kind)?.count ?? 0;
          return (
            <div key={kind} className="contents">
              <dt className="text-muted" data-testid="home-inventory-kind">
                {t[GROUP_LABEL_KEY[kind]]}
              </dt>
              <dd className="m-0">
                <Bar percent={peak > 0 ? (count / peak) * 100 : 0} className="bg-[color-mix(in_oklch,var(--accent)_55%,var(--bg-2))]" />
              </dd>
              <dd className="m-0 text-right font-mono tabular-nums" data-testid="home-inventory-count">
                {count}
              </dd>
            </div>
          );
        })}
      </dl>
    </HomeSectionCard>
  );
}
