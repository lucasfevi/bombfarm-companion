'use client';

import { Select } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { usePlannerStore, selectTeamPlanObjective } from '@/shared/stores';
import { isTeamPlanObjective } from '@/shared/stores/team-plan/types';
import type { TeamPlanObjectiveCopy } from '@/features/team-plan/model/objective-copy';

const fieldLabelClass =
  'flex min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/** Objective picker + hint — no panel chrome (lives inside the search setup bar). */
export function ObjectiveField({ t, copy }: { t: Strings; copy: TeamPlanObjectiveCopy }) {
  const objective = usePlannerStore(selectTeamPlanObjective);
  const setObjective = usePlannerStore((state) => state.setObjective);

  return (
    <div className="min-w-0 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanObjectiveLabel}</span>
        <Select
          aria-label={t.teamPlanObjectiveAria}
          value={objective}
          onChange={(event) => {
            const next: string = event.target.value;
            if (isTeamPlanObjective(next)) setObjective(next);
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
