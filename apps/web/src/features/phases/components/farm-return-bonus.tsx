'use client';

import { Select } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import {
  farmFieldClass,
  farmFieldControlClass,
  farmFieldLabelClass,
} from './farm-ranking-filters';

type Props = {
  value: ReturnBonusMode;
  onChange: (mode: ReturnBonusMode) => void;
  t: Strings;
};

/**
 * Three-option Select over `@bombfarm/domain`'s `ReturnBonusMode` VERBATIM — option values are the
 * literal `'off' | 'on' | 'vip'`, option labels come from `t.*`. `Select`, not `Switch` +
 * a second VIP `Switch`: three states, and two booleans would make an invalid combination
 * (VIP on, bonus off) representable (`base-ui-first.md` rule 3).
 */
export function FarmReturnBonus({ value, onChange, t }: Props) {
  return (
    <label className={farmFieldClass} data-testid="farm-return-bonus">
      <span className={farmFieldLabelClass}>{t.farmRankingReturnBonusLabel}</span>
      <div className={farmFieldControlClass}>
        <Select
          size="compact"
          aria-label={t.farmRankingReturnBonusLabel}
          value={value}
          onChange={(event) => onChange(event.target.value as ReturnBonusMode)}
        >
          <option value="off">{t.farmRankingReturnBonusOff}</option>
          <option value="on">{t.farmRankingReturnBonusOn}</option>
          <option value="vip">{t.farmRankingReturnBonusVip}</option>
        </Select>
      </div>
    </label>
  );
}
