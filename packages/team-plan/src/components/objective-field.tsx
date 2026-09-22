'use client';

import { Select } from '@bombfarm/ui';
import type { TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { TEAM_PLAN_OBJECTIVES_WITHOUT_PVP, isTeamPlanObjective } from '../core/team-plan-controls';
import type { TeamPlanCopy } from '../copy';
import type { TeamPlanObjectiveCopy } from '../model/objective-copy';
import { SetupField } from './setup-field';

export function objectiveOptionLabel(objective: TeamPlanObjective, t: TeamPlanCopy): string {
  switch (objective) {
    case 'farm':
      return t.teamPlanObjectiveOptionGold;
    case 'gateClear':
      return t.teamPlanObjectiveOptionGate;
    case 'pvp':
      return t.teamPlanObjectiveOptionPvp;
    default:
      return objective;
  }
}

export function ObjectiveField({
  t,
  copy,
  value,
  objectives = TEAM_PLAN_OBJECTIVES_WITHOUT_PVP,
  onChange,
}: {
  t: TeamPlanCopy;
  copy: TeamPlanObjectiveCopy;
  value: TeamPlanObjective;
  /** The objectives this host can score — a host with no PVP squad source leaves the duel out. */
  objectives?: readonly TeamPlanObjective[];
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
        {objectives.map((objective) => (
          <option key={objective} value={objective}>
            {objectiveOptionLabel(objective, t)}
          </option>
        ))}
      </Select>
    </SetupField>
  );
}
