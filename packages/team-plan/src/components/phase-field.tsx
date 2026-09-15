'use client';

import { useMemo } from 'react';
import { SearchSelect, formatNumber } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';
import type { TeamPlanObjectiveCopy } from '../model/objective-copy';
import { phaseFromOptionValue, phaseOptionValue, teamPlanPhaseOptions } from '../model/phase-options';
import { SetupField } from './setup-field';

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
    <SetupField
      label={t.teamPlanPhaseLabel}
      hint={value == null ? copy.phaseHintNone : t.teamPlanPhaseHintChosen}
      className="min-w-52 max-w-sm flex-1"
    >
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
      {beyondReach ? (
        <p className="m-0 mt-1.5 text-[12px] leading-snug text-warn" role="status">
          {sub(t.teamPlanPhaseBeyondMax, { max: formatNumber(maxPhase, lang, 0) })}
        </p>
      ) : null}
    </SetupField>
  );
}
