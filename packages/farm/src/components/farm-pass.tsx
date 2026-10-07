'use client';

import { InfoTip, Switch, cn } from '@bombfarm/ui';
import type { FarmCopy } from '../copy';
import { farmFieldClass, farmFieldControlClass, farmFieldLabelClass } from './farm-ranking-filters';

type Props = {
  pass: boolean;
  /** Absent where the Pass is read from the account: the control then shows the state only. */
  onPassChange?: ((pass: boolean) => void) | undefined;
  t: FarmCopy;
};

export function FarmPass({ pass, onPassChange, t }: Props) {
  const tip =
    onPassChange === undefined ? `${t.farmRankingPassTip} ${t.farmRankingPassTipDetected}` : t.farmRankingPassTip;
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
