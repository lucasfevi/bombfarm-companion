'use client';

import { Switch } from '@bombfarm/ui';
import type { TeamPlanCopy } from '../copy';
import { ignoreCrowdingHint } from '../model/setup-copy';
import { SetupField } from './setup-field';

/**
 * The opt-out from field crowding. The hint changes with the state rather than describing the
 * control, because what a reader needs here is which question the next run answers: the honest
 * one that can ask them to remove gear, or the roomy one that keeps everyone geared and reads high.
 */
export function IgnoreCrowdingField({
  t,
  value,
  onChange,
}: {
  t: TeamPlanCopy;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <SetupField
      label={t.teamPlanIgnoreCrowdingLabel}
      hint={ignoreCrowdingHint(t, value)}
      className="min-w-44 max-w-sm flex-1"
    >
      <span className="flex h-[34px] items-center">
        <Switch checked={value} onCheckedChange={onChange} aria-label={t.teamPlanIgnoreCrowdingAria} />
      </span>
    </SetupField>
  );
}
