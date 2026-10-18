'use client';

import { InfoTip, Switch } from '@bombfarm/ui';
import type { TeamPlanCopy } from '../copy';

export function PriorityModeSwitch({
  t,
  value,
  onChange,
}: {
  t: TeamPlanCopy;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-ink">
      <span>{t.teamPlanPriorityLabel}</span>
      <InfoTip label={t.teamPlanPriorityLabel} tip={t.teamPlanPriorityTip} />
      <Switch checked={value} onCheckedChange={onChange} aria-label={t.teamPlanPriorityAria} />
    </span>
  );
}
