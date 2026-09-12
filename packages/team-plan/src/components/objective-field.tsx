'use client';

import { Select } from '@bombfarm/ui';
import type { TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { isTeamPlanObjective } from '../core/team-plan-controls';
import type { TeamPlanCopy } from '../copy';
import type { TeamPlanObjectiveCopy } from '../model/objective-copy';

const fieldLabelClass =
  'flex min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/** Objective picker + hint — no panel chrome (lives inside the search setup bar). */
export function ObjectiveField({
  t,
  copy,
  value,
  onChange,
}: {
  t: TeamPlanCopy;
  copy: TeamPlanObjectiveCopy;
  value: TeamPlanObjective;
  onChange: (value: TeamPlanObjective) => void;
}) {
  return (
    <div className="min-w-26 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanObjectiveLabel}</span>
        <Select
          aria-label={t.teamPlanObjectiveAria}
          value={value}
          onChange={(event) => {
            const next: string = event.target.value;
            if (isTeamPlanObjective(next)) onChange(next);
          }}
        >
          <option value="farm">{t.teamPlanObjectiveOptionGold}</option>
          <option value="dps">{t.teamPlanObjectiveOptionDamage}</option>
        </Select>
      </label>
      <p className="m-0 mt-2 text-[12px] text-muted">{copy.objectiveHint}</p>
    </div>
  );
}
