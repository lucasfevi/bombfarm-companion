'use client';

import { Select } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { usePlannerStore, selectTeamPlanAllowedChanges } from '@/shared/stores';
import { isTeamPlanAllowedChanges } from '@/shared/stores/team-plan/types';

const fieldLabelClass =
  'flex min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/** Allowed-changes picker + hint — no panel chrome (lives inside the search setup bar). */
export function AllowedChangesField({ t }: { t: Strings }) {
  const allowedChanges = usePlannerStore(selectTeamPlanAllowedChanges);
  const setAllowedChanges = usePlannerStore((state) => state.setAllowedChanges);
  const hint =
    allowedChanges === 'points'
      ? t.teamPlanAllowedChangesHintPoints
      : allowedChanges === 'gear'
        ? t.teamPlanAllowedChangesHintGear
        : t.teamPlanAllowedChangesHintBoth;

  return (
    <div className="min-w-0 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanAllowedChangesLabel}</span>
        <Select
          aria-label={t.teamPlanAllowedChangesAria}
          value={allowedChanges}
          onChange={(event) => {
            const next: string = event.target.value;
            if (isTeamPlanAllowedChanges(next)) setAllowedChanges(next);
          }}
        >
          <option value="both">{t.teamPlanAllowedChangesOptionBoth}</option>
          <option value="points">{t.teamPlanAllowedChangesOptionPoints}</option>
          <option value="gear">{t.teamPlanAllowedChangesOptionGear}</option>
        </Select>
      </label>
      <p className="m-0 mt-2 text-[12px] text-muted">{hint}</p>
    </div>
  );
}
