'use client';

import type { DeconstructBatchSummary } from '@bombfarm/domain/deconstruct';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { Banner, FactTile } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { DeconstructBatchGroups } from './deconstruct-batch-groups';
import { BLANK, type DeconstructLabels, type deconstructWarnings } from './deconstruct-labels';

const SIX_ROWS_AT_ANY_HEIGHT = '[@media(max-height:820px)]:max-h-[7.125rem]';

export function DeconstructConfirmBody({
  items,
  summary,
  hidden,
  balance,
  warnings,
  labels,
}: {
  items: readonly InventoryViewItem[];
  summary: DeconstructBatchSummary;
  /** Ticked items the current filters leave out of the list. */
  hidden: number;
  /** The essence balance on the pinned account, `null` when the read carries none. */
  balance: number | null;
  warnings: ReturnType<typeof deconstructWarnings>;
  labels: DeconstructLabels;
}) {
  const t = useCopy();
  const balanceLine =
    balance === null ? BLANK : `${labels.count(balance)} → ${labels.count(balance + summary.essence)}`;
  const warned = [warnings.forged, warnings.rare].filter((warning) => warning.active);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4">
        <FactTile
          size="display"
          label={t.deconstructConfirmItems}
          value={labels.count(summary.count)}
          data-testid="deconstruct-confirm-items"
        />
        <FactTile
          size="display"
          label={t.deconstructConfirmEssence}
          value={labels.signedCount(summary.essence)}
          valueClassName="text-accent"
          detail={balanceLine}
          data-testid="deconstruct-confirm-essence"
        />
      </div>

      <Banner tone="danger" layout="embedded" title={t.deconstructConfirmIrreversible} className="mb-0" data-testid="deconstruct-confirm-irreversible">
        {t.deconstructConfirmDestroyed}
      </Banner>

      <section data-testid="deconstruct-confirm-groups" className="flex flex-col gap-1.5">
        <h3 className="m-0 text-[11px] leading-none font-bold tracking-[0.06em] text-muted uppercase">
          {t.deconstructConfirmGroupsTitle}
        </h3>
        <DeconstructBatchGroups items={items} labels={labels} className={SIX_ROWS_AT_ANY_HEIGHT} />
        {hidden > 0 ? (
          <p data-testid="deconstruct-confirm-hidden" className="m-0 text-xs leading-[1.45] text-muted">
            {sub(t.deconstructConfirmHidden, { count: labels.count(hidden) })}
          </p>
        ) : null}
      </section>

      {warned.length > 0 ? (
        <Banner tone="warn" layout="embedded" className="mb-0" data-testid="deconstruct-confirm-warnings">
          <ul className="m-0 list-disc py-0 pl-[18px] text-xs leading-[1.45] text-ink marker:text-warn">
            {warned.map((warning) => (
              <li key={warning.text}>{warning.text}</li>
            ))}
          </ul>
        </Banner>
      ) : null}
    </div>
  );
}
