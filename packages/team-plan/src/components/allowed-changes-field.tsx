'use client';

import { Select } from '@bombfarm/ui';
import type { TeamPlanAllowedChanges } from '@bombfarm/domain/team-plan/types';
import { isTeamPlanAllowedChanges } from '../core/team-plan-controls';
import type { TeamPlanCopy } from '../copy';
import { allowedChangesHint } from '../model/setup-copy';

const fieldLabelClass =
  'flex min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/** Allowed-changes picker + hint — no panel chrome (lives inside the search setup bar). */
export function AllowedChangesField({
  t,
  value,
  onChange,
}: {
  t: TeamPlanCopy;
  value: TeamPlanAllowedChanges;
  onChange: (value: TeamPlanAllowedChanges) => void;
}) {
  return (
    <div className="min-w-38 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanAllowedChangesLabel}</span>
        <Select
          aria-label={t.teamPlanAllowedChangesAria}
          value={value}
          onChange={(event) => {
            const next: string = event.target.value;
            if (isTeamPlanAllowedChanges(next)) onChange(next);
          }}
        >
          <option value="both">{t.teamPlanAllowedChangesOptionBoth}</option>
          <option value="points">{t.teamPlanAllowedChangesOptionPoints}</option>
          <option value="gear">{t.teamPlanAllowedChangesOptionGear}</option>
        </Select>
      </label>
      <p className="m-0 mt-2 text-[12px] text-muted">{allowedChangesHint(t, value)}</p>
    </div>
  );
}
