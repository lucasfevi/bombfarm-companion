'use client';

import { PASS_ADDS, RETURN_BONUS_ADD, RETURN_BONUS_ADD_VIP } from '@bombfarm/domain/phase-wiki';
import { sub } from '@bombfarm/hero/copy';
import { InfoTip, Switch, cn } from '@bombfarm/ui';
import type { FarmCopy } from '../copy';
import { farmFieldClass, farmFieldControlClass, farmFieldLabelClass } from './farm-ranking-filters';

type Props = {
  pass: boolean;
  /** Absent where the Pass is read from the account: the control then shows the state only. */
  onPassChange?: ((pass: boolean) => void) | undefined;
  t: FarmCopy;
};

const percent = (fraction: number): string => String(Math.round(fraction * 100));
const passGain = (adds: readonly [number, number]): string => percent(adds[1] - adds[0]);

export function passTipText(template: string): string {
  return sub(template, {
    gold: passGain(PASS_ADDS.gold),
    xp: passGain(PASS_ADDS.xp),
    drop: passGain(PASS_ADDS.drop),
    returnBase: percent(RETURN_BONUS_ADD),
    returnPass: percent(RETURN_BONUS_ADD_VIP),
  });
}

export function FarmPass({ pass, onPassChange, t }: Props) {
  const effects = passTipText(t.farmRankingPassTip);
  const tip = onPassChange === undefined ? `${effects} ${t.farmRankingPassTipDetected}` : effects;
  return (
    <div className={farmFieldClass} data-testid="farm-pass">
      <span className={farmFieldLabelClass}>
        {t.farmRankingPassLabel}
        <InfoTip label={t.farmRankingPassLabel} tip={tip} />
      </span>
      <div className={farmFieldControlClass}>
        {onPassChange === undefined ? (
          <span
            data-testid="farm-pass-state"
            data-pass={pass ? 'on' : 'off'}
            className={cn(
              'inline-flex h-[22px] items-center rounded-full border px-2 text-[11px] font-semibold leading-none',
              pass ? 'border-accent text-ink' : 'border-line text-muted',
            )}
          >
            {pass ? t.farmRankingPassOn : t.farmRankingPassOff}
          </span>
        ) : (
          <Switch checked={pass} onCheckedChange={onPassChange} aria-label={t.farmRankingPassLabel} />
        )}
      </div>
    </div>
  );
}
