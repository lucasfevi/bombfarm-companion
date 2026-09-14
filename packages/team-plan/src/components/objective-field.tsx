'use client';

import { Select } from '@bombfarm/ui';
import type { TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { isTeamPlanObjective } from '../core/team-plan-controls';
import type { TeamPlanCopy } from '../copy';
import type { TeamPlanObjectiveCopy } from '../model/objective-copy';
import { SetupField } from './setup-field';

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
    <SetupField label={t.teamPlanObjectiveLabel} hint={copy.objectiveHint} className="min-w-26 max-w-sm flex-1">
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
    </SetupField>
  );
}
