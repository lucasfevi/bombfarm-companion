'use client';

import { useMemo } from 'react';
import { SearchSelect, formatNumber } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';
import type { TeamPlanObjectiveCopy } from '../model/objective-copy';
import { phaseFromOptionValue, phaseOptionValue, teamPlanPhaseOptions } from '../model/phase-options';

const fieldLabelClass =
  'flex min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/** Phase picker + hint — no panel chrome (lives inside the search setup bar, beside Score for). */
export function PhaseField({
  t,
  lang,
  copy,
  value,
  maxPhase,
  onChange,
}: {
  t: TeamPlanCopy;
  lang: Lang;
  copy: TeamPlanObjectiveCopy;
  value: number | null;
  maxPhase: number | null;
  onChange: (value: number | null) => void;
}) {
  const options = useMemo(
    () => teamPlanPhaseOptions(lang, t.teamPlanPhaseNone),
    [lang, t.teamPlanPhaseNone],
  );

  const beyondReach = value != null && maxPhase != null && value > maxPhase;

  return (
    <div className="min-w-52 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanPhaseLabel}</span>
        <SearchSelect
          aria-label={t.teamPlanPhaseAria}
          options={options}
          value={phaseOptionValue(value)}
          onValueChange={(next) => onChange(phaseFromOptionValue(next))}
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
        {value == null ? copy.phaseHintNone : t.teamPlanPhaseHintChosen}
      </p>
      {beyondReach ? (
        <p className="m-0 mt-1 text-[12px] text-warn" role="status">
          {sub(t.teamPlanPhaseBeyondMax, { max: formatNumber(maxPhase, lang, 0) })}
        </p>
      ) : null}
    </div>
  );
}
