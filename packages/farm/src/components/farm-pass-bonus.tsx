'use client';

import type { PassBonus } from '@bombfarm/domain/farm-rate';
import { sub } from '@bombfarm/hero/copy';
import { InfoTip } from '@bombfarm/ui';
import type { FarmCopy } from '../copy';
import { farmFieldClass, farmFieldControlClass, farmFieldLabelClass } from './farm-ranking-filters';

type Props = {
  passBonus: PassBonus;
  t: FarmCopy;
};

const percent = (fraction: number): string => String(Math.round(fraction * 100));

/** Read-only: the bonus is the game's to grant and comes from the account, so there is no switch. */
export function FarmPassBonus({ passBonus, t }: Props) {
  const adds = { gold: percent(passBonus.gold), xp: percent(passBonus.xp) };
  return (
    <div className={farmFieldClass} data-testid="farm-pass-bonus">
      <span className={farmFieldLabelClass}>
        {t.farmRankingPassBonusLabel}
        <InfoTip
          label={t.farmRankingPassBonusLabel}
          tip={`${sub(t.farmRankingPassBonusTip, adds)} ${t.farmRankingPassTipDetected}`}
        />
      </span>
      <div className={farmFieldControlClass}>
        <span
          data-testid="farm-pass-bonus-state"
          className="inline-flex h-[22px] items-center rounded-full border border-accent px-2 text-[11px] font-semibold leading-none text-ink"
        >
          {sub(t.farmRankingPassBonusValue, adds)}
        </span>
      </div>
    </div>
  );
}
