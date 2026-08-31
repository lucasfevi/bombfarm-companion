import { Panel, formatCompactNumber } from '@bombfarm/ui';
import type { Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaFrame } from '../../model/live-replica-data';
import { ReplicaBlock } from './replica-block';
import { ReplicaCardHead } from './replica-card-head';

export function EarningsCard({
  lang,
  earnings,
}: {
  lang: Lang;
  earnings: ReplicaFrame['earnings'];
}) {
  const compact = (value: number) => formatCompactNumber(value, lang);

  return (
    <Panel className="p-3">
      <ReplicaCardHead title={liveLabel('liveEarningsTitle', lang)} />
      {/* Values right-aligned against their units, so the gold and XP rates line up on the digit
          edge instead of drifting apart with the smaller of the two. */}
      <div className="mb-3 grid grid-cols-[max-content_max-content] items-baseline gap-x-2">
        <span className="text-right text-[26px] leading-none font-bold text-gold tabular-nums">
          {compact(earnings.goldPerHour)}
        </span>
        <span className="text-[10px] text-muted">
          {liveLabel('liveEarningsGoldHeadlineUnit', lang)}
        </span>
        <span className="text-right text-[18px] leading-none font-bold text-info tabular-nums">
          {compact(earnings.xpPerHour)}
        </span>
        <span className="text-[10px] text-muted">
          {liveLabel('liveEarningsXpHeadlineUnit', lang)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <ReplicaBlock
          label={liveLabel('liveEarningsCurrentGoldLabel', lang)}
          value={compact(earnings.currentGold)}
          valueClass="text-ink"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsGoldSessionLabel', lang)}
          value={compact(earnings.goldSession)}
          valueClass="text-gold/70"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsGoldSessionTotalLabel', lang)}
          value={compact(earnings.goldSessionTotal)}
          valueClass="text-gold"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsElapsedLabel', lang)}
          value={earnings.elapsed}
          valueClass="text-ink"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsXpSessionLabel', lang)}
          value={compact(earnings.xpSession)}
          valueClass="text-info/70"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsXpSessionTotalLabel', lang)}
          value={compact(earnings.xpSessionTotal)}
          valueClass="text-info"
        />
      </div>
    </Panel>
  );
}
