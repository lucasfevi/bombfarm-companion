'use client';

import { useMemo } from 'react';
import { SearchSelect } from '@bombfarm/ui';
import type { Strings, Lang } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { usePlannerStore, selectTeamPlanTargetPhase } from '@/shared/stores';
import { formatNumber } from '@/shared/lib/format-number';
import {
  phaseFromOptionValue,
  phaseOptionValue,
  teamPlanPhaseOptions,
} from '@/features/team-plan/model/phase-options';

const fieldLabelClass =
  'flex min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/** Phase picker + hint — no panel chrome (lives inside the search setup bar, beside Score for). */
export function PhaseField({ t, lang }: { t: Strings; lang: Lang }) {
  const targetPhase = usePlannerStore(selectTeamPlanTargetPhase);
  const maxPhase = usePlannerStore((state) => state.maxPhase);
  const setTargetPhase = usePlannerStore((state) => state.setTargetPhase);

  const options = useMemo(
    () => teamPlanPhaseOptions(lang, t.teamPlanPhaseNone),
    [lang, t.teamPlanPhaseNone],
  );

  const beyondReach = targetPhase != null && maxPhase != null && targetPhase > maxPhase;

  return (
    <div className="min-w-0 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanPhaseLabel}</span>
        <SearchSelect
          aria-label={t.teamPlanPhaseAria}
          options={options}
          value={phaseOptionValue(targetPhase)}
          onValueChange={(next) => setTargetPhase(phaseFromOptionValue(next))}
          searchPlaceholder={t.teamPlanPhaseSearchPlaceholder}
          emptyLabel={t.teamPlanPhaseNoMatch}
          overflowLabel={(shown, matched) =>
            sub(t.teamPlanPhaseMoreMatches, {
              shown: formatNumber(shown, lang, 0),
              matched: formatNumber(matched, lang, 0),
            })
          }
        />
      </label>
      <p className="m-0 mt-2 text-[12px] text-muted">
        {targetPhase == null ? t.teamPlanPhaseHintNone : t.teamPlanPhaseHintChosen}
      </p>
      {beyondReach ? (
        <p className="m-0 mt-1 text-[12px] text-warn" role="status">
          {sub(t.teamPlanPhaseBeyondMax, { max: formatNumber(maxPhase, lang, 0) })}
        </p>
      ) : null}
    </div>
  );
}
