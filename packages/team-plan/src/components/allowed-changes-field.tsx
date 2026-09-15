'use client';

import { Select } from '@bombfarm/ui';
import type { TeamPlanAllowedChanges } from '@bombfarm/domain/team-plan/types';
import { isTeamPlanAllowedChanges } from '../core/team-plan-controls';
import type { TeamPlanCopy } from '../copy';
import { allowedChangesHint } from '../model/setup-copy';
import { SetupField } from './setup-field';

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
    <SetupField
      label={t.teamPlanAllowedChangesLabel}
      hint={allowedChangesHint(t, value)}
      className="min-w-38 max-w-sm flex-1"
    >
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
    </SetupField>
  );
}
