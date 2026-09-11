'use client';

import { Switch } from '@bombfarm/ui';
import type { TeamPlanCopy } from '../copy';
import { ignoreCrowdingHint } from '../model/setup-copy';

const fieldLabelClass =
  'flex min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/**
 * The opt-out from field crowding — no panel chrome, it lives inside the search setup bar.
 *
 * The hint changes with the state rather than describing the control, because what a reader needs
 * here is which question the next run answers: the honest one that can ask them to remove gear, or
 * the roomy one that keeps everyone geared and reads high.
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
    <div className="min-w-0 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanIgnoreCrowdingLabel}</span>
        <span className="flex h-9 items-center">
          <Switch checked={value} onCheckedChange={onChange} aria-label={t.teamPlanIgnoreCrowdingAria} />
        </span>
      </label>
      <p className="m-0 mt-2 text-[12px] text-muted">{ignoreCrowdingHint(t, value)}</p>
    </div>
  );
}
