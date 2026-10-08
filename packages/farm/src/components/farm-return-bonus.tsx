'use client';

import { Switch } from '@bombfarm/ui';
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import type { FarmCopy } from '../copy';
import { farmFieldClass, farmFieldControlClass, farmFieldLabelClass } from './farm-ranking-filters';

type Props = {
  value: ReturnBonusMode;
  onChange: (mode: ReturnBonusMode) => void;
  t: FarmCopy;
};

/**
 * A `Switch` over the two-valued `ReturnBonusMode`, in a `<div>` rather than a `<label>` for the
 * reason the filter row's switch is: a native label forwards clicks to Base UI's hidden checkbox.
 */
export function FarmReturnBonus({ value, onChange, t }: Props) {
  return (
    <div className={farmFieldClass} data-testid="farm-return-bonus">
      <span className={farmFieldLabelClass}>{t.farmRankingReturnBonusLabel}</span>
      <div className={farmFieldControlClass}>
        <Switch
          checked={value === 'on'}
          onCheckedChange={(checked) => onChange(checked ? 'on' : 'off')}
          aria-label={t.farmRankingReturnBonusLabel}
        />
      </div>
    </div>
  );
}
