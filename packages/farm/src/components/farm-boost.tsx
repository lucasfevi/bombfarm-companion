'use client';

import type { EconomyBoost } from '@bombfarm/domain/farm-rate';
import { sub } from '@bombfarm/hero/copy';
import { InfoTip, Switch, cn } from '@bombfarm/ui';
import type { FarmCopy } from '../copy';
import { BOOST_ADD } from '../core';
import { farmFieldClass, farmFieldControlClass, farmFieldLabelClass } from './farm-ranking-filters';

type BoostAxis = keyof EconomyBoost;

const BOOST_AXES: readonly BoostAxis[] = ['gold', 'xp', 'drop'];

type Props = {
  boost: EconomyBoost;
  /** Absent where the Boosts are read from the game: the control then shows their state only. */
  onBoostChange?: ((boost: EconomyBoost) => void) | undefined;
  t: FarmCopy;
};

function axisLabel(axis: BoostAxis, t: FarmCopy): string {
  if (axis === 'gold') return t.farmRankingBoostGold;
  if (axis === 'xp') return t.farmRankingBoostXp;
  return t.farmRankingBoostDrop;
}

export function FarmBoost({ boost, onBoostChange, t }: Props) {
  const effects = sub(t.farmRankingBoostTip, { pct: String(Math.round(BOOST_ADD * 100)) });
  const tip = onBoostChange === undefined ? `${effects} ${t.farmRankingBoostTipDetected}` : effects;
  return (
    <div className={farmFieldClass} data-testid="farm-boost">
      <span className={farmFieldLabelClass}>
        {t.farmRankingBoostLabel}
        <InfoTip label={t.farmRankingBoostLabel} tip={tip} />
      </span>
      <div className={cn(farmFieldControlClass, 'gap-3')}>
        {BOOST_AXES.map((axis) => {
          const label = axisLabel(axis, t);
          const on = boost[axis];
          return (
            <div key={axis} className="flex items-center gap-1.5" data-testid={`farm-boost-${axis}`}>
              <span className="text-[11px] leading-none text-muted">{label}</span>
              {onBoostChange === undefined ? (
                <span
                  data-testid={`farm-boost-${axis}-state`}
                  data-boost={on ? 'on' : 'off'}
                  className={cn(
                    'inline-flex h-[22px] items-center rounded-full border px-2 text-[11px] font-semibold leading-none',
                    on ? 'border-accent text-ink' : 'border-line text-muted',
                  )}
                >
                  {on ? t.farmRankingPassOn : t.farmRankingPassOff}
                </span>
              ) : (
                <Switch
                  checked={on}
                  onCheckedChange={(checked) => onBoostChange({ ...boost, [axis]: checked })}
                  aria-label={`${t.farmRankingBoostLabel} ${label}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
